// Gerenciador do access token do Spotify (#58).
//
// O navegador nunca vê o client secret nem o refresh token de longa duração do
// Spotify: eles vivem na Edge Function `spotify-token`. Aqui só cacheamos o
// access token curto em memória e pedimos a renovação server-side quando ele
// expira, deduplicando renovações concorrentes.

import { supabase } from './supabaseClient'

const FUNCTION_NAME = 'spotify-token'
// Renova um pouco antes de expirar para não usar um token já vencido numa
// requisição em voo (mesma margem usada pelo fluxo antigo).
const EXPIRY_SAFETY_WINDOW_MS = 400 * 1000
const MIN_TTL_MS = 60 * 1000
const DEFAULT_EXPIRES_IN_S = 3600

let accessToken = null
let expiresAt = 0
let inFlightRefresh = null

export class SpotifyTokenError extends Error {
    constructor(message, { code, status } = {}) {
        super(message)
        this.name = 'SpotifyTokenError'
        this.code = code
        this.status = status
    }
}

// Códigos em que a credencial do Spotify não serve mais: só um novo login resolve.
const REAUTH_CODES = new Set([
    'no_credentials',
    'invalid_grant',
    'invalid_client',
    'missing_refresh_token',
])

// Verdadeiro quando o erro exige refazer o login (e não apenas tentar de novo).
export function requiresReauth(error) {
    if (!(error instanceof SpotifyTokenError)) return false
    if (error.code && REAUTH_CODES.has(error.code)) return true
    return error.status === 401
}

// O functions.invoke devolve `{ data: null, error }` em respostas não-2xx; o
// corpo da Edge Function fica em `error.context` (um Response).
async function toTokenError(error) {
    const response = error?.context
    let payload = null
    if (response && typeof response.json === 'function') {
        try {
            payload = await response.json()
        } catch {
            payload = null
        }
    }
    return new SpotifyTokenError(
        payload?.error || error?.message || 'Falha ao falar com o servidor de token do Spotify',
        { code: payload?.code, status: response?.status }
    )
}

async function invoke(action, body = {}) {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
        body: { action, ...body },
    })
    if (error) throw await toTokenError(error)
    return data
}

async function refreshAccessToken() {
    const data = await invoke('refresh')
    if (!data?.access_token) {
        throw new SpotifyTokenError('Resposta inválida do servidor de token do Spotify')
    }
    if (data.warning) {
        // Rotação do refresh token não pôde ser persistida no servidor.
        console.warn('spotify-token:', data.warning)
    }
    accessToken = data.access_token
    const expiresInSeconds = Number(data.expires_in) || DEFAULT_EXPIRES_IN_S
    const ttl = Math.max(expiresInSeconds * 1000 - EXPIRY_SAFETY_WINDOW_MS, MIN_TTL_MS)
    expiresAt = Date.now() + ttl
    return accessToken
}

// Access token válido, renovando server-side se necessário.
export function getSpotifyToken({ force = false } = {}) {
    if (!force && accessToken && Date.now() < expiresAt) {
        return Promise.resolve(accessToken)
    }
    if (!inFlightRefresh) {
        inFlightRefresh = refreshAccessToken().finally(() => {
            inFlightRefresh = null
        })
    }
    return inFlightRefresh
}

export function clearSpotifyToken() {
    accessToken = null
    expiresAt = 0
    inFlightRefresh = null
}

// Guarda o provider_refresh_token recém-obtido no login (callback do OAuth).
export async function storeProviderRefreshToken(providerRefreshToken) {
    if (!providerRefreshToken) {
        throw new SpotifyTokenError('provider_refresh_token ausente no callback do login')
    }
    await invoke('store', { provider_refresh_token: providerRefreshToken })
    // A credencial mudou: o access token em cache pode ser de outra conta/sessão.
    clearSpotifyToken()
}

// Sessão do Spotify inválida: encerra a sessão Supabase e volta para o login.
export async function reauthenticate() {
    clearSpotifyToken()
    try {
        await supabase.auth.signOut()
    } catch (error) {
        console.error('Falha ao encerrar a sessão Supabase:', error)
    }
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login')
    }
}
