const SECONDS_PER_DAY = 86400
const DUE_DATE_DEADLINE_HOUR = 9
const TIMEZONE_OFFSET = '-03:00'
const DAY_IN_MS = 24 * 60 * 60 * 1000

const formatCurrency = (value) => {
  if (value == null) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const getTrackSlot = (track, index, request = null) => {
  if (!request) {
    return { value: '-', status: 'free', dueTs: null }
  }

  let dueTs = null
  if (request.due_date) {
    const deadline = new Date(`${request.due_date}T${String(DUE_DATE_DEADLINE_HOUR).padStart(2, '0')}:00:00${TIMEZONE_OFFSET}`)
    dueTs = deadline.getTime()
  }

  const expectedPosition = (track?.id ?? 0) + 1
  const storedPosition = request.position ?? null

  return {
    value: formatCurrency(request.value),
    status: request.status,
    dueTs,
    expectedPosition,
    storedPosition,
    positionMismatch: storedPosition != null && storedPosition !== expectedPosition
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

const formatPercent = (percent) => {
  const sign = percent >= 0 ? '+' : ''
  const abs = Math.abs(percent)
  const decimals = abs >= 0.05 ? 1 : (abs >= 0.005 ? 2 : 3)
  return `${sign}${percent.toFixed(decimals)}%`
}

const getGrowth = (likesHistory = [], currentLikes = 0) => {
  if (!Array.isArray(likesHistory) || likesHistory.length === 0) {
    return { days: 0, value: '+0' }
  }
  const now = Date.now()
  const entries = likesHistory
    .map(e => ({ likes: e.likes_count, time: new Date(e.created_at).getTime() }))
    .filter(e => Number.isFinite(e.time))
    .sort((a, b) => a.time - b.time)

  const baseline = entries[entries.length - 1]
  const current = currentLikes ?? baseline.likes
  const days = Math.max(1, Math.round((now - baseline.time) / DAY_IN_MS))
  const delta = current - baseline.likes
  const sign = delta >= 0 ? '+' : ''
  const percent = baseline.likes ? (delta / baseline.likes) * 100 : 0
  const percentText = delta === 0 ? '' : `(${formatPercent(percent)})`
  return {
    days,
    value: `${sign}${Math.round(delta)}${percentText}`
  }
}

const getPlaylistDetails = (playlist = null, tracksLength = 0, filledPositionsCount = 0, monthlyRevenue = 0, growth = { days: 0, value: '+0' }) => {
  playlist = playlist ?? {}
  const totalPositions = getTrackCount(playlist, tracksLength)

  return {
    totalPositions,
    filledPositions: Math.min(filledPositionsCount, totalPositions),
    monthlyRevenue: formatCurrency(monthlyRevenue),
    growth
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
    getGrowth,
    getAudience
  }
}
