<script setup>
  import { onMounted, computed, reactive, ref } from 'vue'
  import VueBasicAlert from 'vue-basic-alert'
  import { useProfile, useGeneral } from '@/support/spotifyApi'

  const { 
    getTopItens, 
    getProfile, 
    getPlaylists,
    getDevices, 
    getPlaybackState, 
    transferPlayback, 
    addTrackToQueue 
  } = useProfile();

  const { getTracks } = useGeneral();

  const msg = ref('Gerador de playlist aleatória do Spotify')

  const ALERT_OPTIONS = { 
    iconSize: 35, // Size of the icon (px)
    iconType: 'solid', // Icon styles: now only 2 styles 'solid' and 'regular'
    position: 'top right' // Position of the alert 'top right', 'top left', 'bottom left', 'bottom right'
  } 

  const state = reactive({
    isProcessing: false,
    isPlaying: false,
    playlists: [],
    devices: [],
    tracks: [],
    topTracks: [],
    popTracks: [],
    user: null,
    userPopularity: 0,
    message: '',
  })

  const props = defineProps({
    userData: {
        type: Object,
        default: () => { },
    },
  });

  const currentUser = computed(() => {
    return props.userData;
  });

  const alert = ref(null)

  const getUserTopItems = async() => {
    const { data } = await getTopItens()
    state.topTracks =data.items
    testPopularityLevel();
  }

  const getUserPlaylists = async() => {
    const { data } = await getPlaylists()
    state.playlists = data.items
    state.playlists = state.playlists.filter(
      playlist => playlist.owner.display_name == state.user.display_name
    )
  }

  const getPlaylistTracks = async(playlistId) => {
    const { data } = await getTracks(playlistId)
    state.tracks = state.tracks.concat(data.items)
  }

  const getUserPlaylistTracks = async() => {
    state.isProcessing = true
    state.message = 'Buscando músicas, aguarde...'  
    await getUserPlaylists()
    state.tracks = []
    const unresolved = state.playlists.map(async(playlist) => {
      await getPlaylistTracks(playlist.id)
    })
    await Promise.all(unresolved)
    filterPopTracks()
    state.isProcessing = false
    state.message = ''
  }

  const filterPopTracks = () => {
    state.popTracks = state.tracks
    state.popTracks.sort((a, b) => b.track.popularity - a.track.popularity)
    state.popTracks = state.popTracks.slice(0, 49)
  }

  const testPopularityLevel = ()=>{
    let popularity = 0;
    const tracks = state.topTracks;
    tracks.map(async(item) => {
      let track = JSON.parse(JSON.stringify(item));
      popularity+=track.popularity;
    });
    state.userPopularity = popularity / state.topTracks.length;
  }

  const openLink = (url) => {
    window.open(url, '_blank')
  }

  const executePlaylist = async() => {  
    state.isProcessing = true
    state.message = 'Adicionando músicas a fila de reprodução, aguarde...'  
    const { data } = await getPlaybackState()
    state.isPlaying = data.is_playing
    if(!state.isPlaying){
      const { data } = await getDevices()
      state.devices = data.devices
      if(state.devices.length == 0){
        let message = 'Nenhum dispositivo conectado, não foi possivel executar a playlist!'
        state.message = message
        alert.value.showAlert(
          'info', // There are 4 types of alert: success, info, warning, error
          message, // Message of the alert
          'Informação', // Header of the alert
          ALERT_OPTIONS
        )
        state.isProcessing = false
        return
      }
      const device_id = state.devices[0].id
      const formData = {
        "device_ids": [device_id],
        "play": true
      }
      await transferPlayback(formData)
    }

    let added = false
    while (state.popTracks.length > 0) {
      let track = state.popTracks.shift()
      await addTrackToQueue(track.track.uri)
    }
    added = true
    
    if(!added){
      alert.value.showAlert(
        'error', // There are 4 types of alert: success, info, warning, error
        `Não foi possivel adicionar as músicas a lista de reprodução! Tente salvar a playlist e tentar novamente.`, // Message of the alert
        'Ops', // Header of the alert
        ALERT_OPTIONS
      )
      state.isProcessing = false
      return
    }
    let message = `As músicas foram adicionadas a lista de reprodução!`
    alert.value.showAlert(
      'success', // There are 4 types of alert: success, info, warning, error
      message, // Message of the alert
      'Tudo certo', // Header of the alert
      ALERT_OPTIONS
    )
    state.message = message
    state.isProcessing = false
  }

  onMounted(async () => {      
    const { data } = await getProfile()
    state.user = data
  })

</script>

<template>
  <div class="page">
    <h2 class="center title">{{ msg }}</h2>
    <vue-basic-alert :duration="300" :closeIn="3000" ref="alert" />
    <router-link to="/randomic" style="text-decoration:none">
      <button class="btn-generate">
        <font-awesome-icon icon="play" /> Começar
      </button>
    </router-link>
    <br><br><hr>
    <h3 class="center statistics-title">As top 10 de {{currentUser?.display_name}} </h3>
    <p class="center statistics-subtitle">No último mês</p>
    <button v-if="state.topTracks.length === 0" class="center btn-execute" @click="getUserTopItems()" :disabled="state.isProcessing">
      <p style="margin: 0" v-if="!(state.isProcessing)"> Buscar</p>
      <p style="margin: 0" v-if="(state.isProcessing)"><font-awesome-icon icon="hourglass" /> Buscando, aguarde...</p>
    </button>
    <p v-if="state.topTracks.length > 0" class="center" style="color: white;display: table;font-size: 12px;">
      <font-awesome-icon v-if="(state.userPopularity < 40)" class="icon-popularity-bad" icon="chart-line"/>
      <font-awesome-icon v-else-if="(state.userPopularity >= 40 && state.userPopularity < 70)" class="icon-popularity-medium" icon="chart-line"/>
      <font-awesome-icon v-else-if="(state.userPopularity >= 70)" class="icon-popularity-good" icon="chart-line"/>
      {{state.userPopularity}}
    </p>
    <div class="list-list">
      <ul class="list">
        <li v-for="track in state.topTracks" class="list-item">
          <img :src="track.album.images[0].url" class="music-cover" />
          <div class="list-item-content">                
            <div class="list-item-title">
              {{track.name}}
            </div>
            <div class="list-item-popularity">
              <font-awesome-icon v-if="(track.popularity < 40)" class="icon-popularity-bad" icon="chart-line"/>
              <font-awesome-icon v-else-if="(track.popularity >= 40 && track.popularity < 70)" class="icon-popularity-medium" icon="chart-line"/>
              <font-awesome-icon v-else-if="(track.popularity >= 70)" class="icon-popularity-good" icon="chart-line"/>
              {{track.popularity}}%
            </div>
          </div>
          <div class="list-item-subtitle">{{track.artists[0].name}}</div>
        </li>
      </ul>
    </div>
    <h3 class="center statistics-title">As top 50 mais populares de {{currentUser?.display_name}}: </h3>
    <button v-if="state.popTracks.length === 0" class="center btn-execute" @click="getUserPlaylistTracks()" :disabled="state.isProcessing">
      <p style="margin: 0" v-if="!(state.isProcessing)"> Buscar</p>
      <p style="margin: 0" v-if="(state.isProcessing)"><font-awesome-icon icon="hourglass" /> Buscando, aguarde...</p>
    </button>
    <button v-if="state.popTracks.length > 0" class="center btn-execute" @click="executePlaylist()" :disabled="state.isProcessing">
        <p style="margin: 0" v-if="!(state.isProcessing)"><font-awesome-icon icon="play" /> Adicionar à fila</p>
        <p style="margin: 0" v-if="(state.isProcessing)"><font-awesome-icon icon="hourglass" /> Adicionando, aguarde...</p>
    </button>
    <div class="list-list">
      <ul class="list">
        <li v-for="track in state.popTracks" class="list-item">
          <img :src="track.track.album.images[0].url" class="music-cover" />
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
        </li>
      </ul>
    </div>
    <div class="footer">
      <img class="center" alt="evaldorc" src="https://www.evaldorc.com.br/assets/images/marca_w.png" @click="openLink('https://evaldorc.com.br')"/>
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
.title {
  margin-top: 20px;
  color:#fff;
  text-align: center;
}
.statistics-title {
  margin-top: 20px;
  color:#fff;
}
.statistics-subtitle {
  margin-top: 0px;
  color:#fff;
  font-size:12px
}
.btn-generate {
  margin: 25px auto auto auto;
  background-image: linear-gradient(60deg, #e0eb98, #62faf5);
  color: black;
  border: none;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  border-radius: 20px;
  border: none;
}
.music-cover {
  width: 40px; 
  height: 40px;
  margin-right: 20px;
}
.list-list {
  margin-bottom: 50px;
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
    align-items: center;
    justify-content: flex-end;
    color: #fff;
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
.btn-execute{
    margin-top: 15px;
    background-image: linear-gradient(60deg, #e0eb98, #62faf5);
    color: #1c1c1c;
    border: none;
    padding: 10px 20px;
    border-radius: 20px;
    border: none;
    font-size: 16px;
    cursor: pointer;
    display: flex;
}
.footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  bottom: 85px;
  position: fixed;
  width: 100%;
  opacity: 0.3;
}
</style>
