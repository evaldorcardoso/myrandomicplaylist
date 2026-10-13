import { describe, it, expect } from 'vitest'
import { APP_DEVICE_NAME, isAppDevice, markAppDevice } from '@/support/webPlayback'

const devices = [
  { id: 'phone-1', name: 'iPhone', type: 'Smartphone', is_active: true },
  { id: 'app-1', name: 'MR Playlist', type: 'Computer', is_active: false }
]

describe('webPlayback · isAppDevice', () => {
  it('reconhece o dispositivo do app pelo id retornado no evento ready', () => {
    expect(isAppDevice(devices[1], 'app-1')).toBe(true)
  })

  it('não confunde outros dispositivos', () => {
    expect(isAppDevice(devices[0], 'app-1')).toBe(false)
  })

  it('devolve false sem id do app ou sem dispositivo', () => {
    expect(isAppDevice(devices[1], null)).toBe(false)
    expect(isAppDevice(null, 'app-1')).toBe(false)
  })
})

describe('webPlayback · markAppDevice', () => {
  it('marca apenas o dispositivo do app, preservando os demais campos', () => {
    const marked = markAppDevice(devices, 'app-1')

    expect(marked).toHaveLength(2)
    expect(marked[0]).toMatchObject({ id: 'phone-1', is_app_device: false })
    expect(marked[1]).toMatchObject({ id: 'app-1', is_app_device: true, name: APP_DEVICE_NAME })
  })

  it('não marca nada sem id do app', () => {
    expect(markAppDevice(devices, null).every(d => d.is_app_device === false)).toBe(true)
  })

  it('devolve lista vazia para entrada ausente', () => {
    expect(markAppDevice(undefined, 'app-1')).toEqual([])
  })

  it('não muta a lista original', () => {
    const marked = markAppDevice(devices, 'app-1')
    expect(marked).not.toBe(devices)
    expect(devices[1].is_app_device).toBeUndefined()
  })
})
