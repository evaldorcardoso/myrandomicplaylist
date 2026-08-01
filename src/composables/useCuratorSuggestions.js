import { ref } from 'vue'
import { TrackRequestService } from '@/services/TrackRequestService'

const CACHE_KEY = 'curator_suggestions'
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000
const MAX_CURATORS = 3

export function useCuratorSuggestions() {
  const suggestions = ref([])
  const { getCurators } = TrackRequestService()

  const readCache = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || !Array.isArray(parsed.curators)) return null
      return parsed
    } catch (error) {
      return null
    }
  }

  const writeCache = (curators) => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ curators, savedAt: Date.now() }))
  }

  const mergeCurators = (...lists) => {
    const counts = {}
    for (const list of lists) {
      for (const name of list ?? []) {
        const trimmed = String(name ?? '').trim()
        if (!trimmed) continue
        counts[trimmed] = (counts[trimmed] ?? 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CURATORS)
      .map(([name]) => name)
  }

  const loadSuggestions = async () => {
    const cache = readCache()
    if (cache && Date.now() - cache.savedAt < CACHE_TTL) {
      suggestions.value = cache.curators
      return suggestions.value
    }
    const { data } = await getCurators()
    const merged = mergeCurators(data, cache?.curators ?? [])
    writeCache(merged)
    suggestions.value = merged
    return merged
  }

  const trackCurator = (name) => {
    const trimmed = String(name ?? '').trim()
    if (!trimmed) return
    const cache = readCache() ?? { curators: [], savedAt: 0 }
    const merged = mergeCurators([trimmed], cache.curators)
    writeCache(merged)
    suggestions.value = merged
  }

  return { suggestions, loadSuggestions, trackCurator }
}
