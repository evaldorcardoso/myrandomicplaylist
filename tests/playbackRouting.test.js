import { describe, it, expect } from 'vitest'
import {
  NO_ACTIVE_DEVICE,
  isNoActiveDeviceError,
  canPlayOnAppDevice
} from '@/support/playbackRouting'

// Erro no formato oficial do Spotify quando não há dispositivo ativo: 404 com
// `reason: "NO_ACTIVE_DEVICE"`. Só nesse caso vale redirecionar para o device do
// app; qualquer outro 404 é outra falha e deve seguir como hoje.
const noActiveDeviceError = {
  response: {
    status: 404,
    data: { error: { status: 404, message: 'Player command failed: No active device found', reason: NO_ACTIVE_DEVICE } }
  }
}

describe('playbackRouting · isNoActiveDeviceError', () => {
  it('reconhece o 404 de dispositivo inativo pelo reason', () => {
    expect(isNoActiveDeviceError(noActiveDeviceError)).toBe(true)
  })

  it('não confunde outros 404 sem o reason específico', () => {
    expect(isNoActiveDeviceError({ response: { status: 404, data: { error: { reason: 'NOT_FOUND' } } } })).toBe(false)
    expect(isNoActiveDeviceError({ response: { status: 404, data: {} } })).toBe(false)
  })

  it('ignora outros status e erros sem resposta', () => {
    expect(isNoActiveDeviceError({ response: { status: 500, data: { error: { reason: NO_ACTIVE_DEVICE } } } })).toBe(false)
    expect(isNoActiveDeviceError(new Error('sem resposta'))).toBe(false)
    expect(isNoActiveDeviceError(undefined)).toBe(false)
  })
})

describe('playbackRouting · canPlayOnAppDevice', () => {
  it('permite quando o device do app está pronto e sem degradação', () => {
    expect(canPlayOnAppDevice({ deviceId: 'app-1', isReady: true, degraded: false })).toBe(true)
  })

  it('bloqueia sem o id do device (SDK ainda não emitiu ready)', () => {
    expect(canPlayOnAppDevice({ deviceId: null, isReady: true, degraded: false })).toBe(false)
  })

  it('bloqueia quando o SDK não está pronto', () => {
    expect(canPlayOnAppDevice({ deviceId: 'app-1', isReady: false, degraded: false })).toBe(false)
  })

  it('bloqueia quando a reprodução no app está degradada', () => {
    expect(canPlayOnAppDevice({ deviceId: 'app-1', isReady: true, degraded: true })).toBe(false)
  })

  it('devolve false sem argumentos', () => {
    expect(canPlayOnAppDevice()).toBe(false)
    expect(canPlayOnAppDevice({})).toBe(false)
  })
})
