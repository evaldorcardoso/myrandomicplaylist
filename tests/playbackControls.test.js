import { describe, it, expect } from 'vitest'
import {
  clampVolume,
  toVolumePercent,
  volumeFromPercent,
  seekPositionFromPercent,
  isIosLikePlatform,
  canControlLocalVolume,
  resolveControlTarget,
} from '@/support/playbackControls'

// UAs reais (resumidos) para a marcação de iOS/iPadOS.
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
const IPOD_UA = 'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
const CHROME_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

describe('playbackControls · clampVolume', () => {
  it('mantém um volume válido entre 0 e 1', () => {
    expect(clampVolume(0.5)).toBe(0.5)
    expect(clampVolume(0)).toBe(0)
    expect(clampVolume(1)).toBe(1)
  })

  it('limita valores fora do intervalo', () => {
    expect(clampVolume(1.5)).toBe(1)
    expect(clampVolume(-0.5)).toBe(0)
  })

  it('trata valores ausentes ou inválidos como zero', () => {
    expect(clampVolume(undefined)).toBe(0)
    expect(clampVolume(null)).toBe(0)
    expect(clampVolume(NaN)).toBe(0)
    expect(clampVolume('0.5')).toBe(0)
  })
})

describe('playbackControls · conversão de volume', () => {
  it('converte o volume do SDK (0..1) em percentual (0..100)', () => {
    expect(toVolumePercent(0.8)).toBe(80)
    expect(toVolumePercent(0)).toBe(0)
    expect(toVolumePercent(1)).toBe(100)
  })

  it('arredonda o percentual para o inteiro mais próximo', () => {
    expect(toVolumePercent(0.805)).toBe(81)
    expect(toVolumePercent(0.804)).toBe(80)
  })

  it('converte o percentual da UI de volta para o volume do SDK', () => {
    expect(volumeFromPercent(80)).toBe(0.8)
    expect(volumeFromPercent(0)).toBe(0)
    expect(volumeFromPercent(100)).toBe(1)
  })

  it('limita o percentual fora do intervalo', () => {
    expect(volumeFromPercent(150)).toBe(1)
    expect(volumeFromPercent(-20)).toBe(0)
  })

  it('trata percentual ausente ou inválido como zero', () => {
    expect(volumeFromPercent(undefined)).toBe(0)
    expect(volumeFromPercent(NaN)).toBe(0)
  })
})

describe('playbackControls · seekPositionFromPercent', () => {
  it('converte o percentual da barra em posição em ms', () => {
    expect(seekPositionFromPercent(50, 200000)).toBe(100000)
    expect(seekPositionFromPercent(0, 200000)).toBe(0)
    expect(seekPositionFromPercent(100, 200000)).toBe(200000)
  })

  it('limita o percentual fora do intervalo', () => {
    expect(seekPositionFromPercent(150, 200000)).toBe(200000)
    expect(seekPositionFromPercent(-10, 200000)).toBe(0)
  })

  it('arredonda a posição para o inteiro mais próximo', () => {
    expect(seekPositionFromPercent(33, 1000)).toBe(330)
  })

  it('devolve null quando não há duração para calcular a posição', () => {
    expect(seekPositionFromPercent(50, 0)).toBeNull()
    expect(seekPositionFromPercent(50, undefined)).toBeNull()
    expect(seekPositionFromPercent(50, null)).toBeNull()
  })

  it('trata percentual inválido como o início da faixa', () => {
    expect(seekPositionFromPercent(NaN, 200000)).toBe(0)
  })
})

describe('playbackControls · isIosLikePlatform', () => {
  it('reconhece iPhone, iPad e iPod', () => {
    expect(isIosLikePlatform({ userAgent: IPHONE_UA })).toBe(true)
    expect(isIosLikePlatform({ userAgent: IPAD_UA })).toBe(true)
    expect(isIosLikePlatform({ userAgent: IPOD_UA })).toBe(true)
  })

  it('reconhece o iPadOS 13+ que se disfarça de macOS (pelo toque)', () => {
    expect(isIosLikePlatform({ userAgent: MAC_UA, maxTouchPoints: 5 })).toBe(true)
  })

  it('não confunde um Mac de verdade (sem toque)', () => {
    expect(isIosLikePlatform({ userAgent: MAC_UA, maxTouchPoints: 0 })).toBe(false)
  })

  it('não marca desktops/Android', () => {
    expect(isIosLikePlatform({ userAgent: CHROME_UA })).toBe(false)
  })

  it('devolve false para entrada ausente', () => {
    expect(isIosLikePlatform()).toBe(false)
    expect(isIosLikePlatform({})).toBe(false)
  })
})

describe('playbackControls · canControlLocalVolume', () => {
  it('não permite controlar o volume local em iOS', () => {
    expect(canControlLocalVolume({ userAgent: IPHONE_UA })).toBe(false)
    expect(canControlLocalVolume({ userAgent: IPAD_UA })).toBe(false)
  })

  it('permite controlar o volume local em desktops', () => {
    expect(canControlLocalVolume({ userAgent: CHROME_UA })).toBe(true)
    expect(canControlLocalVolume({})).toBe(true)
  })
})

describe('playbackControls · resolveControlTarget', () => {
  it('usa os controles locais quando o app é o player ativo', () => {
    expect(resolveControlTarget({ appDeviceActive: true })).toBe('local')
  })

  it('usa a API REST quando outro aparelho está ativo', () => {
    expect(resolveControlTarget({ appDeviceActive: false })).toBe('remote')
  })

  it('cai no REST sem informação de dispositivo ativo', () => {
    expect(resolveControlTarget()).toBe('remote')
    expect(resolveControlTarget({})).toBe('remote')
  })
})
