const CACHE_KEY = 'dashboard_occupancy'
const EARNINGS_CACHE_KEY = 'dashboard_earnings'
const EXPIRATIONS_CACHE_KEY = 'dashboard_expirations_v3'
const LEGACY_EXPIRATIONS_CACHE_KEY = 'dashboard_expirations'
const CACHE_TTL_MS = 60 * 60 * 1000
const EXPIRATIONS_CACHE_TTL_MS = 6 * 60 * 60 * 1000

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

const getCachedEarnings = () => {
  try {
    const raw = localStorage.getItem(EARNINGS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.updatedAt !== 'number') return null
    if (Date.now() - parsed.updatedAt >= CACHE_TTL_MS) return null
    return parsed.earnings ?? null
  } catch (error) {
    return null
  }
}

const setEarnings = (earnings) => {
  try {
    localStorage.setItem(EARNINGS_CACHE_KEY, JSON.stringify({
      updatedAt: Date.now(),
      earnings: earnings ?? {}
    }))
  } catch (error) {
    console.error(error)
  }
}

const invalidateOccupancy = () => {
  try {
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(EARNINGS_CACHE_KEY)
    localStorage.removeItem(EXPIRATIONS_CACHE_KEY)
    localStorage.removeItem(LEGACY_EXPIRATIONS_CACHE_KEY)
  } catch (error) {
    console.error(error)
  }
}

const getCachedExpirationItems = () => {
  try {
    const raw = localStorage.getItem(EXPIRATIONS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.updatedAt !== 'number') return null
    if (Date.now() - parsed.updatedAt >= EXPIRATIONS_CACHE_TTL_MS) return null
    return Array.isArray(parsed.items) ? parsed.items : null
  } catch (error) {
    return null
  }
}

const setCachedExpirationItems = (items) => {
  try {
    localStorage.setItem(EXPIRATIONS_CACHE_KEY, JSON.stringify({
      updatedAt: Date.now(),
      items: items ?? []
    }))
  } catch (error) {
    console.error(error)
  }
}

export { getCachedOccupancy, setOccupancy, getCachedEarnings, setEarnings, invalidateOccupancy, getCachedExpirationItems, setCachedExpirationItems }
