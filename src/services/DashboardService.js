import { useGeneral } from '@/support/spotifyApi'
import { usePlaylistStore } from '@/stores/playlist'
import { supabase } from '@/support/supabaseClient'
import { getCachedOccupancy, setOccupancy, getCachedEarnings, setEarnings, getCachedExpirationItems, setCachedExpirationItems } from '@/support/occupancyCache'

const TRACK_REQUESTS_TABLE = 'track_requests'

const SECONDS_PER_DAY = 86400
const MAX_EXPIRATIONS = 5
const DUE_DATE_DEADLINE_HOUR = 9
const TIMEZONE_OFFSET = '-03:00'

const formatCurrency = (value) => {
  if (value == null) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const timeAgo = (value) => {
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) return ''
  const diffSeconds = Math.max(0, Math.floor((Date.now() - at.getTime()) / 1000))
  const minutes = Math.floor(diffSeconds / 60)
  if (minutes < 1) return 'agora mesmo'
  if (minutes < 60) return `há ${minutes} minuto${minutes === 1 ? '' : 's'}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} hora${hours === 1 ? '' : 's'}`
  const days = Math.floor(hours / 24)
  return `há ${days} dia${days === 1 ? '' : 's'}`
}

const getTrackCount = (playlist = {}, fallbackLength = 0) => {
  for (const value of [playlist.items, playlist.tracks]) {
    if (value == null) continue
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (Array.isArray(value)) return value.length
    if (typeof value.total === 'number' && Number.isFinite(value.total)) return value.total
    if (Array.isArray(value.items)) return value.items.length
  }
  return fallbackLength
}

const getCurrentTracksMap = async (playlist, playlistStore, getTracks) => {
  const loaded = await playlistStore.getTracks(playlist.id)
  const source = (Array.isArray(loaded) && loaded.length > 0) ? loaded : await getTracks(playlist.id)
  const tracksMap = new Map()
  for (const item of source ?? []) {
    const track = item?.track
    if (!track?.id) continue
    tracksMap.set(track.id, {
      name: track.name ?? null,
      artist: track.artists?.[0]?.name ?? null
    })
  }
  return tracksMap
}

const getCurrentTrackIds = async (playlist, playlistStore, getTracks) => {
  const tracksMap = await getCurrentTracksMap(playlist, playlistStore, getTracks)
  return new Set(tracksMap.keys())
}

const getMonthStart = (year, month) => new Date(year, month, 1)

const sumEarnings = (rows, start, end) => {
  let total = 0
  for (const row of rows) {
    if (row.status !== 'paid' || row.value == null) continue
    const at = new Date(row.created_at)
    if (Number.isNaN(at.getTime())) continue
    if (at >= start && at < end) total += row.value
  }
  return total
}

const mapPlaylist = (playlist, occupancy = {}) => {
  const totalPositions = getTrackCount(playlist, playlist.tracks?.items?.length ?? 0)
  const entry = occupancy[playlist.id] ?? {}
  const filledPositions = Math.min(entry.filled ?? 0, totalPositions)

  return {
    id: playlist.id,
    name: playlist.name,
    tag: playlist.owner?.display_name || 'Curadoria',
    tagTone: 'secondary',
    image: playlist.images?.length > 0 ? playlist.images[0].url : (playlist.image || ''),
    totalPositions,
    filledPositions,
    avgValue: formatCurrency(entry.avgValue)
  }
}

const dashboardData = {
  stats: {
    monthlyEarnings: 'R$ 12.450',
    earningsDelta: '+12.4%',
    earningsDeltaLabel: 'vs mês anterior',
    activePositions: 0,
    occupancyLabel: '0% de ocupação total',
    expiringSoon: 8,
    expiringLabel: 'Ação imediata necessária'
  },
  expirations: [
    {
      id: 'exp-1',
      icon: 'priority_high',
      title: 'FEELINGS',
      subtitle: 'DJ Bella Camargo',
      secondsLeft: 4 * 3600 + 22 * 60 + 15,
      urgent: true
    },
    {
      id: 'exp-2',
      icon: 'schedule',
      title: 'Lushy',
      subtitle: 'Scheid',
      secondsLeft: 18 * 3600 + 10 * 60,
      urgent: false
    }
  ]
}

export function DashboardService() {
  const playlistStore = usePlaylistStore()
  const { getTracks } = useGeneral()

  const loadOccupancy = async () => {
    const cached = getCachedOccupancy()
    if (cached) {
      return cached
    }

    const { data, error } = await supabase
      .from(TRACK_REQUESTS_TABLE)
      .select('playlist_id, track_id, value')

    const byPlaylist = {}
    if (error) {
      console.error(error.message)
      setOccupancy(byPlaylist)
      return byPlaylist
    }

    const requestsByPlaylist = {}
    for (const request of data ?? []) {
      if (!request.playlist_id) continue
      if (!requestsByPlaylist[request.playlist_id]) {
        requestsByPlaylist[request.playlist_id] = []
      }
      requestsByPlaylist[request.playlist_id].push(request)
    }

    for (const playlist of playlistStore.playlists) {
      const requests = requestsByPlaylist[playlist.id]
      if (!requests || requests.length === 0) {
        byPlaylist[playlist.id] = { filled: 0, avgValue: null }
        continue
      }
      const trackIds = await getCurrentTrackIds(playlist, playlistStore, getTracks)
      const matching = requests.filter(request => request.track_id && trackIds.has(request.track_id))
      const avgValue = matching.length
        ? matching.reduce((sum, request) => sum + (request.value ?? 0), 0) / matching.length
        : null
      byPlaylist[playlist.id] = { filled: matching.length, avgValue }
    }

    setOccupancy(byPlaylist)
    return byPlaylist
  }

  const loadEarnings = async () => {
    const cached = getCachedEarnings()
    if (cached) {
      return cached
    }

    const now = new Date()
    const currentStart = getMonthStart(now.getFullYear(), now.getMonth())
    const nextStart = getMonthStart(now.getFullYear(), now.getMonth() + 1)
    const prevStart = getMonthStart(now.getFullYear(), now.getMonth() - 1)

    const { data, error } = await supabase
      .from(TRACK_REQUESTS_TABLE)
      .select('value, status, created_at')
      .gte('created_at', prevStart.toISOString())

    if (error) {
      console.error(error.message)
      return null
    }

    const rows = data ?? []
    const currentTotal = sumEarnings(rows, currentStart, nextStart)
    const previousTotal = sumEarnings(rows, prevStart, currentStart)

    const earnings = {
      monthlyEarnings: formatCurrency(currentTotal),
      earningsDelta: '—',
      earningsDeltaLabel: 'vs mês anterior'
    }

    if (previousTotal > 0) {
      const delta = ((currentTotal - previousTotal) / previousTotal) * 100
      const sign = delta >= 0 ? '+' : ''
      earnings.earningsDelta = `${sign}${delta.toFixed(1)}%`
    } else if (currentTotal > 0) {
      earnings.earningsDelta = '—'
      earnings.earningsDeltaLabel = 'primeiro mês com ganhos'
    }

    setEarnings(earnings)
    return earnings
  }

  const getDueTs = (dueDate) => {
    if (!dueDate) return null
    const deadline = new Date(`${dueDate}T${String(DUE_DATE_DEADLINE_HOUR).padStart(2, '0')}:00:00${TIMEZONE_OFFSET}`)
    const ts = deadline.getTime()
    return Number.isNaN(ts) ? null : ts
  }

  const enrichExpirationItems = (items = []) => {
    const now = Date.now()
    return items
      .filter(expiration => expiration?.dueTs != null)
      .map(expiration => {
        const secondsLeft = Math.max(0, Math.floor((expiration.dueTs - now) / 1000))
        return {
          ...expiration,
          secondsLeft,
          urgent: secondsLeft <= SECONDS_PER_DAY
        }
      })
      .sort((a, b) => a.dueTs - b.dueTs)
  }

  const buildExpirationItems = (items = []) => {
    const enriched = enrichExpirationItems(items)
    const urgentOnly = enriched.filter(expiration => expiration.secondsLeft <= SECONDS_PER_DAY)
    const count = urgentOnly.length
    return {
      stats: {
        expiringSoon: count,
        expiringLabel: count === 0
          ? 'Nenhuma expiração iminente'
          : (count === 1 ? '1 expiração iminente' : `${count} expirações iminentes`)
      },
      expirations: urgentOnly.slice(0, MAX_EXPIRATIONS)
    }
  }

  const buildUpcomingExpirations = (items = [], limit = 3) => {
    return enrichExpirationItems(items)
      .filter(expiration => expiration.secondsLeft > SECONDS_PER_DAY)
      .slice(0, limit)
  }

  const fetchExpirationItems = async () => {
    const { data, error } = await supabase
      .from(TRACK_REQUESTS_TABLE)
      .select('id, playlist_id, track_id, name, due_date, status, requesters(name, curator)')

    if (error) {
      console.error(error.message)
      return []
    }

    const activeRequests = []
    const playlistIds = new Set()

    for (const request of data ?? []) {
      if (request.status !== 'pending' && request.status !== 'paid') continue
      const dueTs = getDueTs(request.due_date)
      if (dueTs == null) continue
      activeRequests.push({ ...request, dueTs })
      playlistIds.add(request.playlist_id)
    }

    const playlistsById = new Map(playlistStore.playlists.map(playlist => [playlist.id, playlist]))
    const tracksByPlaylist = {}

    await Promise.all([...playlistIds].map(async (playlistId) => {
      const playlist = playlistsById.get(playlistId)
      if (!playlist) return
      tracksByPlaylist[playlistId] = await getCurrentTracksMap(playlist, playlistStore, getTracks)
    }))

    const items = []
    for (const request of activeRequests) {
      const tracksMap = tracksByPlaylist[request.playlist_id]
      if (!tracksMap || !tracksMap.has(request.track_id)) continue
      const trackInfo = tracksMap.get(request.track_id)
      const requesterName = request.requesters?.name ?? null
      const curator = request.requesters?.curator ?? null
      const trackName = request.name ?? trackInfo.name
      const title = trackInfo.artist ? `${trackName} — ${trackInfo.artist}` : (trackName ?? 'Faixa')
      const subtitle = curator ? `${requesterName} by ${curator}` : (requesterName ?? '')
      items.push({
        id: String(request.id),
        icon: 'priority_high',
        title,
        subtitle,
        dueTs: request.dueTs
      })
    }

    return items
  }

  const loadExpirationItems = async () => {
    const cached = getCachedExpirationItems()
    if (cached) {
      return cached
    }
    const items = await fetchExpirationItems()
    setCachedExpirationItems(items)
    return items
  }

  const loadExpirations = async () => {
    return buildExpirationItems(await loadExpirationItems())
  }

  const loadUpcomingExpirations = async () => {
    return buildUpcomingExpirations(await loadExpirationItems())
  }

  const loadRecentOrders = async () => {
    const { data, error } = await supabase
      .from(TRACK_REQUESTS_TABLE)
      .select('id, created_at, status, name, requesters(name, curator)')
      .order('created_at', { ascending: false })
      .limit(3)

    if (error) {
      console.error(error.message)
      return []
    }

    return (data ?? []).map(request => {
      const requesterName = request.requesters?.name ?? null
      const curator = request.requesters?.curator ?? null
      const paid = request.status === 'paid'
      return {
        id: String(request.id),
        icon: paid ? 'radio' : 'pending',
        title: request.name ?? 'Faixa',
        subtitle: curator ? `${requesterName} by ${curator}` : (requesterName ?? ''),
        status: paid ? 'PAGO' : 'PENDENTE',
        tone: paid ? 'primary' : 'tertiary',
        time: timeAgo(request.created_at)
      }
    })
  }

  const getDashboardData = async (playlists = [], occupancy = {}, earnings = {}, expirations = {}, upcomingExpirations = [], recentOrders = []) => {
    const mappedPlaylists = playlists.map(playlist => mapPlaylist(playlist, occupancy))
    const totalPositions = mappedPlaylists.reduce((sum, playlist) => sum + playlist.totalPositions, 0)
    const activePositions = mappedPlaylists.reduce((sum, playlist) => sum + playlist.filledPositions, 0)
    const occupancyPercent = totalPositions ? Math.round((activePositions / totalPositions) * 100) : 0

    return {
      ...dashboardData,
      stats: {
        ...dashboardData.stats,
        ...earnings,
        ...(expirations.stats ?? {}),
        activePositions,
        occupancyLabel: `${occupancyPercent}% de ocupação total`
      },
      expirations: expirations.expirations ?? dashboardData.expirations,
      upcomingExpirations,
      recentOrders,
      playlists: mappedPlaylists
    }
  }

  return {
    getDashboardData,
    loadOccupancy,
    loadEarnings,
    loadExpirations,
    loadUpcomingExpirations,
    loadRecentOrders
  }
}
