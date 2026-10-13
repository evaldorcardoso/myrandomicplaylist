import { describe, it, expect, vi, beforeEach } from 'vitest'

// Evita instanciar o client real do Supabase só para exercitar o helper de auth.
vi.mock('@/support/supabaseClient', () => ({
  supabase: { auth: { signInWithOAuth: vi.fn(() => Promise.resolve({ data: {}, error: null })) } }
}))

import { supabase } from '@/support/supabaseClient'
import {
  SPOTIFY_SCOPES,
  SPOTIFY_SCOPE_STRING,
  signInWithSpotify
} from '@/support/spotifyAuth'

describe('spotifyAuth · escopos', () => {
  it('solicita o escopo de reprodução no login', () => {
    expect(SPOTIFY_SCOPES).toContain('streaming')
  })

  it('mantém os escopos anteriores e serializa em espaço', () => {
    expect(SPOTIFY_SCOPES).toContain('user-read-private')
    expect(SPOTIFY_SCOPES).toContain('user-modify-playback-state')
    expect(SPOTIFY_SCOPE_STRING).toBe(SPOTIFY_SCOPES.join(' '))
  })

  it('não repete escopos', () => {
    expect(new Set(SPOTIFY_SCOPES).size).toBe(SPOTIFY_SCOPES.length)
  })
})

describe('spotifyAuth · signInWithSpotify', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'https://app.test' } })
    supabase.auth.signInWithOAuth.mockClear()
  })

  it('usa o provider Spotify com os escopos e o redirect padrão', async () => {
    await signInWithSpotify()

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'spotify',
      options: {
        scopes: SPOTIFY_SCOPE_STRING,
        redirectTo: 'https://app.test/callback'
      }
    })
  })

  it('respeita um redirect customizado', async () => {
    await signInWithSpotify({ redirectTo: 'https://app.test/volta' })
    expect(supabase.auth.signInWithOAuth.mock.calls[0][0].options.redirectTo).toBe('https://app.test/volta')
  })

  it('não força o consentimento por padrão', async () => {
    await signInWithSpotify()
    expect(supabase.auth.signInWithOAuth.mock.calls[0][0].options.queryParams).toBeUndefined()
  })

  it('força a tela de consentimento quando pedido (conceder o escopo novo uma vez)', async () => {
    await signInWithSpotify({ forceConsent: true })
    expect(supabase.auth.signInWithOAuth.mock.calls[0][0].options.queryParams).toEqual({ show_dialog: 'true' })
  })
})
