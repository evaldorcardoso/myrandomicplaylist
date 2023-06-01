<script setup>
  import { onMounted, computed, reactive, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import VueBasicAlert from 'vue-basic-alert'
  import { useGeneral, useProfile } from '@/support/spotifyApi'
  import { supabase } from '@/support/supabaseClient'
  import { Line } from 'vue-chartjs'
  import { Chart as ChartJS, Title, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement } from 'chart.js'

  ChartJS.register(Title, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement,)

  const route = useRoute();
  const { getPlaylist, getTracks } = useGeneral()
  const { executePlaylist, pausePlayback } = useProfile()

  const playlistId = computed(() => route.params.id);
  const emit = defineEmits([
    'update-menu-opened',
    'update-menu-data',
    'force-refresh'
  ])

  const ALERT_OPTIONS = { 
    iconSize: 35,
    iconType: 'solid',
    position: 'top right'
  } 

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
    sortPosition: 0,
    chartData: {
      labels: [],
      datasets: []
    },
    chartOptions: {
      responsive: true
    }
  })

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
    }
  });

  const currentUser = computed(() => {
    return props.userData;
  });

  const forceRefresh = computed(() => {
    getPlaylistTracks()
    emit('force-refresh', false)
    return props.forceRefresh
  })

  const removeTrack = computed(() => {
    if ((props.removeTrack)&&(props.removeTrack !== '')) {
      state.tracks = state.tracks.filter(function(track) {
        return track.track.uri !== props.removeTrack
      })
      emit('remove-track', '')
    }
    return props.removeTrack
  })

  const alert = ref(null)

  const openPlaylistApp = (playlistId) => {
    window.open(`https://open.spotify.com/playlist/${playlistId}`)
  }

  const getPlaylistTracks = async() => {
    const { data } = await getTracks(playlistId.value)
    state.tracks = data.items
    state.tracks.forEach((track, index) => {
      track.id = index + 1
    })
  }

  const doRefresh = async() => {
    const { data } = await getPlaylist(playlistId.value)
    state.playlist = data
    await getPlaylistTracks()
    sortUserPlaylist(false)
  }

  const saveStatistics = async() => {
    try {
      const data = {
        likes_count: state.playlist?.followers.total,
        playlist_id: state.playlist?.id
      }

      let { error } = await supabase.from(import.meta.env.VITE_SUPABASE_PLAYLISTS_TABLE).insert(data)

      if (error) throw error

      alert.value.showAlert(
        'success',
        'Statistics registered!',
        'Alright',
        ALERT_OPTIONS
      )
    } catch (error) {
      console.log(error.message)
      alert.value.showAlert(
        'error',
        error.message,
        'Ops',
        ALERT_OPTIONS
      )
    }
  }

  const getStatistics = async() => {
    if(new Date().getDay() == 1) {
      console.log('save statistics for '+ state.playlist?.id)
      await saveStatistics()
    }
    try {
      let { data, error, status } = await supabase
        .from(import.meta.env.VITE_SUPABASE_PLAYLISTS_TABLE)
        .select(`likes_count, created_at`)
        .eq('playlist_id', state.playlist?.id)
        .order('created_at')

      if (error && status !== 406) throw error

      if (data) {
        let labels = data.map(row => new Date(row.created_at).toLocaleDateString())
        let likes = data.map(row => row.likes_count)
        state.chartData = {
        labels,      
        datasets: [
          {
            label: 'Likes',
            backgroundColor: '#1ed760',
            borderColor: '#fff',
            borderWidth: 1,
            data: likes
          }
        ]
        }
      }
    } catch (error) {
      console.log(error.message)
      alert.value.showAlert(
        'error',
        error.message,
        'Ops',
        ALERT_OPTIONS
      )
    } 
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
      alert.value.showAlert(
        'error',
        error.response.data.error.message,
        'Ops',
        ALERT_OPTIONS
      )
    }
  }

  const sortUserPlaylist = async(increment = true) => {
    if(increment) {
      state.sortPosition++
      if (state.sortPosition >= sortOptions.length) {
        state.sortPosition = 0
      }
    }
    
    if (sortOptions[state.sortPosition] === 'top first') {
      state.tracks.sort((a, b) => b.track.popularity - a.track.popularity)
      return
    }
    if (sortOptions[state.sortPosition] === 'top last') {
      state.tracks.sort((a, b) => a.track.popularity - b.track.popularity)
      return
    }
    if (sortOptions[state.sortPosition] === 'added first') {
      state.tracks.sort((a, b) => new Date(a.added_at) - new Date(b.added_at))
      return
    }
    if (sortOptions[state.sortPosition] === 'added last') {
      state.tracks.sort((a, b) => new Date(b.added_at) - new Date(a.added_at))
      return
    }
    if (sortOptions[state.sortPosition] === 'default') {
      state.tracks.sort((a, b) => a.id - b.id)
      return
    }
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
      isOwner: state.playlist.owner.display_name == currentUser.value.display_name
    }
    emit('update-menu-data', track)
    emit('update-menu-opened', true)
  }

  onMounted(async () => {
    const { data } = await getPlaylist(playlistId.value)
    state.playlist = data
    getPlaylistTracks()
    console.log('playlist id: '+ state.playlist?.id)
  })

</script>

<template>
  <div class="page">
    <vue-basic-alert :duration="300" :closeIn="3000" ref="alert" />
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
        <p class="playlist-subtitle" style="margin-top:10px" @click="doRefresh()"><font-awesome-icon icon="sync" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" /></p>
        <p class="playlist-subtitle" style="margin-top:10px" @click="getStatistics()"><font-awesome-icon icon="chart-bar" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" /></p>
        <p class="playlist-subtitle" style="margin-top:10px">{{state.playlist?.followers.total}} <font-awesome-icon icon="heart" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" /></p>
        <p class="playlist-subtitle" style="margin-top:10px">{{state.tracks?.length}} items</p>
        <p class="playlist-subtitle" style="margin-top:10px" @click="sortUserPlaylist()">{{sortOptions[state.sortPosition]}} <font-awesome-icon icon="sort" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" /></p>
      </div>
    </div>
    <br>
    <Line
      id="my-chart-id"
      v-if="state.chartData.datasets.length > 0"
      :options="state.chartOptions"
      :data="state.chartData"
    />
    <br>
    <div class="list-list">
      <ul class="list">
        <li :id="track.track.id" v-for="track in state.tracks" class="list-item">
          <div class="list-item-div" @click="holdItem($event)">
            <img :src="track.track.album.images[0].url" class="music-cover"/>
            <div class="list-item-content">                
              <div class="list-item-title">
                {{track.track.name}}
              </div>
              <div style="display:flex;flex-direction:row;width:100%;justify-content: space-between;">
                <div class="list-item-subtitle">{{ track.track.artists[0].name }}</div>
                <div class="list-item-subtitle" style="color: rgb(124, 123, 123);font-size:10px;align-items: end;" >Added {{ new Date(track.added_at).toLocaleDateString() }}</div>
              </div>
            </div>
            <div class="list-item-popularity">
              <font-awesome-icon v-if="(track.track.popularity < 40)" class="icon-popularity-bad" icon="chart-line"/>
              <font-awesome-icon v-else-if="(track.track.popularity >= 40 && track.track.popularity < 70)" class="icon-popularity-medium" icon="chart-line"/>
              <font-awesome-icon v-else-if="(track.track.popularity >= 70)" class="icon-popularity-good" icon="chart-line"/>
              {{track.track.popularity}}%
            </div>
          </div>
        </li>
      </ul>
    </div>
    <div class="footer">
      <img class="center" alt="evaldorc" src="https://www.evaldorc.com.br/assets/images/marca_w.png" @click="openLink('https://evaldorc.com.br')"/>
    </div>
    <div>
      {{ forceRefresh }}
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
