import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getCachedOccupancy,
  setOccupancy,
  getCachedEarnings,
  setEarnings,
  invalidateOccupancy,
  getCachedExpirationItems,
  setCachedExpirationItems
} from '@/support/occupancyCache'

// As heurísticas leem/escrevem `localStorage`; um stub em memória mantém os
// testes determinísticos e independentes do ambiente.
const store = new Map()
const localStorageStub = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => {
    store.set(key, String(value))
  },
  removeItem: (key) => {
    store.delete(key)
  },
  clear: () => store.clear()
}

vi.stubGlobal('localStorage', localStorageStub)

// Chaves espelhadas de `support/occupancyCache.js`; centralizadas aqui para
// reduzir risco de typo divergindo silenciosamente da implementação.
const KEYS = {
  occupancy: 'dashboard_occupancy',
  earnings: 'dashboard_earnings',
  expirations: 'dashboard_expirations_v5',
  legacyExpirations: 'dashboard_expirations'
}

const HOUR_MS = 60 * 60 * 1000

beforeEach(() => {
  store.clear()
})

describe('occupancy cache', () => {
  it('devolve null quando não há cache', () => {
    expect(getCachedOccupancy()).toBeNull()
  })

  it('grava e lê a ocupação por playlist', () => {
    setOccupancy({ p1: { total: 10, occupied: 4 } })
    expect(getCachedOccupancy()).toEqual({ p1: { total: 10, occupied: 4 } })
  })

  it('normaliza ausência de dados para objeto vazio', () => {
    setOccupancy(null)
    expect(getCachedOccupancy()).toEqual({})
  })

  it('expira o cache após o TTL de 1 hora', () => {
    localStorage.setItem(KEYS.occupancy, JSON.stringify({
      updatedAt: Date.now() - 2 * HOUR_MS,
      byPlaylist: { p1: {} }
    }))
    expect(getCachedOccupancy()).toBeNull()
  })

  it('mantém o cache dentro do TTL', () => {
    localStorage.setItem(KEYS.occupancy, JSON.stringify({
      updatedAt: Date.now() - 30 * 60 * 1000,
      byPlaylist: { p1: { total: 1 } }
    }))
    expect(getCachedOccupancy()).toEqual({ p1: { total: 1 } })
  })

  it('ignora JSON corrompido', () => {
    localStorage.setItem(KEYS.occupancy, '{not-json')
    expect(getCachedOccupancy()).toBeNull()
  })

  it('ignora cache sem updatedAt numérico', () => {
    localStorage.setItem(KEYS.occupancy, JSON.stringify({ byPlaylist: { p1: {} } }))
    expect(getCachedOccupancy()).toBeNull()
  })

  it('ignora byPlaylist que não é objeto', () => {
    localStorage.setItem(KEYS.occupancy, JSON.stringify({
      updatedAt: Date.now(),
      byPlaylist: 'nope'
    }))
    expect(getCachedOccupancy()).toBeNull()
  })
})

describe('earnings cache', () => {
  it('grava e lê os ganhos', () => {
    setEarnings({ total: 123.45 })
    expect(getCachedEarnings()).toEqual({ total: 123.45 })
  })

  it('expira após o TTL de 1 hora', () => {
    localStorage.setItem(KEYS.earnings, JSON.stringify({
      updatedAt: Date.now() - 2 * HOUR_MS,
      earnings: { total: 1 }
    }))
    expect(getCachedEarnings()).toBeNull()
  })

  it('devolve null quando não há cache', () => {
    expect(getCachedEarnings()).toBeNull()
  })
})

describe('expirations cache', () => {
  it('grava e lê a lista de expirações', () => {
    setCachedExpirationItems([{ id: 't1' }, { id: 't2' }])
    expect(getCachedExpirationItems()).toEqual([{ id: 't1' }, { id: 't2' }])
  })

  it('expira após o TTL de 6 horas', () => {
    localStorage.setItem(KEYS.expirations, JSON.stringify({
      updatedAt: Date.now() - 7 * HOUR_MS,
      items: [{ id: 't1' }]
    }))
    expect(getCachedExpirationItems()).toBeNull()
  })

  it('mantém dentro do TTL de 6 horas', () => {
    localStorage.setItem(KEYS.expirations, JSON.stringify({
      updatedAt: Date.now() - 5 * HOUR_MS,
      items: [{ id: 't1' }]
    }))
    expect(getCachedExpirationItems()).toEqual([{ id: 't1' }])
  })

  it('ignora cache cujo items não é array', () => {
    localStorage.setItem(KEYS.expirations, JSON.stringify({
      updatedAt: Date.now(),
      items: { nope: true }
    }))
    expect(getCachedExpirationItems()).toBeNull()
  })
})

describe('invalidateOccupancy (limpa todos os caches do dashboard)', () => {
  it('remove os caches de ocupação, ganhos e expirações (incluindo a chave legada)', () => {
    setOccupancy({ p1: {} })
    setEarnings({ total: 1 })
    setCachedExpirationItems([{ id: 't1' }])
    localStorage.setItem(KEYS.legacyExpirations, JSON.stringify({ updatedAt: Date.now(), items: [] }))

    invalidateOccupancy()

    expect(getCachedOccupancy()).toBeNull()
    expect(getCachedEarnings()).toBeNull()
    expect(getCachedExpirationItems()).toBeNull()
    expect(localStorage.getItem(KEYS.legacyExpirations)).toBeNull()
  })
})
