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

const setCurator = (name, curator) => {
  const key = normalizeName(name)
  if (!key) return
  const map = readCache()
  map[key] = String(curator ?? '').trim() || null
  writeCache(map)
}

const getCachedCurator = (name) => {
  const key = normalizeName(name)
  if (!key) return { cached: false, curator: null }
  const map = readCache()
  return Object.prototype.hasOwnProperty.call(map, key)
    ? { cached: true, curator: map[key] }
    : { cached: false, curator: null }
}

export { setCurator, getCachedCurator }
