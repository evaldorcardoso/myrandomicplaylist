import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

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

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@mrplaylist.app'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return json({ ok: true })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido' }, 405)
  }

  try {
    const body = await req.json()
    const title = String(body?.title ?? '').trim()
    const messageBody = String(body?.body ?? '').trim()
    const url = String(body?.url ?? '/') || '/'

    if (!title || !messageBody) {
      return json({ error: 'title e body são obrigatórios' }, 400)
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY env vars')
      return json({ error: 'Chaves VAPID não configuradas no servidor' }, 500)
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')

    if (error) {
      console.error('Error fetching subscriptions:', error.message)
      return json({ error: 'Erro ao buscar assinaturas push' }, 500)
    }

    const message = JSON.stringify({ title, body: messageBody, url })
    let sent = 0
    let failed = 0

    for (const subscription of subscriptions ?? []) {
      const sub = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      }
      try {
        await webpush.sendNotification(sub, message)
        sent++
      } catch (err) {
        failed++
        console.error(`Failed to send to ${subscription.endpoint.slice(-20)}: ${err.statusCode} — ${err.message}`)
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint)
        }
      }
    }

    return json({ sent, failed })
  } catch (err) {
    console.error('Fatal error:', err)
    return json({ error: 'Erro interno' }, 500)
  }
})
