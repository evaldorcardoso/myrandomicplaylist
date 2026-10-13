// Autenticação do Spotify no cliente (#66).
//
// Centraliza os escopos do OAuth e o disparo do login para que o pedido de
// consentimento de reprodução — `streaming`, exigido pelo Web Playback SDK —
// seja feito de um único lugar, tanto no login normal quanto na reconexão que
// força a tela de consentimento uma vez.

import { supabase } from '@/support/supabaseClient'

// `streaming` habilita o Web Playback SDK (o app como dispositivo Connect).
export const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-top-read',
  'streaming',
]

export const SPOTIFY_SCOPE_STRING = SPOTIFY_SCOPES.join(' ')

// A resposta do Spotify traz `scope` como string separada por espaços. Estes
// helpers puros decidem se o escopo de reprodução (`streaming`) foi de fato
// concedido — o token antigo (concedido antes do escopo existir) não o carrega.
export const parseScopes = (scope) =>
  typeof scope === 'string' ? scope.split(/\s+/).filter(Boolean) : []

export const hasStreamingScope = (scope) => parseScopes(scope).includes('streaming')

const defaultRedirectTo = () =>
  typeof window !== 'undefined' ? `${window.location.origin}/callback` : '/callback'

// `forceConsent` reabre a tela de consentimento do Spotify (`show_dialog`).
// Necessário uma única vez para conceder o escopo `streaming` em sessões que já
// foram autorizadas antes dele existir; nas demais, o login reaproveita o
// consentimento guardado.
export const signInWithSpotify = ({ forceConsent = false, redirectTo } = {}) => {
  const options = {
    scopes: SPOTIFY_SCOPE_STRING,
    redirectTo: redirectTo ?? defaultRedirectTo(),
  }
  if (forceConsent) {
    options.queryParams = { show_dialog: 'true' }
  }
  return supabase.auth.signInWithOAuth({ provider: 'spotify', options })
}
