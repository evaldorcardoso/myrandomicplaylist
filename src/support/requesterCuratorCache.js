const CACHE_KEY = 'requester_curator_map'

const normalizeName = (name) => String(name ?? '').trim().toLowerCase()

const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    return {}
  }
}

const writeCache = (map) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(map))
  } catch (error) {
    console.error(error)
  }
}

const readEntry = (map, key) => {
  const raw = map[key]
  if (raw === undefined || raw === null) return null
  if (typeof raw === 'string') return { id: null, curator: raw }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return {
      id: raw.id ?? null,
      curator: typeof raw.curator === 'string' ? raw.curator.trim() : null
    }
  }
  return null
}

const setRequester = (name, id, curator) => {
  const key = normalizeName(name)
  if (!key) return
  const map = readCache()
  map[key] = {
    id: id ?? null,
    curator: String(curator ?? '').trim() || null
  }
  writeCache(map)
}

const setCurator = (name, curator) => {
  const key = normalizeName(name)
  if (!key) return
  const map = readCache()
  const entry = readEntry(map, key)
  map[key] = {
    id: entry?.id ?? null,
    curator: String(curator ?? '').trim() || null
  }
  writeCache(map)
}

const getCachedCurator = (name) => {
  const key = normalizeName(name)
  if (!key) return { cached: false, curator: null }
  const map = readCache()
  if (!Object.prototype.hasOwnProperty.call(map, key)) return { cached: false, curator: null }
  return { cached: true, curator: readEntry(map, key)?.curator ?? null }
}

const getCachedRequester = (name) => {
  const key = normalizeName(name)
  if (!key) return { cached: false, id: null, curator: null }
  const map = readCache()
  if (!Object.prototype.hasOwnProperty.call(map, key)) return { cached: false, id: null, curator: null }
  const entry = readEntry(map, key)
  return { cached: true, id: entry?.id ?? null, curator: entry?.curator ?? null }
}

export { setCurator, setRequester, getCachedCurator, getCachedRequester }
