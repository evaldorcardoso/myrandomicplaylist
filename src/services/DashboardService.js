const mockAvgValues = ['R$ 180,00', 'R$ 150,00', 'R$ 250,00', 'R$ 120,00']

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

const mapPlaylist = (playlist, index) => {
  const totalPositions = getTrackCount(playlist, playlist.tracks?.items?.length ?? 0)
  const filledPositions = Math.min(totalPositions, Math.round(totalPositions * 0.8))

  return {
    id: playlist.id,
    name: playlist.name,
    tag: playlist.owner?.display_name || 'Curadoria',
    tagTone: 'secondary',
    image: playlist.images?.length > 0 ? playlist.images[0].url : (playlist.image || ''),
    totalPositions,
    filledPositions,
    avgValue: mockAvgValues[index % mockAvgValues.length]
  }
}

const dashboardData = {
  stats: {
    monthlyEarnings: 'R$ 12.450',
    earningsDelta: '+12.4%',
    earningsDeltaLabel: 'vs mês anterior',
    activePositions: 142,
    occupancyLabel: '88% de ocupação total',
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
  const getDashboardData = async (playlists = []) => {
    return {
      ...dashboardData,
      playlists: playlists.map(mapPlaylist)
    }
  }

  return {
    getDashboardData
  }
}
