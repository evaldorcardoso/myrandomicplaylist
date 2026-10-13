import { describe, it, expect } from 'vitest'
import {
  PLAYBACK_DEGRADATION,
  resolvePlaybackDegradation,
  shouldOfferConsent
} from '@/support/playbackAvailability'

describe('playbackAvailability · resolvePlaybackDegradation', () => {
  it('não degrada quando a reprodução no app está disponível', () => {
    expect(resolvePlaybackDegradation({ supported: true })).toBeNull()
    expect(resolvePlaybackDegradation({})).toBeNull()
  })

  it('degrada quando o navegador não tem DRM/EME, avisando do controle remoto', () => {
    const result = resolvePlaybackDegradation({ supported: false })

    expect(result.reason).toBe(PLAYBACK_DEGRADATION.UNSUPPORTED)
    expect(result.message).toMatch(/navegador/i)
    expect(result.message).toMatch(/controle remoto/i)
  })

  it('degrada quando a conta não atende ao requisito de reprodução', () => {
    const result = resolvePlaybackDegradation({ accountError: true })

    expect(result.reason).toBe(PLAYBACK_DEGRADATION.ACCOUNT)
    expect(result.message).toMatch(/conta/i)
    expect(result.message).toMatch(/controle remoto/i)
  })

  it('degrada quando o SDK não carrega ou não conecta', () => {
    const result = resolvePlaybackDegradation({ unavailable: true })

    expect(result.reason).toBe(PLAYBACK_DEGRADATION.UNAVAILABLE)
    expect(result.message).toMatch(/controle remoto/i)
  })

  it('prioriza a causa mais específica: navegador, depois conta, depois falha genérica', () => {
    const all = resolvePlaybackDegradation({ supported: false, accountError: true, unavailable: true })
    expect(all.reason).toBe(PLAYBACK_DEGRADATION.UNSUPPORTED)

    const account = resolvePlaybackDegradation({ accountError: true, unavailable: true })
    expect(account.reason).toBe(PLAYBACK_DEGRADATION.ACCOUNT)
  })

  it('devolve uma mensagem distinta por causa', () => {
    const messages = [
      resolvePlaybackDegradation({ supported: false }).message,
      resolvePlaybackDegradation({ accountError: true }).message,
      resolvePlaybackDegradation({ unavailable: true }).message
    ]

    expect(new Set(messages).size).toBe(3)
  })
})

describe('playbackAvailability · shouldOfferConsent', () => {
  it('oferece o consentimento quando falta o escopo e não há degradação', () => {
    expect(shouldOfferConsent({ requiresConsent: true })).toBe(true)
  })

  it('não oferece quando não há pedido pendente', () => {
    expect(shouldOfferConsent({ requiresConsent: false })).toBe(false)
    expect(shouldOfferConsent({})).toBe(false)
  })

  it('não oferece quando o navegador não suporta ou a conta é inelegível', () => {
    const unsupported = { reason: PLAYBACK_DEGRADATION.UNSUPPORTED }
    const account = { reason: PLAYBACK_DEGRADATION.ACCOUNT }

    expect(shouldOfferConsent({ requiresConsent: true, degradation: unsupported })).toBe(false)
    expect(shouldOfferConsent({ requiresConsent: true, degradation: account })).toBe(false)
  })

  it('ainda oferece quando a falha é genérica: pode ser justamente o escopo ausente', () => {
    const unavailable = { reason: PLAYBACK_DEGRADATION.UNAVAILABLE }
    expect(shouldOfferConsent({ requiresConsent: true, degradation: unavailable })).toBe(true)
  })
})
