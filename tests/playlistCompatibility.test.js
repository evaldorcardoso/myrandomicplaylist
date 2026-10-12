import { describe, it, expect } from 'vitest'
import {
  convertToGenreMap,
  calcDiffDays,
  calculateCompatibility,
  getCompatiblePlaylists
} from '@/support/playlistCompatibility'

const daysAgo = (days) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

// `calculateCompatibility` só lê `album.release_date` do track.
const makeTrack = (releaseDaysAgo = 365) => ({
  album: { release_date: daysAgo(releaseDaysAgo) }
})

const makePlaylist = (overrides = {}) => ({
  id: 'p1',
  name: 'Foco',
  owner: { display_name: 'eu' },
  genres: [],
  genreMap: {},
  genre_compatibility: true,
  ...overrides
})

describe('convertToGenreMap', () => {
  it('converte a lista de gêneros em um mapa gênero -> contagem', () => {
    expect(convertToGenreMap([
      { genre: 'pop', count: 3 },
      { genre: 'rock', count: 2 }
    ])).toEqual({ pop: 3, rock: 2 })
  })

  it('devolve objeto vazio para entrada ausente', () => {
    expect(convertToGenreMap(null)).toEqual({})
    expect(convertToGenreMap(undefined)).toEqual({})
  })
})

describe('calcDiffDays', () => {
  it('conta a diferença absoluta em dias entre duas datas', () => {
    expect(calcDiffDays(new Date('2024-01-01'), new Date('2024-01-03'))).toBe(2)
  })

  it('é simétrico (usa valor absoluto)', () => {
    expect(calcDiffDays(new Date('2024-01-03'), new Date('2024-01-01'))).toBe(2)
  })
})

describe('calculateCompatibility', () => {
  const track = makeTrack()

  it('soma trackCount * genreMap[genre] para os gêneros em comum', () => {
    const result = calculateCompatibility(
      { pop: 2, rock: 1 },
      [makePlaylist({ genreMap: { pop: 5, rock: 3 } })],
      track
    )
    // 2 * 5 + 1 * 3 = 13
    expect(result[0].compatibilityScore).toBe(13)
  })

  it('zera o score quando a playlist não usa compatibilidade por gênero', () => {
    const result = calculateCompatibility(
      { pop: 2 },
      [makePlaylist({ genreMap: { pop: 5 }, genre_compatibility: false })],
      track
    )
    expect(result[0].compatibilityScore).toBe(0)
  })

  it('ignora gêneros sem correspondência na playlist', () => {
    const result = calculateCompatibility(
      { jazz: 4 },
      [makePlaylist({ genreMap: { pop: 5 } })],
      track
    )
    expect(result[0].compatibilityScore).toBe(0)
  })

  it('dá score máximo (999) a lançamento recente numa playlist "Lançamentos"', () => {
    const result = calculateCompatibility(
      { pop: 1 },
      [makePlaylist({ id: 'lanc', name: 'Lançamentos da semana' })],
      makeTrack(1)
    )
    expect(result[0].compatibilityScore).toBe(999)
  })

  it('não promove lançamento antigo numa playlist "Lançamentos"', () => {
    const result = calculateCompatibility(
      { pop: 1 },
      [makePlaylist({ id: 'lanc', name: 'Lançamentos da semana', genreMap: { pop: 2 } })],
      makeTrack(30)
    )
    expect(result[0].compatibilityScore).toBe(2)
  })

  it('preserva as demais propriedades da playlist', () => {
    const result = calculateCompatibility(
      { pop: 1 },
      [makePlaylist({ genreMap: { pop: 1 }, owner: { display_name: 'eu' } })],
      track
    )
    expect(result[0]).toMatchObject({ id: 'p1', name: 'Foco', owner: { display_name: 'eu' } })
  })
})

describe('getCompatiblePlaylists', () => {
  const currentUser = { display_name: 'eu' }
  const track = makeTrack()

  const playlists = [
    makePlaylist({ id: 'a', name: 'Pop', genres: [{ genre: 'pop', count: 10 }] }),
    makePlaylist({ id: 'b', name: 'Rock', genres: [{ genre: 'rock', count: 3 }] }),
    makePlaylist({
      id: 'c',
      name: 'De outro dono',
      owner: { display_name: 'outro' },
      genres: [{ genre: 'pop', count: 100 }]
    })
  ]

  it('considera apenas playlists do dono atual', () => {
    const result = getCompatiblePlaylists({
      playlists,
      currentUser,
      trackGenres: { pop: 1 },
      track
    })
    expect(result.map(p => p.id)).not.toContain('c')
  })

  it('ordena por score decrescente', () => {
    const result = getCompatiblePlaylists({
      playlists,
      currentUser,
      trackGenres: { pop: 1, rock: 1 },
      track
    })
    expect(result.map(p => p.id)).toEqual(['a', 'b'])
    expect(result[0].compatibilityScore).toBeGreaterThan(result[1].compatibilityScore)
  })

  it('exclui a playlist informada em excludePlaylistId', () => {
    const result = getCompatiblePlaylists({
      playlists,
      currentUser,
      excludePlaylistId: 'a',
      trackGenres: { pop: 1 },
      track
    })
    expect(result.map(p => p.id)).not.toContain('a')
  })

  it('remove playlists duplicadas (mesmo id)', () => {
    const duplicated = [
      playlists[0],
      { ...playlists[0], name: 'Pop (duplicada)' },
      playlists[1]
    ]
    const result = getCompatiblePlaylists({
      playlists: duplicated,
      currentUser,
      trackGenres: { pop: 1 },
      track
    })
    expect(result.filter(p => p.id === 'a')).toHaveLength(1)
  })

  it('anexa o genreMap derivado em cada playlist', () => {
    const result = getCompatiblePlaylists({
      playlists,
      currentUser,
      trackGenres: { pop: 1 },
      track
    })
    expect(result.find(p => p.id === 'a').genreMap).toEqual({ pop: 10 })
  })
})
