const SECONDS_PER_HOUR = 3600
const SECONDS_PER_DAY = 86400
const TRACK_SLOT_VALUES = ['R$ 120,00', 'R$ 65,00', 'R$ 80,00', 'R$ 46,00', 'R$ 26,00']

const hashString = (value) => {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) >>> 0
  }
  return hash
}

const getTrackSlot = (track, index) => {
  const uri = track?.track?.uri ?? track?.uri ?? String(index)
  const roll = hashString(uri) % 10
  const status = roll < 6 ? 'Comprada' : roll < 8 ? 'Aguardando' : 'Orgânica'

  let secondsLeft = null
  if (status === 'Comprada') {
    secondsLeft = ((hashString(uri + ':expires') % 48) + 1) * SECONDS_PER_HOUR
  } else if (status === 'Aguardando') {
    secondsLeft = ((hashString(uri + ':pending') % 30) + 2) * SECONDS_PER_DAY
  }

  return {
    value: status === 'Orgânica' ? '-' : TRACK_SLOT_VALUES[index % TRACK_SLOT_VALUES.length],
    status,
    secondsLeft,
    urgent: status === 'Comprada' && secondsLeft < 24 * SECONDS_PER_HOUR
  }
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

const getPlaylistDetails = (playlist = null, tracksLength = 0) => {
  playlist = playlist ?? {}
  const totalPositions = getTrackCount(playlist, tracksLength)
  const filledPositions = Math.min(totalPositions, Math.round(totalPositions * 0.8))

  return {
    totalPositions,
    filledPositions,
    monthlyRevenue: 'R$ 1.840,00',
    growth: '+12.4%'
  }
}

const getAudience = () => [
  { label: 'Brasil (Top)', value: 64, tone: 'primary' },
  { label: 'EUA', value: 12, tone: 'secondary' }
]

export function PlaylistDetailsService() {
  return {
    getTrackSlot,
    getPlaylistDetails,
    getAudience
  }
}
