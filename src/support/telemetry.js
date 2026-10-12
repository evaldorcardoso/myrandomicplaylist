import { supabase } from '@/support/supabaseClient'

// Telemetria mínima de produto (Fase 0.7 — issue #63).
// Contrato: `track(event, props)` é best-effort — nunca deve quebrar o app.
// `session_id` é um uuid por carregamento de página, guardado em sessionStorage
// e anexado a todo evento.

export const PRODUCT_EVENTS_TABLE = 'product_events'
export const SESSION_STORAGE_KEY = 'mrplaylist.session_id'

export const EVENTS = {
  PLAYLIST_LOAD: 'playlist_load',
  ERROR: 'error',
  RENEWAL_STARTED: 'renewal_started',
  RENEWAL_COMPLETED: 'renewal_completed'
}

export const createSessionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

// Fallback em memória para quando sessionStorage não está disponível
// (modo privado, quota, ambiente sem DOM): garante um único session_id
// por carregamento de página mesmo sem storage.
let memorySessionId = null

const resolveStorage = () => {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    return null
  }
}

export const getSessionId = (storage = resolveStorage()) => {
  if (storage) {
    try {
      const existing = storage.getItem(SESSION_STORAGE_KEY)
      if (existing) return existing
      const id = createSessionId()
      storage.setItem(SESSION_STORAGE_KEY, id)
      return id
    } catch {
      // Storage inacessível: usa o fallback em memória abaixo.
    }
  }
  if (!memorySessionId) memorySessionId = createSessionId()
  return memorySessionId
}

export const createTracker = ({ client = supabase, storage = resolveStorage() } = {}) => {
  const track = async (event, props = {}) => {
    if (!event) return
    try {
      const { error } = await client.from(PRODUCT_EVENTS_TABLE).insert({
        session_id: getSessionId(storage),
        event,
        props: props ?? {}
      })
      if (error) console.error('Falha ao gravar telemetria:', event, error.message ?? error)
    } catch (error) {
      console.error('Falha ao gravar telemetria:', event, error?.message ?? error)
    }
  }

  return { track, getSessionId: () => getSessionId(storage) }
}

const defaultTracker = createTracker()

export const track = defaultTracker.track
