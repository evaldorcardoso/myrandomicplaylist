import { describe, it, expect } from 'vitest'
import {
  normalizeTrack,
  normalizeSdkState,
  normalizeRestState,
  resolveNowPlayingSource,
  resolveNowPlaying,
  resolveRawTrack,
  projectPosition,
  shouldFetchTrackMetadata,
  resolveTrackMetadata,
  createTrackMetadataCache
} from '@/support/nowPlaying'

// Payloads no formato oficial do Spotify. O SDK só emite `player_state_changed`
// com `track_window.current_track`; o REST `/me/player` traz `item` (faixa
// completa, com popularidade e data de lançamento).
const sdkState = {
  duration: 210000,
  paused: false,
  position: 42000,
  track_window: {
    current_track: {
      id: 'track-1',
      uri: 'spotify:track:track-1',
      name: 'Faixa Um',
      artists: [{ name: 'Artista A', uri: 'spotify:artist:a' }, { name: 'Artista B' }],
      album: {
        name: 'Álbum X',
        uri: 'spotify:album:x',
        images: [{ url: 'https://img.example/cover.jpg', width: 640, height: 640 }]
      },
      duration_ms: 210000
    },
    next_tracks: [],
    previous_tracks: []
  }
}

const restState = {
  device: { id: 'app-1', is_active: true, name: 'MR Playlist', type: 'Computer' },
  is_playing: true,
  progress_ms: 42000,
  item: {
    id: 'track-1',
    uri: 'spotify:track:track-1',
    name: 'Faixa Um',
    artists: [{ name: 'Artista A' }, { name: 'Artista B' }],
    album: {
      name: 'Álbum X',
      images: [{ url: 'https://img.example/cover.jpg' }],
      release_date: '2024-05-01'
    },
    duration_ms: 210000,
    popularity: 55
  }
}

describe('nowPlaying · normalizeTrack', () => {
  it('normaliza uma faixa do SDK (sem popularidade nem data de lançamento)', () => {
    expect(normalizeTrack(sdkState.track_window.current_track)).toEqual({
      id: 'track-1',
      uri: 'spotify:track:track-1',
      name: 'Faixa Um',
      artists: ['Artista A', 'Artista B'],
      image: 'https://img.example/cover.jpg',
      duration: 210000,
      popularity: null,
      release_date: null
    })
  })

  it('normaliza uma faixa REST, preservando popularidade e data de lançamento', () => {
    expect(normalizeTrack(restState.item)).toMatchObject({
      id: 'track-1',
      artists: ['Artista A', 'Artista B'],
      popularity: 55,
      release_date: '2024-05-01'
    })
  })

  it('devolve null para faixa ausente', () => {
    expect(normalizeTrack(null)).toBeNull()
    expect(normalizeTrack(undefined)).toBeNull()
  })

  it('devolve null para um item que não é faixa tocável (ex.: anúncio local)', () => {
    expect(normalizeTrack({ id: null, name: 'Anúncio' })).toBeNull()
  })
})

describe('nowPlaying · normalizeSdkState', () => {
  it('converte o payload bruto do SDK no formato interno', () => {
    expect(normalizeSdkState(sdkState)).toEqual({
      track: {
        id: 'track-1',
        uri: 'spotify:track:track-1',
        name: 'Faixa Um',
        artists: ['Artista A', 'Artista B'],
        image: 'https://img.example/cover.jpg',
        duration: 210000,
        popularity: null,
        release_date: null
      },
      position: 42000,
      duration: 210000,
      playing: true
    })
  })

  it('traduz `paused` em `playing`', () => {
    expect(normalizeSdkState({ ...sdkState, paused: true }).playing).toBe(false)
  })

  it('devolve null quando não há faixa corrente', () => {
    expect(normalizeSdkState({ track_window: { current_track: null } })).toBeNull()
    expect(normalizeSdkState(null)).toBeNull()
  })
})

describe('nowPlaying · normalizeRestState', () => {
  it('converte o payload REST no formato interno', () => {
    expect(normalizeRestState(restState)).toEqual({
      track: {
        id: 'track-1',
        uri: 'spotify:track:track-1',
        name: 'Faixa Um',
        artists: ['Artista A', 'Artista B'],
        image: 'https://img.example/cover.jpg',
        duration: 210000,
        popularity: 55,
        release_date: '2024-05-01'
      },
      position: 42000,
      duration: 210000,
      playing: true
    })
  })

  it('devolve null quando não há item (nada tocando)', () => {
    expect(normalizeRestState({ is_playing: false, item: null })).toBeNull()
    expect(normalizeRestState(null)).toBeNull()
  })
})

describe('nowPlaying · resolveNowPlayingSource', () => {
  it('usa o SDK quando o dispositivo do app é o ativo', () => {
    expect(resolveNowPlayingSource({
      sdkState,
      restState,
      appDeviceId: 'app-1'
    })).toBe('sdk')
  })

  it('usa o REST quando o dispositivo ativo é outro', () => {
    expect(resolveNowPlayingSource({
      sdkState,
      restState: { ...restState, device: { id: 'phone-1', is_active: true } },
      appDeviceId: 'app-1'
    })).toBe('rest')
  })

  it('usa o REST quando o id do app ainda não é conhecido', () => {
    expect(resolveNowPlayingSource({
      sdkState,
      restState,
      appDeviceId: null
    })).toBe('rest')
  })

  it('não usa o SDK se o app é o ativo mas ainda não houve evento do SDK', () => {
    expect(resolveNowPlayingSource({
      sdkState: null,
      restState,
      appDeviceId: 'app-1'
    })).toBe('rest')
  })

  it('devolve null sem estado algum', () => {
    expect(resolveNowPlayingSource({ sdkState: null, restState: null, appDeviceId: 'app-1' })).toBeNull()
  })
})

describe('nowPlaying · resolveNowPlaying', () => {
  it('dirige o estado pelo evento do SDK quando o app é o dispositivo ativo', () => {
    const result = resolveNowPlaying({ sdkState, restState, appDeviceId: 'app-1' })

    expect(result.source).toBe('sdk')
    expect(result.playing).toBe(true)
    expect(result.position).toBe(42000)
    // A faixa do SDK não traz metadados; eles chegam depois pelo cache por faixa.
    expect(result.track.popularity).toBeNull()
  })

  it('cai no REST quando outro dispositivo está ativo', () => {
    const result = resolveNowPlaying({
      sdkState,
      restState,
      appDeviceId: 'other-device'
    })

    expect(result.source).toBe('rest')
    expect(result.track.popularity).toBe(55)
    expect(result.track.release_date).toBe('2024-05-01')
  })

  it('devolve null quando nada está tocando em nenhuma fonte', () => {
    expect(resolveNowPlaying({ sdkState: null, restState: null, appDeviceId: null })).toBeNull()
  })

  it('cai no REST se a fonte escolhida (SDK) não tiver faixa corrente', () => {
    const result = resolveNowPlaying({
      sdkState: { track_window: { current_track: null } },
      restState,
      appDeviceId: 'app-1'
    })

    expect(result.source).toBe('rest')
    expect(result.track.id).toBe('track-1')
  })
})

describe('nowPlaying · resolveRawTrack', () => {
  it('devolve a faixa crua do SDK quando o app é o dispositivo ativo', () => {
    const track = resolveRawTrack({ sdkState, restState, appDeviceId: 'app-1' })
    expect(track).toBe(sdkState.track_window.current_track)
    // Campos que a normalização descarta e os modais usam:
    expect(track.album.images[0].url).toBe('https://img.example/cover.jpg')
    expect(track.artists[0].name).toBe('Artista A')
  })

  it('devolve a faixa crua do REST quando outro dispositivo está ativo', () => {
    const track = resolveRawTrack({
      sdkState,
      restState: { ...restState, device: { id: 'phone-1', is_active: true } },
      appDeviceId: 'app-1'
    })
    expect(track).toBe(restState.item)
  })

  it('devolve null quando não há fonte de verdade', () => {
    expect(resolveRawTrack({ sdkState: null, restState: null, appDeviceId: 'app-1' })).toBeNull()
  })
})

describe('nowPlaying · projectPosition', () => {
  it('não avança quando a faixa está pausada', () => {
    expect(projectPosition({ position: 42000, duration: 210000, playing: false }, 5000)).toBe(42000)
  })

  it('soma o tempo decorrido desde o último evento quando está tocando', () => {
    expect(projectPosition({ position: 42000, duration: 210000, playing: true }, 3000)).toBe(45000)
  })

  it('nunca passa da duração da faixa', () => {
    expect(projectPosition({ position: 200000, duration: 210000, playing: true }, 60000)).toBe(210000)
  })

  it('trata posição/tempo ausentes ou inválidos como zero', () => {
    expect(projectPosition({ position: -100, duration: 10000, playing: true }, -50)).toBe(0)
    expect(projectPosition()).toBe(0)
  })

  it('segura na âncora quando a duração é desconhecida', () => {
    expect(projectPosition({ playing: true }, 1500)).toBe(0)
    expect(projectPosition({ position: 5000, playing: true }, 1500)).toBe(5000)
  })
})

describe('nowPlaying · shouldFetchTrackMetadata', () => {
  it('busca na primeira vez que a faixa do SDK aparece', () => {
    const track = normalizeTrack(sdkState.track_window.current_track)
    expect(shouldFetchTrackMetadata(track, createTrackMetadataCache())).toBe(true)
  })

  it('não rebusca uma faixa já resolvida no cache', () => {
    const track = normalizeTrack(sdkState.track_window.current_track)
    const cache = createTrackMetadataCache()
    cache.set(track.id, { popularity: 55, release_date: '2024-05-01' })

    expect(shouldFetchTrackMetadata(track, cache)).toBe(false)
  })

  it('rebusca enquanto o cache não cobrir todo metadado que falta', () => {
    const track = normalizeTrack(sdkState.track_window.current_track)
    const cache = createTrackMetadataCache()
    cache.set(track.id, { popularity: 55 })

    expect(shouldFetchTrackMetadata(track, cache)).toBe(true)
  })

  it('não busca quando a faixa já traz os metadados (vinda do REST)', () => {
    const track = normalizeTrack(restState.item)
    expect(shouldFetchTrackMetadata(track, createTrackMetadataCache())).toBe(false)
  })

  it('não busca sem faixa ou sem identificador', () => {
    expect(shouldFetchTrackMetadata(null, createTrackMetadataCache())).toBe(false)
    expect(shouldFetchTrackMetadata({ id: null }, createTrackMetadataCache())).toBe(false)
  })
})

describe('nowPlaying · resolveTrackMetadata', () => {
  const sdkTrack = () => normalizeTrack(sdkState.track_window.current_track)

  it('combina os metadados recém-buscados e os guarda no cache', () => {
    const cache = createTrackMetadataCache()
    const resolved = resolveTrackMetadata(sdkTrack(), {
      cache,
      metadata: { popularity: 55, release_date: '2024-05-01' }
    })

    expect(resolved).toMatchObject({ id: 'track-1', popularity: 55, release_date: '2024-05-01' })
    expect(cache.get('track-1')).toEqual({ popularity: 55, release_date: '2024-05-01' })
  })

  it('reaproveita o cache quando a mesma faixa reaparece sem nova busca', () => {
    const cache = createTrackMetadataCache()
    cache.set('track-1', { popularity: 55, release_date: '2024-05-01' })

    const resolved = resolveTrackMetadata(sdkTrack(), { cache })

    expect(resolved).toMatchObject({ popularity: 55, release_date: '2024-05-01' })
  })

  it('não sobrescreve metadados já presentes na faixa', () => {
    const resolved = resolveTrackMetadata(normalizeTrack(restState.item), {
      metadata: { popularity: 0, release_date: '1999-01-01' }
    })

    expect(resolved.popularity).toBe(55)
    expect(resolved.release_date).toBe('2024-05-01')
  })

  it('não muta a faixa original', () => {
    const track = sdkTrack()
    resolveTrackMetadata(track, { metadata: { popularity: 55, release_date: '2024-05-01' } })

    expect(track.popularity).toBeNull()
    expect(track.release_date).toBeNull()
  })

  it('devolve a própria faixa quando não há metadados a combinar', () => {
    const track = sdkTrack()
    expect(resolveTrackMetadata(track)).toBe(track)
    expect(resolveTrackMetadata(track, { cache: createTrackMetadataCache() })).toBe(track)
  })

  it('não guarda no cache quando não há faixa nem metadados', () => {
    const cache = createTrackMetadataCache()
    resolveTrackMetadata(null, { cache, metadata: { popularity: 55 } })
    resolveTrackMetadata(sdkTrack(), { cache, metadata: null })

    expect(cache.size).toBe(0)
  })
})

describe('nowPlaying · createTrackMetadataCache', () => {
  it('guarda e lê metadados por identificador de faixa', () => {
    const cache = createTrackMetadataCache()
    cache.set('track-1', { popularity: 55, release_date: '2024-05-01' })

    expect(cache.get('track-1')).toEqual({ popularity: 55, release_date: '2024-05-01' })
    expect(cache.size).toBe(1)
  })

  it('reconhece presença sem confundir com faixa desconhecida', () => {
    const cache = createTrackMetadataCache()
    cache.set('track-1', { popularity: 55 })

    expect(cache.has('track-1')).toBe(true)
    expect(cache.has('track-2')).toBe(false)
    expect(cache.get('track-2')).toBeNull()
  })

  it('ignora gravações sem identificador', () => {
    const cache = createTrackMetadataCache()
    cache.set(null, { popularity: 55 })

    expect(cache.size).toBe(0)
    expect(cache.get(null)).toBeNull()
    expect(cache.has(null)).toBe(false)
  })

  it('permite limpar o cache', () => {
    const cache = createTrackMetadataCache()
    cache.set('track-1', { popularity: 55 })
    cache.clear()

    expect(cache.size).toBe(0)
  })
})
