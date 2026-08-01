import { computed, inject, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Chart as ChartJS, Title, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement } from 'chart.js'
import { useGeneral, useProfile } from '@/support/spotifyApi'
import { supabase } from '@/support/supabaseClient'
import { usePlaylistStore } from '@/stores/playlist'
import { useUserStore } from '@/stores/user'
import { NOTIFICATIONS_TYPE } from '@/support/helpers'
import { notify } from '@kyvg/vue3-notification'
import { PlaylistService } from '@/services/PlaylistService'

export const NOTIFICATION_ACTIONS = {
  UPDATE_SORT: 'update_sort',
  SAVE_LIKES_STATISTICS: 'save_likes_statistics',
  SAVE_TRACKS_STATISTICS: 'save_tracks_statistics',
  UPDATE_DESCRIPTION: 'update_description',
  UPDATE_PLAYLIST: 'update_playlist',
}

export function usePlaylistData(callbacks = {}) {
  ChartJS.register(Title, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement)

  const route = useRoute()
  const playlistStore = usePlaylistStore()
  const userStore = useUserStore()
  const progress = inject('progress')
  const { getPlaylist, getTracks, getArtists } = useGeneral()
  const { executePlaylist, pausePlayback } = useProfile()
  const {
    hasChangedFromDatabase,
    hasSilentChangesFromDatabase,
    savePlaylist,
    loadAllFromDatabase,
    getGenres
  } = PlaylistService()

  const MAX_STATISTICS_ITEMS_TO_RETAIN = 10
  const DIFF_DAY_TO_SAVE_NEW_STATISTICS = 6

  const playlistId = computed(() => route.params.id)

  const state = reactive({
    playlist: null,
    playlistDescription: '',
    tracks: [],
    topArtists: [],
    databaseTracks: [],
    dataLikes: [],
    chartData: {
      labels: [],
      datasets: []
    },
    chartDataPopularity: {
      labels: [],
      datasets: []
    },
    chartOptions: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#bccbb9', maxTicksLimit: 6 }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#bccbb9' }
        }
      }
    }
  })

  const isNotificationOpened = ref(false)
  const notificationDataReactive = ref(null)
  const notificationAction = ref('')

  const notificationOpened = computed(() => {
    return isNotificationOpened.value
  })

  const notificationData = computed(() => {
    return notificationDataReactive.value
  })

  const topArtists = computed(() => {
    if (Array.isArray(state.playlist?.topArtists)) {
      return state.playlist.topArtists
    }
    return state.topArtists
  })

  const genres = computed(() => {
    const list = state.playlist?.topGenres ?? state.playlist?.genres
    return Array.isArray(list) ? list : []
  })

  const avgPopularity = computed(() => {
    if (!state.tracks.length) return 0
    const total = state.tracks.reduce((sum, track) => sum + (track.track?.popularity ?? 0), 0)
    return Number((total / state.tracks.length).toFixed(2))
  })

  const openPlaylistApp = (playlistId) => {
    window.open(`https://open.spotify.com/playlist/${playlistId}`)
  }

  const getPlaylistTracks = async(force = false) => {
    state.tracks = (await playlistStore.getTracks(playlistId.value)) ?? []
    if ((state.tracks.length === 0) || force) {
      playlistStore.loadTracks(playlistId.value, await getTracks(playlistId.value))
      state.tracks = (await playlistStore.getTracks(playlistId.value)) ?? []
    }
  }

  const checkTracksStatistics = async() => {
    var newTracks = false
    state.databaseTracks = userStore.getTracks()
    for (const track of state.tracks) {
      track.track.popularity_old = userStore.getTrack(track.track.id)?.popularity ?? track.track.popularity
      track.track.tracked = userStore.getTrack(track.track.id)
      if ((!track.track.tracked) && (state.playlist?.tracked)) {
        newTracks = true
      }
    }
    if (newTracks) {
      if (isNotificationOpened.value) {
        console.log('Notification is already opened, ignoring "checkTracksStatistics"')
        return;
      }
      showNotification(
        NOTIFICATIONS_TYPE.info,
        'Hey',
        'There are new tracks in this playlist. Do you want to update the statistics ?',
        true,
        false
      )
      notificationAction.value = NOTIFICATION_ACTIONS.SAVE_TRACKS_STATISTICS
    }
  }

  const saveTracksStatistics = async() => {
    progress.start()
    try {
      for (const track of state.tracks) {
        await saveTrackStatistics(track)
      }
    } catch (error) {
      console.log(error)
    }
    progress.finish()
  }

  const saveTrackStatistics = async(track) => {
    try {
      var trackToSave = {
        track_id: track.track.id,
        popularity: track.track.popularity,
        playlist_id: state.playlist.id
      }

      const trackFound = state.databaseTracks.find(e => e.track_id === track.track.id)?.id

      if (trackFound) {
        trackToSave.id = trackFound
        const { data: databaseTrack, error: trackUpdatedError } = await supabase
          .from(import.meta.env.VITE_SUPABASE_TRACKS_TABLE)
          .upsert(trackToSave)
          .select()

        if (trackUpdatedError) {
          console.log(trackUpdatedError.message)
        }
        return databaseTrack
      }

      const { data: databaseTrack, error: trackInsertedError } = await supabase
          .from(import.meta.env.VITE_SUPABASE_TRACKS_TABLE)
          .insert(trackToSave)
          .select()

      if (trackInsertedError) {
        console.log(trackInsertedError.message)
      }

      return databaseTrack
    } catch (error) {
      console.log(error)
    }
  }

  const removeTrackStatistics = async(trackToRemove) => {
    const trackFound = state.databaseTracks.find(e => e.track_id === trackToRemove)?.id
    if (trackFound) {
      const { error } = await supabase
        .from(import.meta.env.VITE_SUPABASE_TRACKS_TABLE)
        .delete()
        .eq('id', trackFound)
        .eq('playlist_id', state.playlist.id)

      if (error) throw error
    }
  }

  const saveStatistics = async() => {
    try {
      const data = {
        likes_count: state.playlist?.followers.total,
        playlist_id: state.playlist?.id
      }

      let { error } = await supabase.from(import.meta.env.VITE_SUPABASE_PLAYLISTS_TABLE).insert(data)

      if (error) throw error

      await getLikesStats()
      mountLikeStatsChart(state.dataLikes)
      mountPopularityStatsChart()
    } catch (error) {
      console.log(error)
      console.log(error.message)
      showNotification(NOTIFICATIONS_TYPE.danger, 'Ops', error.message)
    }
  }

  const deleteStatistic = async(id) => {
    console.log('delete statistic for id ' + id)
    let { error, status } = await supabase
        .from(import.meta.env.VITE_SUPABASE_PLAYLISTS_TABLE)
        .delete()
        .eq('id', id)

    if (error && status !== 406) throw error
  }

  const getLikesStats = async() => {
    try {
      let { data, error, status } = await supabase
        .from(import.meta.env.VITE_SUPABASE_PLAYLISTS_TABLE)
        .select(`id, likes_count, created_at`)
        .eq('playlist_id', state.playlist?.id)
        .order('created_at')

      if (error && status !== 406) throw error

      if (data) {
        if (data.length > MAX_STATISTICS_ITEMS_TO_RETAIN) {
          let row = data.shift()
          await deleteStatistic(row.id)
        }
      }
      const parcialData = {
        created_at: new Date(),
        id: Date.now(),
        likes_count: state.playlist?.followers?.total ?? 0
      }
      data.push(parcialData)
      state.dataLikes = data
    } catch (error) {
      console.log(error.message)
      showNotification(NOTIFICATIONS_TYPE.danger, 'Ops', error.message)
    }
  }

  const mountLikeStatsChart = async(data) => {
    let labels = data.map(row => new Date(row.created_at).toLocaleDateString())
    let likes = data.map(row => row.likes_count)
    var pointStyles = []
    for (let i = 0; i < data.length; i++) {
      pointStyles.push('circle')
    }
    pointStyles[pointStyles.length - 1] = 'crossRot'
    state.chartData = {
      labels,
      datasets: [
        {
          label: 'Likes',
          backgroundColor: 'rgba(83, 224, 118, 0.15)',
          borderColor: '#53e076',
          borderWidth: 2,
          pointRadius: 5,
          pointBackgroundColor: '#53e076',
          pointBorderColor: '#131313',
          pointBorderWidth: 2,
          pointStyle: pointStyles,
          fill: true,
          tension: 0.4,
          data: likes
        }
      ]
    }
  }

  const mountPopularityStatsChart = async() => {
    let labels = ['0-40%', '40-70%', '70-100%']
    let level1 = state.tracks.filter(track => track.track.popularity <= 40);
    let level2 = state.tracks.filter(track => track.track.popularity > 40 && track.track.popularity <= 70);
    let level3 = state.tracks.filter(track => track.track.popularity > 70);

    let popularity = [level1.length, level2.length, level3.length]
    state.chartDataPopularity = {
      labels,
      datasets: [
        {
          label: 'Popularity',
          backgroundColor: ['#ff1717', '#fff01e', '#75ff18'],
          borderColor: '#fff',
          borderWidth: 1,
          data: popularity
        }
      ]
    }
  }

  const calcDiffDays = (data1, data2) => {
    let oneDay = 24 * 60 * 60 * 1000
    return Math.abs((data1.getTime() - data2.getTime()) / (oneDay))
  }

  const getTopArtists = async(limit = 10) => {
    const artistCount = {};

    state.tracks.forEach(track => {
      track.track.artists.forEach(artist => {
        const artistId = artist.id;
        const artistName = artist.name;

        if (artistCount[artistId]) {
          artistCount[artistId].count++;
        } else {
          artistCount[artistId] = { name: artistName, count: 1 };
        }
      });
    });

    const sortedArtists = Object.entries(artistCount)
      .map(([id, data]) => ({
        id,
        name: data.name,
        count: data.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const topArtistIds = sortedArtists.map(artist => artist.id).join(',');
    const topArtists = await getArtists(topArtistIds);

    const artistCountMap = sortedArtists.reduce((map, artist) => {
      map[artist.id] = artist.count;
      return map;
    }, {});

    topArtists.forEach(artist => {
      if (artistCountMap[artist.id] !== undefined) {
        artist.count = artistCountMap[artist.id];
      }
    });
    state.topArtists = topArtists
    playlistStore.loadTopArtists(state.playlist.id, topArtists)
  }

  const getTopGenres = async() => {
    const uniqueArtistIds = new Set();
    const artists = [];

    state.tracks.forEach(track => {
      track.track.artists.forEach(artist => {
        if (!uniqueArtistIds.has(artist.id)) {
          uniqueArtistIds.add(artist.id);
          artists.push(artist);
        }
      });
    });

    const topGenres = await getGenres(artists)
    await playlistStore.loadTopGenres(state.playlist.id, topGenres)
  }

  const showNotification = (type, title, message, action = false, auto = false) => {
    let notificationData = {
      type,
      title,
      message,
      action,
      auto
    }
    notificationDataReactive.value = notificationData
    isNotificationOpened.value = true
  }

  const askToSaveNewStatistics = () => {
    if (state.dataLikes.length > 1) {
      const diffDays = calcDiffDays(new Date(), new Date(state.dataLikes[state.dataLikes.length - 2].created_at))
      if (diffDays < DIFF_DAY_TO_SAVE_NEW_STATISTICS) {
        return
      }
    }
    showNotification(
      NOTIFICATIONS_TYPE.info,
      'Hey',
      'Save new likes statistics for this playlist today ?',
      true,
      false
    )
    notificationAction.value = NOTIFICATION_ACTIONS.SAVE_LIKES_STATISTICS
  }

  const executeUserPlaylist = async(currentPlaying) => {
    try {
      if (currentPlaying?.is_playing) {
        const { status } = await pausePlayback()
        if (status != 204) {
          openPlaylistApp(state.playlist.id)
          return
        }
        return
      }
      const formData = {
        "context_uri": "spotify:playlist:" + state.playlist.id,
        "offset": {
          "position": 0
        },
        "position_ms": 0,
      }
      const { status } = await executePlaylist(formData)
      if (status != 204) {
        openPlaylistApp(state.playlist.id)
        return
      }
    } catch (error) {
      console.log(error.response)
      showNotification(NOTIFICATIONS_TYPE.danger, 'Ops', error.response?.data?.error?.message ?? 'Não foi possível executar a playlist')
    }
  }

  const identifyPlaylistChanges = async(data) => {
    if (await hasChangedFromDatabase(data)) {
      console.log('Playlist changed from database')
      showNotification(
        NOTIFICATIONS_TYPE.info,
        'Info',
        'Playlist changes detected, do you want to update it ?',
        true,
        false
      )
      notificationAction.value = NOTIFICATION_ACTIONS.UPDATE_PLAYLIST
      return
    }

    if (await hasSilentChangesFromDatabase(data)) {
      const result = await savePlaylist(data)
      console.log(result)
      if (!result) {
        notify({
          title: 'Ops',
          text: 'It´s not possible to save the Playlist at this time.',
          type: 'error'
        })
      }
    }
  }

  const onNotificationAction = async(value) => {
    isNotificationOpened.value = false
    if (value) {
      switch (notificationAction.value) {
        case NOTIFICATION_ACTIONS.SAVE_LIKES_STATISTICS:
          if (state.dataLikes.length > 0) {
            let diffDays = calcDiffDays(new Date(), new Date(state.dataLikes[state.dataLikes.length - 1].created_at));
            if (diffDays == 0) {
              showNotification(
                NOTIFICATIONS_TYPE.warning,
                'Ops',
                'Looks like you already have a statistics for today!'
              )
              return
            }
            await saveStatistics()
            await saveTracksStatistics()
            notify({
              title: 'Alright',
              text: 'Statistics saved!',
              type: 'success'
            })
          }
          break
        case NOTIFICATION_ACTIONS.SAVE_TRACKS_STATISTICS:
          await saveTracksStatistics()
          await getPlaylistTracks(true)
          notify({
            title: 'Alright',
            text: 'Statistics saved!',
            type: 'success'
          })
          break
        case NOTIFICATION_ACTIONS.UPDATE_SORT:
          if (callbacks.onUpdateSort) callbacks.onUpdateSort()
          break
        case NOTIFICATION_ACTIONS.UPDATE_DESCRIPTION:
          if (callbacks.onUpdateDescription) callbacks.onUpdateDescription()
          break
        case NOTIFICATION_ACTIONS.UPDATE_PLAYLIST:
          notify({ title: 'Please, wait', text: 'Saving playlist...', type: 'info' })
          const result = await savePlaylist(state.playlist)
          if (!result) {
            notify({
              title: 'Ops',
              text: 'It´s not possible to save the Playlist at this time.',
              type: 'error'
            })
          }
          notify({ title: 'Alright', text: 'Playlist saved!', type: 'success' })
          break
      }
    }
    if ((!value) && (notificationAction.value == NOTIFICATION_ACTIONS.UPDATE_DESCRIPTION)) {
      if (callbacks.onCancelDescription) callbacks.onCancelDescription()
    }
    notificationAction.value = ''
  }

  const onRefreshPage = async(applySort = null) => {
    notify({ title: 'Please, wait', text: 'Loading playlist from Spotify...', type: 'info' })
    const { data } = await getPlaylist(playlistId.value)
    await playlistStore.load(data)
    await getPlaylistTracks(true)
    if (typeof applySort === 'function') {
      applySort()
    }
    await checkTracksStatistics()
    await getTopArtists(10)
    await getTopGenres()
    state.playlist = await playlistStore.getPlaylist(playlistId.value)
    notify({ title: 'Alright', text: 'Playlist updated!', type: 'success' })
  }

  const init = async(options = {}) => {
    progress.start()
    if (!playlistStore.isLoaded) {
      const playlists = await loadAllFromDatabase()
      if (Array.isArray(playlists)) {
        playlistStore.loadAll(playlists)
      }
    }
    state.playlist = await playlistStore.getPlaylist(playlistId.value)

    if ((!state.playlist) || (!state.playlist.followers) || (state.playlist.images?.length === 0)) {
      const { data } = await getPlaylist(playlistId.value)
      await identifyPlaylistChanges(data)
      playlistStore.load(data)
      state.playlist = await playlistStore.getPlaylist(playlistId.value)
    }
    await getPlaylistTracks()
    if (!state.chartData.datasets[0]?.data) {
      await getLikesStats()
      await mountLikeStatsChart(state.dataLikes)
      await mountPopularityStatsChart()
    }
    if (options.checkTracks !== false) {
      await checkTracksStatistics()
    }
    if (options.topArtistsLimit && (!Array.isArray(state.playlist?.topArtists) || state.playlist.topArtists.length === 0)) {
      getTopArtists(options.topArtistsLimit).catch((error) => console.error(error))
    }
    progress.finish()
  }

  return {
    state,
    playlistId,
    isNotificationOpened,
    notificationOpened,
    notificationData,
    notificationAction,
    topArtists,
    genres,
    avgPopularity,
    MAX_STATISTICS_ITEMS_TO_RETAIN,
    DIFF_DAY_TO_SAVE_NEW_STATISTICS,
    init,
    onRefreshPage,
    onNotificationAction,
    identifyPlaylistChanges,
    showNotification,
    askToSaveNewStatistics,
    openPlaylistApp,
    executeUserPlaylist,
    getPlaylistTracks,
    checkTracksStatistics,
    saveTracksStatistics,
    saveTrackStatistics,
    removeTrackStatistics,
    saveStatistics,
    deleteStatistic,
    getLikesStats,
    mountLikeStatsChart,
    mountPopularityStatsChart,
    calcDiffDays,
    getTopArtists,
    getTopGenres
  }
}
