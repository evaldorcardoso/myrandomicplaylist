const convertToGenreMap = (genreArray) => {
  if (!genreArray) {
    return {}
  }
  return genreArray.reduce((map, item) => {
    map[item.genre] = item.count
    return map
  }, {})
}

const calcDiffDays = (data1, data2) => {
  const oneDay = 24 * 60 * 60 * 1000
  return Math.abs((data1.getTime() - data2.getTime()) / oneDay)
}

const calculateCompatibility = (trackGenres, processedPlaylists, track) => {
  return processedPlaylists.map(playlist => {
    let compatibilityScore = 0
    for (const [genre, trackCount] of Object.entries(trackGenres)) {
      if (playlist.genreMap && playlist.genreMap[genre]) {
        compatibilityScore += trackCount * playlist.genreMap[genre]
      }
    }
    if (!playlist.genre_compatibility) {
      compatibilityScore = 0
    }
    const diffDays = calcDiffDays(new Date(), new Date(track.album.release_date))
    if (playlist.name.indexOf('Lançamentos') > -1) {
      if (diffDays < 7) {
        compatibilityScore = 999
      }
    }
    return {
      ...playlist,
      compatibilityScore
    }
  })
}

const getCompatiblePlaylists = ({ playlists, currentUser, excludePlaylistId = null, trackGenres, track }) => {
  const ownedPlaylists = playlists.filter(
    playlist => playlist.owner?.display_name === currentUser?.display_name
  )

  const targetPlaylists = excludePlaylistId
    ? ownedPlaylists.filter(playlist => playlist.id !== excludePlaylistId)
    : ownedPlaylists

  const playlistsWithGenreMap = targetPlaylists.map(playlist => ({
    ...playlist,
    genreMap: convertToGenreMap(playlist.genres)
  }))

  const compatiblePlaylists = calculateCompatibility(trackGenres, playlistsWithGenreMap, track)
  compatiblePlaylists.sort((a, b) => b.compatibilityScore - a.compatibilityScore)
  return compatiblePlaylists
}

export {
  convertToGenreMap,
  calcDiffDays,
  calculateCompatibility,
  getCompatiblePlaylists
}
