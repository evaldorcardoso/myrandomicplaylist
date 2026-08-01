const SECONDS_PER_HOUR = 3600
const SECONDS_PER_DAY = 86400
const DUE_DATE_DEADLINE_HOUR = 9
const TIMEZONE_OFFSET = '-03:00'

const formatCurrency = (value) => {
  if (value == null) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const getTrackSlot = (track, index, request = null) => {
  if (!request) {
    return { value: '-', status: 'free', secondsLeft: null, urgent: false }
  }

  let secondsLeft = null
  if (request.due_date) {
    const deadline = new Date(`${request.due_date}T${String(DUE_DATE_DEADLINE_HOUR).padStart(2, '0')}:00:00${TIMEZONE_OFFSET}`)
    secondsLeft = Math.floor((deadline.getTime() - Date.now()) / 1000)
  }

  return {
    value: formatCurrency(request.value),
    status: request.status,
    secondsLeft,
    urgent: secondsLeft != null && secondsLeft <= 24 * SECONDS_PER_HOUR
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
