// Edge Function: spotify-token (#57)
//
// Fundação server-side da nova autenticação. O navegador nunca vê o client
// secret nem o refresh token de longa duração do Spotify: ambos vivem aqui.
//
// Ações:
//   - store:   grava/atualiza o provider_refresh_token do usuário autenticado.
//   - refresh: troca o refresh token salvo por um access token fresco.
//
// O caller é validado pelo JWT encaminhado no functions.invoke (verify_jwt do
// gateway + confirmação via auth.getUser). A tabela spotify_credentials tem RLS
// ligado sem policy, então só o client service_role daqui consegue acessá-la.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Upsert do refresh token. Sempre grava o mais recente para lidar com a
// rotação do Spotify sem perder a credencial válida.
async function saveRefreshToken(admin, userId, refreshToken) {
  const { error } = await admin
    .from('spotify_credentials')
    .upsert(
      {
        user_id: userId,
        provider_refresh_token: refreshToken,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    )
  return error
}

async function refreshAccessToken(admin, userId, storedRefreshToken) {
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID')
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    console.error('SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET não configurados')
    return json({ error: 'Integração com o Spotify não configurada no servidor' }, 500)
  }

  let response
  try {
    response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Basic auth com o segredo só no servidor — nunca devolvido ao cliente.
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: storedRefreshToken
      })
    })
  } catch (err) {
    console.error('Falha de rede ao contatar o Spotify:', err)
    return json({ error: 'Não foi possível contatar o Spotify' }, 502)
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const reason = typeof data?.error === 'string' ? data.error : 'refresh_failed'
    console.error('Spotify recusou a renovação:', response.status, reason)
    const message =
      reason === 'invalid_grant'
        ? 'Credencial do Spotify expirou — é preciso entrar novamente'
        : 'O Spotify recusou a renovação do token'
    // 400 para o problema de credencial; 401 para falha de autenticação do app.
    return json({ error: message, code: reason }, response.status === 400 ? 400 : 401)
  }

  const accessToken = data?.access_token
  if (typeof accessToken !== 'string' || !accessToken) {
    console.error('Resposta do Spotify sem access_token')
    return json({ error: 'Resposta inválida do Spotify' }, 502)
  }

  // O Spotify pode devolver um refresh token novo (rotação): persiste o mais recente.
  const rotatedRefreshToken = data?.refresh_token
  if (typeof rotatedRefreshToken === 'string' && rotatedRefreshToken && rotatedRefreshToken !== storedRefreshToken) {
    const error = await saveRefreshToken(admin, userId, rotatedRefreshToken)
    if (error) console.error('Falha ao rotacionar o refresh token:', error.message)
  }

  return json({ access_token: accessToken, expires_in: data?.expires_in ?? null })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Sessão ausente' }, 401)

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData?.user) {
    return json({ error: 'Sessão inválida ou expirada' }, 401)
  }
  const userId = userData.user.id

  let payload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Corpo JSON inválido' }, 400)
  }

  const action = payload?.action

  if (action === 'store') {
    const refreshToken =
      typeof payload.provider_refresh_token === 'string' ? payload.provider_refresh_token.trim() : ''

    // Fallback: nunca gravar nulo em silêncio — o frontend deve forçar novo consentimento.
    if (!refreshToken) {
      return json(
        { error: 'provider_refresh_token é obrigatório', code: 'missing_refresh_token' },
        400
      )
    }

    const error = await saveRefreshToken(admin, userId, refreshToken)
    if (error) {
      console.error('Falha ao salvar credencial:', error.message)
      return json({ error: 'Falha ao salvar a credencial do Spotify' }, 500)
    }
    return json({ ok: true })
  }

  if (action === 'refresh') {
    const { data: row, error } = await admin
      .from('spotify_credentials')
      .select('provider_refresh_token')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Falha ao ler credencial:', error.message)
      return json({ error: 'Falha ao ler a credencial do Spotify' }, 500)
    }

    // Sem credencial salva: o frontend (#58) deve fazer signOut + signInWithOAuth
    // com show_dialog para obter um novo provider_refresh_token. Nunca falhar em silêncio.
    if (!row?.provider_refresh_token) {
      return json(
        { error: 'Nenhuma credencial do Spotify salva — faça login novamente', code: 'no_credentials' },
        409
      )
    }

    return await refreshAccessToken(admin, userId, row.provider_refresh_token)
  }

  return json({ error: 'Ação inválida' }, 400)
})
