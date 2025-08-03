<script setup>
  import { onMounted, computed, reactive, ref, inject } from 'vue'
  import { useRoute } from 'vue-router'
  import VueBasicAlert from 'vue-basic-alert'
  import { useGeneral, useProfile } from '@/support/spotifyApi'
  import { supabase } from '@/support/supabaseClient'
  import { Line, Pie } from 'vue-chartjs'
  import { Chart as ChartJS, Title, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, ArcElement } from 'chart.js'
  import { usePlaylistStore } from '@/stores/playlist'
  import { useUserStore } from '@/stores/user'
  import FloatMenu from '@/components/FloatMenu.vue'
  import Notification from '@/components/Notification.vue'
  import { NOTIFICATIONS_TYPE } from '../support/helpers'
  import { notify } from "@kyvg/vue3-notification";
  import { PlaylistService } from '../services/PlaylistService'

  ChartJS.register(Title, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, ArcElement)

  const route = useRoute();
  const playlistStore = usePlaylistStore()
  const userStore = useUserStore()
  const progress = inject("progress");
  const { getPlaylist, getTracks, updateTracksOfPlaylist, getArtists, updatePlaylist } = useGeneral()
  const { executePlaylist, pausePlayback, addTrackToQueue } = useProfile()
  const { 
    hasChangedFromDatabase,
    hasSilentChangesFromDatabase,
    savePlaylist,
    loadAllFromDatabase,
    updatePlaylistTotalTracks,
    getGenres
  } = PlaylistService()

  const playlistId = computed(() => route.params.id);

  const MAX_STATISTICS_ITEMS_TO_RETAIN = 10
  const DIFF_DAY_TO_SAVE_NEW_STATISTICS = 6

  const sortOptions = [
    'default',
    'top first',
    'top last',
    'added first',
    'added last'
  ]

  const NOTIFICATION_ACTIONS = {
    UPDATE_SORT: 'update_sort',
    SAVE_LIKES_STATISTICS: 'save_likes_statistics',
    SAVE_TRACKS_STATISTICS: 'save_tracks_statistics',
    UPDATE_DESCRIPTION: 'update_description',
    UPDATE_PLAYLIST: 'update_playlist',
  }

  const state = reactive({
    isPlaying: false,
    playlist: null,
    playlistDescription: "",
    tracks: [],
    topArtists: [],
    databaseTracks: [],
    visible: false,
    notificationAction: '',
    sortPosition: 0,
    isProcessing: false,
    message: '',
    statisticsOpen: false,
    artistsOpen: false,
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
      responsive: true
    },
  })
  const isMenuOpened = ref(null)
  const menuDataReactive = ref(null)
  const isNotificationOpened = ref(null)
  const notificationDataReactive = ref(null)
  const editPlaylistDescription = ref(false)
  const alert = ref(null)

  const props = defineProps({
    forceRefresh: {
        type: Boolean,
        default: false,
    },
    removeTrack: {
      type: String,
      default: ''
    },
    stepData: {
      type: Number,
      default: 1
    },
    currentData: {
        type: Object,
        default: () => { },
    }
  });

  const currentUser = computed(() => {
    return userStore.getUser
  });

  const menuOpened = computed(() => {
    return isMenuOpened.value;
  })

  const menuData = computed(() => {
    return menuDataReactive.value
  })
  
  const notificationOpened = computed(() => {
    return isNotificationOpened.value;
  })

  const notificationData = computed(() => {
    return notificationDataReactive.value
  })

  const currentPlaying = computed(() => {
    return props.currentData;
  });

  const openPlaylistApp = (playlistId) => {
    window.open(`https://open.spotify.com/playlist/${playlistId}`)
  }

  const getPlaylistTracks = async(force = false) => {
    state.tracks = await playlistStore.getTracks(playlistId.value)
    if ((state.tracks.length === 0) || force) {
      playlistStore.loadTracks(playlistId.value, await getTracks(playlistId.value), force)
      state.tracks = await playlistStore.getTracks(playlistId.value)
    }    
  }

  const checkTracksStatistics = async() => {
    var newTracks = false
    state.databaseTracks = userStore.getTracks()
    for (const track of state.tracks) {
      track.track.popularity_old = userStore.getTrack(track.track.id)?.popularity ?? track.track.popularity
      track.track.tracked = userStore.getTrack(track.track.id)
      if ((!track.track.tracked) && (state.playlist.tracked)) {
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
        state.notificationAction = NOTIFICATION_ACTIONS.SAVE_TRACKS_STATISTICS
    }
  }

  const saveTracksStatistics = async() => {
    progress.start()
    try {
      for (const track of state.tracks) {
        await saveTrackStatistics(track)
      };
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
    console.log('delete statistic for id '+ id)
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
        likes_count: state.playlist.followers.total
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
    for(let i=0; i<data.length; i++) {
      pointStyles.push('circle')
    }
    pointStyles[pointStyles.length-1] = 'crossRot'
    state.chartData = {
      labels,      
      datasets: [
        {
          label: 'Likes',
          backgroundColor: '#1ed760',
          borderColor: '#fff',
          borderWidth: 1,
          pointRadius: 7,
          fill: false,
          pointHoverRadius: 10,
          pointStyle: pointStyles,
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
    let oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
    return Math.abs((data1.getTime() - data2.getTime()) / (oneDay));
  }

  const updatePlaylistDescription = async() => {
    state.isProcessing = true
    const formData = {
      'description': state.playlistDescription
    }
    try {
      await updatePlaylist(state.playlist.id, formData)
      let message = 'Playlist description updated successfully!'
      state.message = message
      notify({
        title: 'Awesome',
        text: message,
        type: 'success'
      })
      editPlaylistDescription.value = false
    } catch (error) {
      console.log(error)
      showNotification(NOTIFICATIONS_TYPE.danger, 'Ops', error.message)
    }
    await onRefreshPage()
    state.isProcessing = false
  }

  const removePartFromText = (text) => {
    const part = "Top artistas:";
    const indice = text.indexOf(part);
  
    if (indice !== -1) {
      text = text.substring(0, indice);
     }
  
    return text.trimEnd();
  }

  const executeUserPlaylist = async() => {
    try{
      if (currentPlaying.value.is_playing) {
        const { status } = await pausePlayback()
        if (status != 204){
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
      if (status != 204){
        openPlaylistApp(state.playlist.id)
        return
      }
    }catch(error){
      console.log(error.response)
      showNotification(NOTIFICATIONS_TYPE.danger, 'Ops', error.response.data.error.message)
    }
  }

  const executeTrack = async(track) => {
    if (!track.opened) return

    try{
      const formData = {
        "uris": [ track.track.uri ]
      }
      const { status } = await executePlaylist(formData)
      if (status != 204){
        showNotification(
          NOTIFICATIONS_TYPE.danger,
          'Ops',
          error.response.data.error.message
        )
        return
      }
      state.isPlaying = true  
    }catch(error){
      console.log(error.response)
      showNotification(
        NOTIFICATIONS_TYPE.danger,
        'Ops',
        error.response.data.error.message
      )
    }
  }

  const sortUserPlaylist = (increment = true) => {
    if(increment) {
      state.sortPosition++
      if (state.sortPosition >= sortOptions.length) {
        state.sortPosition = 0
      }
    }
    
    if (sortOptions[state.sortPosition] === 'top first') {
      state.tracks.sort((a, b) => b.track?.popularity - a.track?.popularity)
      checkDifferentSort()
      return
    }
    if (sortOptions[state.sortPosition] === 'top last') {
      state.tracks.sort((a, b) => a.track?.popularity - b.track?.popularity)
      checkDifferentSort()
      return
    }
    if (sortOptions[state.sortPosition] === 'added first') {
      state.tracks.sort((a, b) => new Date(a.added_at) - new Date(b.added_at))
      checkDifferentSort()
      return
    }
    if (sortOptions[state.sortPosition] === 'added last') {
      state.tracks.sort((a, b) => new Date(b.added_at) - new Date(a.added_at))
      checkDifferentSort()
      return
    }
    if (sortOptions[state.sortPosition] === 'default') {
      state.tracks.sort((a, b) => a.id - b.id)
      checkDifferentSort()
      return
    }
  }

  const checkDifferentSort = () => {
    if(state.playlist.owner.display_name != currentUser.value.display_name) {
      return
    }
    for (let i=0; i<state.tracks.length; i++) {
      if (i != state.tracks[i].id) {
        showNotification(
          NOTIFICATIONS_TYPE.info,
          'Info',
          'Apply this sort on Spotify ?',
          true,
          false
        )
        state.differentSort = true
        state.notificationAction = NOTIFICATION_ACTIONS.UPDATE_SORT
        return;
      }
    }
    state.differentSort = false
    state.notificationAction = ''
    isNotificationOpened.value = false
  }

  const openLink = (url) => {
    window.open(url, '_blank')
  }

  const trackInfo = async (track, addToAnotherPlaylist = false) => {
    // console.log(track)
    const topGenres = await getGenres(track.track.artists)
    if (!track.opened) return

    track['playlist'] = {
      id: state.playlist.id,
      owner: state.playlist.owner.display_name
    }

    let menuData = {
      type: 'track',
      track,
      listPlaylists: addToAnotherPlaylist,
      genres: topGenres
    }
    menuDataReactive.value = menuData
    isMenuOpened.value = true
  }

  const openMenuPlaylist = async() => {
    let menuData = {
      type: 'playlist',
      playlist: state.playlist
    }
    
    let popularities = state.tracks.map(track => { return track.track?.popularity ?? 0 })
    let popularity = popularities.reduce(function(a, b) {
      return a + b
    })
    menuData.playlist.isOwner = state.playlist.owner.display_name == currentUser.value.display_name
    menuData.playlist.popularity = (popularity / state.tracks.length).toFixed(2)    
    menuData.playlist.likesStats = state.dataLikes
    menuDataReactive.value = menuData
    isMenuOpened.value = true
  }

  const onRemoveTrack = async (value) => {
    playlistStore.removeTrack(playlistId.value, value)
    const trackFound = state.tracks.find(e => e.track.uri === value)?.track?.id
    if (trackFound) {
      removeTrackStatistics(trackFound)
    }
    await playlistStore.updateTracksPosition(playlistId.value)
    await getPlaylistTracks()
    await updatePlaylistTotalTracks(playlistId.value, state.tracks.length)
    sortUserPlaylist(false)
  }

  const onUpdateMenuOpened = (value) => {
    isMenuOpened.value = value
    if (! value) {
      checkTracksStatistics()
    }
  }

  const onRefreshPage = async() => {
    notify({ title: 'Please, wait', text: 'Loading playlist from Spotify...', type: 'info'})
    console.log('Refresh page!')
    const { data } = await getPlaylist(playlistId.value)
    await playlistStore.load(data)
    await getPlaylistTracks(true)
    sortUserPlaylist(false)
    await checkTracksStatistics()
    await getTopArtists()
    await getTopGenres()
    state.playlist = await playlistStore.getPlaylist(playlistId.value)
    notify({ title: 'Alright', text: 'Playlist updated!', type: 'success' })
  }

  const onOpenStatistics = () => {
    state.statisticsOpen = !state.statisticsOpen
    if (! state.statisticsOpen) {
      isNotificationOpened.value = false
      state.notificationAction = ''
      return
    }
    mountLikeStatsChart(state.dataLikes)
    mountPopularityStatsChart()
    checkToSaveNewStatistics()    
  }

  const onOpenArtists = () => {
    state.artistsOpen = !state.artistsOpen
  }

  const checkToSaveNewStatistics = () => {
    if (state.dataLikes.length > 1) {
      let diffDays = calcDiffDays(new Date(), new Date(state.dataLikes[state.dataLikes.length -2].created_at));
      console.log(diffDays)
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
    state.notificationAction = NOTIFICATION_ACTIONS.SAVE_LIKES_STATISTICS
  }

  const addToQueue = async(track) => {
    try {
      const { status } = await addTrackToQueue(track)
      notify({
        title: 'Alright',
        text: 'Songs added to queue!',
        type: 'success'
      })
    } catch (error) {
      console.log(error)
      showNotification(NOTIFICATIONS_TYPE.danger, 'Ops', error.message)
    }
  }

  const updateTracksOrder = async() => {    
    state.isProcessing = true
    var i = 0
    var changes = 0
    while(i < state.tracks.length) {
      let id = state.tracks[i].id
      if (id == i) {
        i++
        continue
      }
      changes++
      showNotification(NOTIFICATIONS_TYPE.info, 'Please, wait', 'Sorting songs... (' + changes + '/' + state.tracks.length + ')')
      const formData = {
        'range_start': id,
        'insert_before': i
      }
      await updateTracksOfPlaylist(playlistId.value, formData)
      state.tracks.sort((a, b) => a.id - b.id)
      let temp = state.tracks.splice(id, 1)
      state.tracks.splice(i, 0, temp[0])
      for(let j=0; j<state.tracks.length; j++) {
        state.tracks[j].id = j
      }
      sortUserPlaylist(false)
      i = 0
    }

    showNotification(NOTIFICATIONS_TYPE.success, 'Alright!', 'Playlist updated with ' + changes + ' changes!')
    state.sortPosition = 0
    await onRefreshPage()
    state.differentSort = false
    state.isProcessing = false
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

  const onNotificationAction = async(value) => {
    isNotificationOpened.value = false
    if (value) {
      switch(state.notificationAction) {
        case NOTIFICATION_ACTIONS.SAVE_LIKES_STATISTICS:
          if (state.dataLikes.length > 0) {
            let diffDays = calcDiffDays(new Date(), new Date(state.dataLikes[state.dataLikes.length -1].created_at));
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
          notify({
            title: 'Alright',
            text: 'Statistics saved!',
            type: 'success'
          })
          break
        case NOTIFICATION_ACTIONS.UPDATE_SORT:
          updateTracksOrder()
          break
        case NOTIFICATION_ACTIONS.UPDATE_DESCRIPTION:
          updatePlaylistDescription()
          break
        case NOTIFICATION_ACTIONS.UPDATE_PLAYLIST:
            notify({ title: 'Please, wait', text: 'Saving playlist...', type: 'info'})
            const result = await savePlaylist(state.playlist)
            if (! result) {
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
    if ((!value) && (state.notificationAction == NOTIFICATION_ACTIONS.UPDATE_DESCRIPTION)) {
      editPlaylistDescription.value = false
    }
    state.notificationAction = ''
  }

  const handleTouchStart = (currentTrack) => {
    setTimeout(() => {
      if (currentTrack.opened) {
        currentTrack.opened = false
        return
      }
      state.tracks = state.tracks.map(track => ({
        ...track,
        opened: track === currentTrack
      }));  
    }, 100);
  }

  const handleMouseOver = (currentTrack) => {
    state.tracks = state.tracks.map(track => ({
      ...track,
      opened: track === currentTrack
    }));  
  }

  const moveTrackUp = (track, pos) => {
    state.tracks.splice(pos, 1)
    state.tracks.splice(pos - 1, 0, track)
    checkDifferentSort()
  }

  const moveTrackDown = (track, pos) => {
    state.tracks.splice(pos, 1)
    state.tracks.splice(pos + 1, 0, track)
    checkDifferentSort()
  }

  const getTopArtists = async() => {
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
        .sort((a, b) => b.count - a.count) // Ordena de forma decrescente pela quantidade de músicas
        .slice(0, 5); // Pega os 5 primeiros

    const top5ArtistIds = sortedArtists.map(artist => artist.id).join(',');
    const topArtists = await getArtists(top5ArtistIds);

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

    // Contagem de artistas e coleta de IDs únicos
    state.tracks.forEach(track => {
        track.track.artists.forEach(artist => {
            const artistId = artist.id;
            // Adiciona o ID ao conjunto de IDs únicos
            uniqueArtistIds.add(artistId);
        });
    });

    // Converte o conjunto de IDs para array
    const allArtistIds = Array.from(uniqueArtistIds);
    
    // Array para armazenar todos os artistas com detalhes
    let allArtistsDetails = [];
    
    // Processa artistas em lotes de 50 (limite da API do Spotify)
    for (let i = 0; i < allArtistIds.length; i += 50) {
        const idsBatch = allArtistIds.slice(i, i + 50).join(',');
        const artistsBatch = await getArtists(idsBatch);
        allArtistsDetails = allArtistsDetails.concat(artistsBatch);
    }
    
    const genreCount = {};
    
    // Conta a ocorrência de cada gênero
    allArtistsDetails.forEach(artist => {
        if (artist.genres && Array.isArray(artist.genres)) {
            artist.genres.forEach(genre => {
                genreCount[genre] = (genreCount[genre] || 0) + 1;
            });
        }
    });
    
    // Transforma o objeto de contagem em array, ordena e pega os principais
    const topGenres = Object.entries(genreCount)
        .map(([genre, count]) => ({ genre, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    await playlistStore.loadTopGenres(state.playlist.id, topGenres)
  }

  const circleStyle = (index) => {
    return {
      right: `${0 + index * 7}%`,
    };
  };

  const openEditPlaylistDescription = (includeTopArtists=false) => {
    var description = state.playlist.description
    if (includeTopArtists) {
      description = removePartFromText(state.playlist.description)
        + ' Top artistas: ' 
        + state.playlist?.topArtists?.slice(0, 3).map(artist => artist.name).join(', ')
    }
    state.playlistDescription = description
    editPlaylistDescription.value = !editPlaylistDescription.value
    showNotification(
      NOTIFICATIONS_TYPE.info,
      'Info',
      'Save this description on Spotify ?',
      true,
      false
    )
    state.notificationAction = NOTIFICATION_ACTIONS.UPDATE_DESCRIPTION
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
      state.notificationAction = NOTIFICATION_ACTIONS.UPDATE_PLAYLIST
      return
    }

    if (await hasSilentChangesFromDatabase(data)) {
      const result = await savePlaylist(data)
      console.log(result)
      if (! result) {
        notify({
            title: 'Ops',
            text: 'It´s not possible to save the Playlist at this time.',
            type: 'error'
        })
      }
    }
  }

  onMounted(async () => {
    progress.start()
    if (! playlistStore.isLoaded) {
      const playlists = await loadAllFromDatabase()
      playlistStore.loadAll(playlists)
    }
    state.playlist = await playlistStore.getPlaylist(playlistId.value)

    if ((! state.playlist.followers) || (state.playlist.images.length == 0)) {
      const { data } = await getPlaylist(playlistId.value)
      await identifyPlaylistChanges(data)
      playlistStore.load(data)
      state.playlist = await playlistStore.getPlaylist(playlistId.value)
    }
    await getPlaylistTracks()
    if (! state.chartData.datasets[0]?.data) {
      getLikesStats(false)
    }
    checkTracksStatistics()
    progress.finish()
  })

</script>

<template>
  <Notification 
    :open="notificationOpened"
    :data="notificationData"
    @notification-action="onNotificationAction"
  />
  <FloatMenu 
    :menu-opened="menuOpened"
    :menu-data="menuData"
    :user-data="currentUser"
    @update-menu-opened="onUpdateMenuOpened" 
    @remove-track="onRemoveTrack"
    @refresh-playlist="onRefreshPage"
    @add-queue="addToQueue"
    @openStatistics="onOpenStatistics"
    @openArtists="onOpenArtists"
    />
  <div class="page">    
    <vue-basic-alert :duration="300" :closeIn="3000" ref="alert" />
    <center v-if="state.isProcessing"><p style="color:white"><font-awesome-icon style="color:white" icon="spinner"/>  {{ state.message }}</p></center>
    <div class="cover">
      <img class="img-album" :src="state.playlist?.images ? state.playlist?.images[0]?.url : state.playlist?.image" />
      <div style="display: flex;flex-direction:column;justify-content:space-around">
        <h3 class="playlist-title">{{state.playlist?.name}}</h3>
        <div class="top-3-artists">
          <div v-if="state.playlist?.topArtists?.length>0" class="circle-container" :style="circleStyle(0)"><img :src="state.playlist?.topArtists[0]?.images[0]?.url" class="music-cover"/></div>
          <div v-if="state.playlist?.topArtists?.length>1" class="circle-container" :style="circleStyle(1)"><img :src="state.playlist?.topArtists[1]?.images[0]?.url" class="music-cover"/></div>
          <div v-if="state.playlist?.topArtists?.length>2" class="circle-container" :style="circleStyle(2)"><img :src="state.playlist?.topArtists[2]?.images[0]?.url" class="music-cover"/></div>
          <div v-if="state.playlist?.topArtists?.length>3" class="circle-container" :style="circleStyle(3)"><img :src="state.playlist?.topArtists[3]?.images[0]?.url" class="music-cover"/></div>
          <div v-if="state.playlist?.topArtists?.length>4" class="circle-container" :style="circleStyle(4)"><img :src="state.playlist?.topArtists[4]?.images[0]?.url" class="music-cover"/></div>          
        </div>
      </div>
    </div>
    <div class="playlist-header">      
      <div class="playlist-description">
        <p class="playlist-subtitle" v-if="!editPlaylistDescription" @click="openEditPlaylistDescription()">{{state.playlist?.description || 'Edit description...'}} </p>
        <textarea class="input-playlist-description" type="text" v-if="editPlaylistDescription" v-model="state.playlistDescription"/>
        <p class="playlist-subtitle" @click="openEditPlaylistDescription(true)">Top artists: {{state.playlist?.topArtists?.slice(0, 5).map(artist => artist.name).join(', ')}} </p>
        <p class="playlist-subtitle">Top Genres: {{state.playlist?.genres?.map(genre => genre.genre).join(', ')}} </p>
      </div>
    </div>
    <div class="playlist-sub">
      <button class="button-spotify">
        <font-awesome-icon :icon="currentPlaying?.is_playing ? 'pause' : 'play'" style="vertical-align:middle;margin-left:3px;" @click="executeUserPlaylist()" />
      </button>
      <div class="playlist-details">
        <p class="playlist-subtitle" style="margin-top:10px;cursor: pointer;" @click="openMenuPlaylist()"><font-awesome-icon icon="ellipsis-v" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" /></p>
        <div style="display: flex;flex-direction: column;justify-content: center;">
          <p class="playlist-subtitle" style="margin:0px">{{state.playlist?.followers?.total}} <font-awesome-icon icon="heart" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" /></p>
          <p style="margin:0px" v-if="state.dataLikes[state.dataLikes?.length - 2] && ((state.playlist?.followers?.total - state.dataLikes[state.dataLikes?.length - 2]?.likes_count) != 0)"
            :class="{
              'playlist-subtitle' : true,
              'icon-popularity-bad' : ((state.playlist?.followers?.total - state.dataLikes[state.dataLikes?.length - 2]?.likes_count) < 0), 
              'icon-popularity-good' : ((state.playlist?.followers?.total - state.dataLikes[state.dataLikes?.length - 2]?.likes_count) > 0)
            }"
          >
            <font-awesome-icon v-if="(state.playlist?.followers?.total < state.dataLikes[state.dataLikes?.length - 2]?.likes_count)" class="icon-popularity-bad" icon="arrow-down"/>
            <font-awesome-icon v-if="(state.playlist?.followers?.total > state.dataLikes[state.dataLikes?.length - 2]?.likes_count)" class="icon-popularity-good" icon="arrow-up"/>
            {{(state.playlist?.followers?.total - state.dataLikes[state.dataLikes?.length - 2]?.likes_count)}}
          </p>
        </div>
        <p @click="teste" class="playlist-subtitle" style="margin-top:10px">{{state.tracks?.length}} items</p>
        <p class="playlist-subtitle" style="margin-top:10px;cursor: pointer;" @click="sortUserPlaylist()">{{sortOptions[state.sortPosition]}} <font-awesome-icon icon="sort" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" /></p>
      </div>
    </div>    
    <div class="statistics" v-if="state.statisticsOpen">
      <p style="font-size: 20px;text-align:end;" @click="onOpenStatistics">
        <font-awesome-icon icon="times" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" />
      </p>
      <h3 style="color: #fff;text-align:center">Likes statistics:</h3>
      <Line
        id="chart-likes"
        v-if="state.chartData.datasets.length > 0"
        :options="state.chartOptions"
        :data="state.chartData"
      />      
      <h3 style="color: #fff;text-align:center">Popularity statistics:</h3>
      <Pie
        id="chart-popularity"
        v-if="state.chartDataPopularity.datasets.length > 0"
        :options="state.chartOptions"
        :data="state.chartDataPopularity"
      />      
    </div>
    <div class="statistics" v-if="state.artistsOpen">
      <p style="font-size: 20px;text-align:end;" @click="onOpenArtists">
        <font-awesome-icon icon="times" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" />
      </p>
      <h3 style="color: #fff;text-align:center">Top artists:</h3>
      <ul class="list">
        <li :id="artist?.id" 
          v-for="(artist, i) in state.topArtists" 
          class="list-item"
          :key="artist"
        >
          <div class="list-item-div" style="height: 80px">
            <div class="list-item-position">
              {{i + 1}}
              <p v-if="state.differentSort && artist.id != i" style="font-size:60%;margin:0;color:rgb(30, 215, 96)">{{i+1}}</p>
            </div>
            <div class="circle-container">
              <img :src="artist.images[artist.images.length - 1]?.url" class="music-cover"/>
            </div>
            <div class="list-item-content">                
              <div class="list-item-title" style="font-size:large">
                {{artist.name}}
              </div>
              <div style="display:flex;flex-direction:column;width:100%;justify-content: space-between;">
                <div class="list-item-subtitle">{{ artist.genres.map(genre => genre).join(', ') }}</div>
                <div class="list-item-subtitle" style="color: rgb(124, 123, 123);font-size:10px;" >{{ artist.count }} tracks on this playlist</div>
              </div>
            </div>
            <div style="display: flex;flex-direction: column;justify-content: space-between;">
              <div class="list-item-popularity">
                <font-awesome-icon v-if="(artist?.popularity <= 40)" class="icon-popularity-bad" icon="chart-line"/>
                <font-awesome-icon v-else-if="(artist?.popularity > 40 && artist.popularity <= 70)" class="icon-popularity-medium" icon="chart-line"/>
                <font-awesome-icon v-else-if="(artist?.popularity > 70)" class="icon-popularity-good" icon="chart-line"/>
                {{artist?.popularity}}%                
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>
    <div class="list-list" v-if="(!state.statisticsOpen) && (!state.artistsOpen)">
      <ul class="list">
        <li :id="track.track?.id" 
          v-for="(track, i) in state.tracks" 
          class="list-item"
          :key="track"
        >
          <div class="list-item-div" :class="{'opened' : track.opened}" style="cursor: pointer;" @mouseover="handleMouseOver(track)"><!---->
            <div class="list-item-position">
              {{track.id + 1}}
              <p v-if="state.differentSort && track.id != i" style="font-size:60%;margin:0;color:rgb(30, 215, 96)">{{i+1}}</p>
            </div>
            <img :src="track.track?.album.images[track.track?.album.images.length - 1]?.url" class="music-cover"/>
            <div class="list-item-content">                
              <div :class="track.track?.uri === currentPlaying?.item?.uri ? 'list-item-title-playing' : 'list-item-title'">
                <font-awesome-icon v-if="track.track?.tracked" icon="heart" style="vertical-align:middle;margin-right:5px;color: rgb(30, 215, 96);;" />
                {{track.track?.name}}
              </div>
              <div style="display:flex;flex-direction:column;width:100%;justify-content: space-between;">
                <div class="list-item-subtitle">{{ track.track?.artists.map(artist => artist.name).join(', ') }}</div>
                <div class="list-item-subtitle" style="color: rgb(124, 123, 123);font-size:10px;" >Added {{ new Date(track.added_at).toLocaleDateString() }}</div>
              </div>
            </div>
            <div style="display: flex;flex-direction: column;justify-content: space-between;">
              <div class="list-item-popularity">
                <font-awesome-icon v-if="(track.track?.popularity <= 40)" class="icon-popularity-bad" icon="chart-line"/>
                <font-awesome-icon v-else-if="(track.track?.popularity > 40 && track.track.popularity <= 70)" class="icon-popularity-medium" icon="chart-line"/>
                <font-awesome-icon v-else-if="(track.track?.popularity > 70)" class="icon-popularity-good" icon="chart-line"/>
                {{track.track?.popularity}}%                
              </div>

              <div v-if=" ((track.track?.popularity - track.track?.popularity_old) != 0)" style="margin-top: 2px;" 
                :class="{
                  'list-item-popularity' : true, 
                  'icon-popularity-bad' : ((track.track?.popularity - track.track?.popularity_old) < 0), 
                  'icon-popularity-good' : ((track.track?.popularity - track.track?.popularity_old) > 0)
                }">
                <font-awesome-icon v-if="(track.track?.popularity < track.track?.popularity_old)" class="icon-popularity-bad" icon="arrow-down"/>
                <font-awesome-icon v-if="(track.track?.popularity > track.track?.popularity_old)" class="icon-popularity-good" icon="arrow-up"/>
                {{(track.track?.popularity - track.track?.popularity_old)}}
              </div>
            </div>
            <p @click="handleTouchStart(track)" class="playlist-subtitle" style="margin-top:10px;cursor: pointer;"><font-awesome-icon icon="ellipsis-v" style="vertical-align:middle;margin:0px 5px;color: #b3b3b3;" /></p>
          </div>
          <div v-if="track.opened" class="list-item-div opened bordered-down"><!---->
            <button class="button-options" @click="executeTrack(track)">
              <font-awesome-icon icon="play" style="vertical-align:middle;margin-left:3px;" />
              <p>Play</p>
            </button>
            <button class="button-options" @click="moveTrackUp(track, i)" v-if="track.id > 0 && state.playlist.owner.display_name == currentUser.display_name">
              <font-awesome-icon icon="chevron-up" style="vertical-align:middle;margin-left:3px;" />
              <p>Up</p>
            </button>
            <button class="button-options" @click="moveTrackDown(track, i)" v-if="track.id < state.tracks.length - 1 && state.playlist.owner.display_name == currentUser.display_name">
              <font-awesome-icon icon="chevron-down" style="vertical-align:middle;margin-left:3px;" />
              <p>Down</p>
            </button>
            <button class="button-options" @click="trackInfo(track)">
              <font-awesome-icon icon="info" style="vertical-align:middle;margin-left:3px;" />
              <p>Info</p>
            </button>
            <button class="button-options" @click="trackInfo(track, true)">
              <font-awesome-icon icon="plus" style="vertical-align:middle;margin-left:3px;" />
              <p>Add</p>
            </button>
          </div>
        </li>
      </ul>
    </div>
    <div style="color:#1c1c1c">
      {{ removeTrack }}
    </div>
  </div>
</template>

<style scoped>
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: auto;
}
.button-spotify {
  border-radius: 33px;
  padding: 0px 15px;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 19px;
  outline: none;
  cursor: pointer;
  background: rgb(30, 215, 96);
  color: black;
  border: 1px solid rgb(30, 215, 96);
  height: 50px;
  width: 50px;
}
.button-spotify-noborder {
  padding: 0px 15px;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 19px;
  outline: none;
  cursor: pointer;
  background: none;
  color: #fff;
  border: none;
  height: 50px;
  width: 50px;
}
.button-options {
  border-radius: 3px;
  padding: 0px 15px;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 19px;
  outline: none;
  cursor: pointer;
  background: #232424;
  color: #999797;
  border: 0px solid #999797;
  height: 50px;
  width: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.button-options > p {
  font-size: 0.7rem;
  margin-top: 5px;
  margin-bottom: 0;
}
.img-album {
  width: 100px;
  height: auto;
  padding: 10px
}
.playlist-header {
  display:flex; 
  flex-direction:row;
  margin-top: 10px;
}
.playlist-description {
  width: 100%;
  display:flex;
  flex-direction:column;
  margin-left:5px
}
.input-playlist-description {
  width: 95%;
  height: 80px;
  background-color: #232424;
  border: 0px;
  border-radius: 5px;
  padding: 10px;
  color: #fff;
  resize: none;
  font-size: 150%;
  vertical-align: top;
}
.playlist-title {
  color:#fff;
  margin: 0px;
  width: 75%;
}
.playlist-subtitle {
  margin-top: 0px;
  color:#999797;
  font-size:12px;
}
.playlist-sub {
  height: 50px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
.playlist-details {
  display: flex;
  flex-direction: row;
  justify-content: space-evenly;
  min-width: 300px;
  margin-top: 10px;
}
.statistics {
  height: auto;
  padding: 5px 15px;
  margin-top: 10px;
}
#chart-likes {
  margin-bottom: 50px;
}
#chart-popularity {
  margin-bottom: 100px;
}
.music-cover {
  width: 50px; 
  height: 50px;
  margin-right: 7px;
}
.list-list {
  margin-bottom: 80px;
  padding: 5px;
}
.list {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: auto;
  padding: 0px;
}
.list-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: auto;
  width: 100%;
  height: auto;
  cursor: grab;
  user-select: none;
}
.list-item-div {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  margin: auto;
  width: 100%;
  height: 65px;
}
.opened {
  background-color: #232424;
}
.bordered-down {
  border-radius: 0px 0px 15px 15px;
}
.list-item-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  margin: auto;
  flex: 90%;
  overflow: hidden;
}
.list-item-title {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  color: #fff;
  width: 100%;
  white-space: nowrap;
}
.list-item-title-playing {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  color: rgb(30, 215, 96);
  width: 100%;
}
.list-item-popularity{
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: flex-end;
  color: #fff;
  font-size: 11px;
  margin-left: 5px;
}
.list-item-position{
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  color: #616161;
  width: 15%;
  font-size: 24px;
}
.icon-popularity-bad{
  color: rgb(255, 23, 23);
  margin-right: 3px;
  margin: 0px 3px;
}
.icon-popularity-medium{
  color: rgb(255, 240, 30);
  margin: 0px 3px;
}
.icon-popularity-good{
  color: rgb(117, 255, 24);
  margin: 0px 3px;
}
.list-item-subtitle {
  display: flex;
  flex-direction: column;
  align-items: baseline;
  justify-content: flex-start;
  color: #999;
  font-size: 11px;
  text-align: left;
  width: 100%;
  margin-top: 4px;
}

.circle-container {
  width: 100px;
  height: 65px;
  overflow: hidden;
  border-radius: 50%;
  margin-right: 15px;
}

.circle-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover {
  height: auto;
  display: flex;
  flex-direction: row;
}
.cover .circle-container {
  width: 60px;
  height: 60px;
  overflow: hidden;
  border-radius: 50%;
  /*top: 40%;*/
  position: relative;
}
.top-3-artists {
  display: flex;
}
</style>
