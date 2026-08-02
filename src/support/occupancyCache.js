const CACHE_KEY = 'dashboard_occupancy'
const CACHE_TTL_MS = 60 * 60 * 1000

const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch (error) {
    return null
  }
}

const getCachedOccupancy = () => {
  const cache = readCache()
  if (!cache || typeof cache.updatedAt !== 'number') return null
  if (Date.now() - cache.updatedAt >= CACHE_TTL_MS) return null
  return cache.byPlaylist && typeof cache.byPlaylist === 'object' ? cache.byPlaylist : null
}

const setOccupancy = (byPlaylist) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      updatedAt: Date.now(),
      byPlaylist: byPlaylist ?? {}
    }))
  } catch (error) {
    console.error(error)
  }
}

const invalidateOccupancy = () => {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch (error) {
    console.error(error)
  }
}

export { getCachedOccupancy, setOccupancy, invalidateOccupancy }
