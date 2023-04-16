<script setup>
  import { onMounted, computed, reactive, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import VueBasicAlert from 'vue-basic-alert'
  import { useGeneral, useProfile } from '@/support/spotifyApi'
  const route = useRoute();
  const { getPlaylist, getTracks } = useGeneral()
  const { executePlaylist } = useProfile()

  const playlistId = computed(() => route.params.id);
  const emit = defineEmits([
    'update-menu-opened',
    'update-menu-data',
    'force-refresh'
  ])
  //const isMenuOpened = ref(null)

  const ALERT_OPTIONS = { 
    iconSize: 35, // Size of the icon (px)
    iconType: 'solid', // Icon styles: now only 2 styles 'solid' and 'regular'
    position: 'top right' // Position of the alert 'top right', 'top left', 'bottom left', 'bottom right'
  } 

  const state = reactive({
    isPlaying: false,
    playlist: null,
    tracks: [],
    visible: false,
  })

  const props = defineProps({
    userData: {
        type: Object,
        default: () => { },
    },
    forceRefresh: {
        type: Boolean,
        default: false,
    }
  });

  const currentUser = computed(() => {
    return props.userData;
  });

  const forceRefresh = computed(() => {
    getPlaylistTracks(playlistId.value)
    emit('force-refresh', false)
    return props.forceRefresh
  })

  const alert = ref(null)

  const openPlaylistApp = (playlistId) => {
    window.open(`https://open.spotify.com/playlist/${playlistId}`)
  }

  const getPlaylistTracks = async(playlistId) => {
    const { data } = await getTracks(playlistId)
    state.tracks = data.items
  }

  const executeUserPlaylist = async() => {
    try{
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
        'error', // There are 4 types of alert: success, info, warning, error
        error.response.data.error.message, // Message of the alert
        'Ops', // Header of the alert
        ALERT_OPTIONS
      )
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

  const test = () => {
    emit('update-menu-opened', true)
  }

  onMounted(async () => {
    const { data } = await getPlaylist(playlistId.value)
    state.playlist = data
    getPlaylistTracks(playlistId.value)
  })

</script>

<template>
  <div class="page">
    <vue-basic-alert :duration="300" :closeIn="3000" ref="alert" />
    <img class="center img-album" :src="state.playlist?.images[0]?.url" />
    <div class="playlist-header">
      <button class="button-spotify">
        <font-awesome-icon :icon="state.isPlaying ? 'pause' : 'play'" style="vertical-align:middle;margin-left:3px;" @click="executeUserPlaylist()" />
      </button>
      <div class="playlist-description">
        <h3 class="playlist-title">{{state.playlist?.name}}</h3>
        <p class="playlist-subtitle">{{state.playlist?.description}} </p>
      </div>
    </div>
    <p class="center playlist-subtitle" style="margin-top:10px">{{state.playlist?.followers.total}} seguindo</p>
    <br>
    <div class="list-list">
      <ul class="list">
        <li :id="track.track.id" v-for="track in state.tracks" class="list-item">
          <div class="list-item-div">
            <img :src="track.track.album.images[0].url" class="music-cover"/>
            <div class="list-item-content">                
              <div class="list-item-title">
                {{track.track.name}}
              </div>
              <div class="list-item-subtitle">{{track.track.artists[0].name}}</div>
            </div>
            <div class="list-item-popularity">
              <font-awesome-icon v-if="(track.track.popularity < 40)" class="icon-popularity-bad" icon="chart-line"/>
              <font-awesome-icon v-else-if="(track.track.popularity >= 40 && track.track.popularity < 70)" class="icon-popularity-medium" icon="chart-line"/>
              <font-awesome-icon v-else-if="(track.track.popularity >= 70)" class="icon-popularity-good" icon="chart-line"/>
              {{track.track.popularity}}%
            </div>
            <div class="list-item-popularity" style="width: 50px;" @click="holdItem($event)">
              <img class="center" alt="options" src="../assets/options.png" style="width: 30px;"/>
            </div>
          </div>
        </li>
      </ul>
    </div>
    <div class="footer">
      <img class="center" alt="evaldorc" src="https://www.evaldorc.com.br/assets/images/marca_w.png" @click="openLink('https://evaldorc.com.br')"/>
    </div>
    <div>{{ forceRefresh }}</div>
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
