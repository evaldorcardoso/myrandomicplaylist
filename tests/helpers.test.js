import { describe, it, expect, vi } from 'vitest'
import { hexToRgba } from '@/support/helpers'

// `helpers.js` importa o client Supabase (com efeito colateral de inicialização)
// e o gerenciador de token; para testar só a heurística pura, isolamos os dois.
// (o `vi.mock` é hoisted acima dos imports).
vi.mock('@/support/supabaseClient', () => ({
  supabase: { auth: { signOut: vi.fn() } }
}))
vi.mock('@/support/spotifyToken', () => ({
  clearSpotifyToken: vi.fn()
}))

describe('hexToRgba', () => {
  it('converte hex de 6 dígitos para rgba com alpha padrão (0.7)', () => {
    expect(hexToRgba('#ffffff')).toBe('rgba(255, 255, 255, 0.7)')
  })

  it('aceita hex sem o "#"', () => {
    expect(hexToRgba('ff0000')).toBe('rgba(255, 0, 0, 0.7)')
  })

  it('respeita o alpha informado', () => {
    expect(hexToRgba('#000000', 0.25)).toBe('rgba(0, 0, 0, 0.25)')
    expect(hexToRgba('#123456', 1)).toBe('rgba(18, 52, 86, 1)')
  })

  it('devolve null para hex inválido (tamanho diferente de 6)', () => {
    expect(hexToRgba('#abc')).toBeNull()
    expect(hexToRgba('#abcdef0')).toBeNull()
  })
})
