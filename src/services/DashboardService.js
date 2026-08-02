import { useGeneral } from '@/support/spotifyApi'
import { usePlaylistStore } from '@/stores/playlist'
import { supabase } from '@/support/supabaseClient'
import { getCachedOccupancy, setOccupancy } from '@/support/occupancyCache'

const TRACK_REQUESTS_TABLE = 'track_requests'

const formatCurrency = (value) => {
  if (value == null) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
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

const getCurrentTrackIds = async (playlist, playlistStore, getTracks) => {
  const loaded = await playlistStore.getTracks(playlist.id)
  if (Array.isArray(loaded) && loaded.length > 0) {
    return new Set(loaded.map(track => track.track?.id).filter(Boolean))
  }
  const spotifyTracks = await getTracks(playlist.id)
  return new Set(spotifyTracks.map(item => item.track?.id).filter(Boolean))
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
  recentOrders: [
    {
      id: 'order-1',
      icon: 'radio',
      title: 'Song: Breathless',
      subtitle: 'Monrabeatz by scheid',
      status: 'PAGO',
      tone: 'primary',
      time: 'há 2 horas'
    },
    {
      id: 'order-2',
      icon: 'pending',
      title: 'Song: Midnight City',
      subtitle: 'DJ Luane by scheid',
      status: 'PENDENTE',
      tone: 'tertiary',
      time: 'há 5 horas'
    }
  ],
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

  const getDashboardData = async (playlists = [], occupancy = {}) => {
    const mappedPlaylists = playlists.map(playlist => mapPlaylist(playlist, occupancy))
    const totalPositions = mappedPlaylists.reduce((sum, playlist) => sum + playlist.totalPositions, 0)
    const activePositions = mappedPlaylists.reduce((sum, playlist) => sum + playlist.filledPositions, 0)
    const occupancyPercent = totalPositions ? Math.round((activePositions / totalPositions) * 100) : 0

    return {
      ...dashboardData,
      stats: {
        ...dashboardData.stats,
        activePositions,
        occupancyLabel: `${occupancyPercent}% de ocupação total`
      },
      playlists: mappedPlaylists
    }
  }

  return {
    getDashboardData,
    loadOccupancy
  }
}
