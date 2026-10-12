import { describe, it, expect, vi, beforeEach } from 'vitest'

// Evita instanciar o client real só para importar o helper.
vi.mock('@/support/supabaseClient', () => ({
  supabase: { from: vi.fn() }
}))

import {
  createTracker,
  getSessionId,
  createSessionId,
  SESSION_STORAGE_KEY,
  PRODUCT_EVENTS_TABLE
} from '@/support/telemetry'

// Fake de sessionStorage (só os métodos usados pelo helper).
const createStorage = (initial = {}) => {
  const store = { ...initial }
  return {
    getItem: vi.fn(key => (key in store ? store[key] : null)),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    store
  }
}

// Fake do client Supabase: captura os inserts e permite forçar erro.
const createClient = ({ error = null, reject = false } = {}) => {
  const insert = reject
    ? vi.fn(() => Promise.reject(new Error('boom')))
    : vi.fn(() => Promise.resolve({ error }))
  return {
    from: vi.fn(() => ({ insert })),
    insert
  }
}

describe('telemetry · session_id', () => {
  it('gera um uuid válido quando não há session_id salvo', () => {
    const id = createSessionId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('reaproveita o session_id existente no storage', () => {
    const storage = createStorage({ [SESSION_STORAGE_KEY]: '11111111-1111-4111-8111-111111111111' })
    expect(getSessionId(storage)).toBe('11111111-1111-4111-8111-111111111111')
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('persiste o session_id novo no storage', () => {
    const storage = createStorage()
    const id = getSessionId(storage)
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(storage.setItem).toHaveBeenCalledWith(SESSION_STORAGE_KEY, id)
  })

  it('devolve um uuid mesmo sem storage disponível', () => {
    expect(getSessionId(null)).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('mantém o mesmo session_id sem storage (fallback em memória)', () => {
    expect(getSessionId(null)).toBe(getSessionId(null))
  })

  it('cai para o fallback em memória quando o storage lança', () => {
    const brokenStorage = {
      getItem: () => { throw new Error('private mode') },
      setItem: () => { throw new Error('private mode') }
    }
    expect(getSessionId(brokenStorage)).toBe(getSessionId(brokenStorage))
  })
})

describe('telemetry · track()', () => {
  let storage
  let client

  beforeEach(() => {
    storage = createStorage({ [SESSION_STORAGE_KEY]: '22222222-2222-4222-8222-222222222222' })
    client = createClient()
  })

  it('grava o evento na tabela product_events', async () => {
    const { track } = createTracker({ client, storage })
    await track('playlist_load', { playlist_id: 'abc', tracks: 10, ms: 42 })

    expect(client.from).toHaveBeenCalledWith(PRODUCT_EVENTS_TABLE)
    expect(client.insert).toHaveBeenCalledWith({
      session_id: '22222222-2222-4222-8222-222222222222',
      event: 'playlist_load',
      props: { playlist_id: 'abc', tracks: 10, ms: 42 }
    })
  })

  it('anexa o session_id a todo evento', async () => {
    const { track } = createTracker({ client, storage })
    await track('error', { scope: 'app', message: 'x' })
    await track('renewal_started', { track_request_id: 1, playlist_id: 'p' })

    expect(client.insert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      session_id: '22222222-2222-4222-8222-222222222222', event: 'error'
    }))
    expect(client.insert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      session_id: '22222222-2222-4222-8222-222222222222', event: 'renewal_started'
    }))
  })

  it('usa props vazio por padrão', async () => {
    const { track } = createTracker({ client, storage })
    await track('renewal_completed', { track_request_id: 7, type: 'renewal' })
    expect(client.insert).toHaveBeenCalledWith(expect.objectContaining({ props: { track_request_id: 7, type: 'renewal' } }))

    client.insert.mockClear()
    await track('renewal_completed')
    expect(client.insert).toHaveBeenCalledWith(expect.objectContaining({ props: {} }))
  })

  it('não quebra o app quando o insert falha, mas registra o erro', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing = createClient({ reject: true })
    const { track } = createTracker({ client: failing, storage })
    await expect(track('error', { scope: 'x' })).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('não quebra o app quando o client devolve { error }, mas registra o erro', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const withError = createClient({ error: { message: 'rls' } })
    const { track } = createTracker({ client: withError, storage })
    await expect(track('error', {})).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('ignora chamadas sem nome de evento', async () => {
    const { track } = createTracker({ client, storage })
    await track('', {})
    expect(client.insert).not.toHaveBeenCalled()
  })
})
