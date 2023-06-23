<script setup>
  import { onMounted, computed, reactive, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import VueBasicAlert from 'vue-basic-alert'
  import { useGeneral, useProfile } from '@/support/spotifyApi'
  import { supabase } from '@/support/supabaseClient'
  import { Line, Pie } from 'vue-chartjs'
  import { Chart as ChartJS, Title, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, ArcElement } from 'chart.js'
  import { usePlaylistStore } from '@/stores/playlist'
  import FloatMenu from '@/components/FloatMenu.vue'
  import Notification from '@/components/Notification.vue'
  import { NOTIFICATIONS_TYPE } from '../support/helpers'

  ChartJS.register(Title, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, ArcElement)

  const route = useRoute();
  const playlistStore = usePlaylistStore()
  const { getPlaylist, getTracks, updateTracksOfPlaylist } = useGeneral()
  const { getPlaylists, executePlaylist, pausePlayback, addTrackToQueue } = useProfile()

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

  const state = reactive({
    isPlaying: false,
    playlist: null,
    tracks: [],
    visible: false,
    differentSort: false,
    sortPosition: 0,
    isProcessing: false,
    message: '',
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
    }
  })
  const isMenuOpened = ref(null)
  const menuDataReactive = ref(null)
  const isNotificationOpened = ref(null)
  const notificationDataReactive = ref(null)
  const alert = ref(null)

  const props = defineProps({
    userData: {
        type: Object,
        default: () => { },
    },
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
    }
  });

  const currentUser = computed(() => {
    return props.userData;
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

  const openPlaylistApp = (playlistId) => {
    window.open(`https://open.spotify.com/playlist/${playlistId}`)
  }

  const getPlaylistTracks = async(force = false) => {
    state.tracks = await playlistStore.getTracks(playlistId.value)
    if ((state.tracks.length === 0) || force) {
      showNotification(NOTIFICATIONS_TYPE.info, 'Please, wait', 'Loading songs...')
      playlistStore.loadTracks(playlistId.value, await getTracks(playlistId.value))
      state.tracks = await playlistStore.getTracks(playlistId.value)
      showNotification(NOTIFICATIONS_TYPE.success, 'Success', 'Songs loaded!', false, true)
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
      showNotification(NOTIFICATIONS_TYPE.success, 'Alright', 'Statistics registered!')
      getLikesStats()
    } catch (error) {
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

  const getLikesStats = async(save = true) => {
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

        if(data.length > 0) {
          const parcialData = {
            created_at: new Date(),
            id: Date.now(),
            likes_count: state.playlist.followers.total
          }
          data.push(parcialData)
          await mountLikeStatsChart(data)
          let diffDays = calcDiffDays(new Date(), new Date(data[data.length -1].created_at));
          if (diffDays < DIFF_DAY_TO_SAVE_NEW_STATISTICS) {
            return
          }
        }
      }
      if (save) {
        await saveStatistics()
      }
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

  const executeUserPlaylist = async() => {
    try{
      if (state.isPlaying) {
        const { status } = await pausePlayback()
        if (status != 204){
          openPlaylistApp(state.playlist.id)
          return
        }
        state.isPlaying = false

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
      state.isPlaying = true  
    }catch(error){
      console.log(error.response)
      showNotification(NOTIFICATIONS_TYPE.danger, 'Ops', error.response.data.error.message)
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
        return;
      }
    }
    state.differentSort = false
    isNotificationOpened.value = false
  }

  const openLink = (url) => {
    window.open(url, '_blank')
  }

  const holdItem = (event) => {
    let element = event.target
    while (element.tagName !== 'LI') {
      element = element.parentNode
    }
    let track = state.tracks.find(track => track.track.id === element.id)
    track['playlist'] = {
      id: state.playlist.id,
      owner: state.playlist.owner.display_name
    }

    let menuData = {
      type: 'track',
      track
    }
    menuDataReactive.value = menuData
    isMenuOpened.value = true
  }

  const openMenuPlaylist = async() => {
    let menuData = {
      type: 'playlist',
      playlist: state.playlist
    }
    let popularities = state.tracks.map(track => { return track.track.popularity })
    let popularity = popularities.reduce(function(a, b) {
      return a + b
    })
    menuData.playlist.isOwner = state.playlist.owner.display_name == currentUser.value.display_name
    menuData.playlist.popularity = (popularity / state.tracks.length).toFixed(2)
    if (! state.chartData.datasets[0]?.data) {
      await getLikesStats(false)
    }
    menuData.playlist.likesStats = state.chartData.datasets[0]?.data
    menuDataReactive.value = menuData
    isMenuOpened.value = true
  }

  const onRemoveTrack = async (value) => {
    playlistStore.removeTrack(playlistId.value, value)
    await getPlaylistTracks()
    sortUserPlaylist(false)
  }

  const onUpdateMenuOpened = (value) => {
    isMenuOpened.value = value
  }

  const onRefreshPage = async() => {
    const { data } = await getPlaylist(playlistId.value)
    state.playlist = data
    await getPlaylistTracks(true)
    sortUserPlaylist(false)
  }

  const addToQueue = async(track) => {
    try {
      const { status } = await addTrackToQueue(track)
      showNotification(NOTIFICATIONS_TYPE.success, 'Alright', 'Song added to queue!')
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

  const onNotificationAction = (value) => {
    isNotificationOpened.value = false
    if (value && state.differentSort) {
      updateTracksOrder()
    }
  }

  onMounted(async () => {
    if (! playlistStore.isLoaded) {
      const { data } = await getPlaylists()
      playlistStore.loadAll(data.items)
    }
    state.playlist = await playlistStore.getPlaylist(playlistId.value)
    if ((! state.playlist.followers) || (state.playlist.images.length == 0)) {
      const { data } = await getPlaylist(playlistId.value)
      playlistStore.load(data)
      state.playlist = await playlistStore.getPlaylist(playlistId.value)
    }    
    await getPlaylistTracks()
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
        @open-popularity="mountPopularityStatsChart"
        @open-likes="getLikesStats"
        @add-queue="addToQueue"
    />
  <div class="page">    
    <vue-basic-alert :duration="300" :closeIn="3000" ref="alert" />
    <center v-if="state.isProcessing"><p style="color:white"><font-awesome-icon style="color:white" icon="spinner"/>  {{ state.message }}</p></center>
    <img class="center img-album" :src="state.playlist?.images[0]?.url" />
    <div class="playlist-header">      
      <div class="playlist-description">
        <h3 class="playlist-title">{{state.playlist?.name}}</h3>
        <p class="playlist-subtitle">{{state.playlist?.description}} </p>
      </div>
    </div>
    <div class="playlist-sub">
      <button class="button-spotify">
        <font-awesome-icon :icon="state.isPlaying ? 'pause' : 'play'" style="vertical-align:middle;margin-left:3px;" @click="executeUserPlaylist()" />
      </button>
      <div class="playlist-details">
        <p class="playlist-subtitle" style="margin-top:10px;cursor: pointer;" @click="openMenuPlaylist()"><font-awesome-icon icon="ellipsis-v" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" /></p>
        <p class="playlist-subtitle" style="margin-top:10px">{{state.playlist?.followers?.total}} <font-awesome-icon icon="heart" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" /></p>
        <p @click="teste" class="playlist-subtitle" style="margin-top:10px">{{state.tracks?.length}} items</p>
        <p class="playlist-subtitle" style="margin-top:10px;cursor: pointer;" @click="sortUserPlaylist()">{{sortOptions[state.sortPosition]}} <font-awesome-icon icon="sort" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" /></p>
      </div>
    </div>
    <br>
    <Line
      id="chart-likes"
      v-if="state.chartData.datasets.length > 0"
      :options="state.chartOptions"
      :data="state.chartData"
    />
    <Pie
      id="chart-popularity"
      v-if="state.chartDataPopularity.datasets.length > 0"
      :options="state.chartOptions"
      :data="state.chartDataPopularity"
    />
    <br>
    <div class="list-list">
      <ul class="list">
        <li :id="track.track?.id" v-for="track in state.tracks" class="list-item">
          <div class="list-item-div" @click="holdItem($event)" style="cursor: pointer;">
            <img :src="track.track?.album.images[0].url" class="music-cover"/>
            <div class="list-item-content">                
              <div class="list-item-title">
                {{track.track?.name}}
              </div>
              <div style="display:flex;flex-direction:row;width:100%;justify-content: space-between;">
                <div class="list-item-subtitle">{{ track.track?.artists[0].name }}</div>
                <div class="list-item-subtitle" style="color: rgb(124, 123, 123);font-size:10px;align-items: end;" >Added {{ new Date(track.added_at).toLocaleDateString() }}</div>
              </div>
            </div>
            <div class="list-item-popularity">
              <font-awesome-icon v-if="(track.track?.popularity <= 40)" class="icon-popularity-bad" icon="chart-line"/>
              <font-awesome-icon v-else-if="(track.track?.popularity > 40 && track.track.popularity <= 70)" class="icon-popularity-medium" icon="chart-line"/>
              <font-awesome-icon v-else-if="(track.track?.popularity > 70)" class="icon-popularity-good" icon="chart-line"/>
              {{track.track?.popularity}}%
            </div>
          </div>
        </li>
      </ul>
    </div>
    <div class="footer">
      <img class="center" alt="evaldorc" src="https://www.evaldorc.com.br/assets/images/marca_w.png" @click="openLink('https://evaldorc.com.br')"/>
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
.img-album {
  width: 200px;
  padding: 10px
}
.playlist-header {
  display:flex; 
  flex-direction:row;
  margin-top: 10px;
}
.playlist-description {
  display:flex;
  flex-direction:column;
  margin-left:5px
}
.playlist-title {
  color:#fff;
  margin: 0px;
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
.music-cover {
  width: 40px; 
  height: 40px;
  margin-right: 20px;
}
.list-list {
  margin-bottom: 80px;
  padding: 10px;
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
}
.list-item-div {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  margin: auto;
  width: 100%;
  height: 50px;
}
.list-item-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    margin: auto;
    flex: 90%;
}
.list-item-title {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    color: #fff;
    width: 100%;
}
.list-item-popularity{
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    justify-content: flex-end;
    color: #fff;
    width: 10%;
    font-size: 11px;
    margin-left: 5px;
}
.icon-popularity-bad{
    color: rgb(255, 23, 23);
    margin-right: 3px;
}
.icon-popularity-medium{
    color: rgb(255, 240, 30);
    margin-right: 3px;
}
.icon-popularity-good{
    color: rgb(117, 255, 24);
    margin-right: 3px;
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
}
.footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  bottom: 85px;
  position: relative;
  width: 100%;
  opacity: 0.3;
}
</style>
