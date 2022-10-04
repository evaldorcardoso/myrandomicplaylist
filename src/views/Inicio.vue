<script setup>
  import { getCurrentInstance, onMounted, computed, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import VueBasicAlert from 'vue-basic-alert'
  import spotifyApi from '../api/spotifyApi'
  const msg = ref('Gerador de playlist aleatória do Spotify')

  // Map for localStorage keys
  const LOCALSTORAGE_KEYS = {
    code: 'spotify_code',
    accessToken: 'spotify_access_token',
    refreshToken: 'spotify_refresh_token',
    expireTime: 'spotify_token_expire_time',
    timestamp: 'spotify_token_timestamp',
  }

  const getLocalStorage = () =>{
    // Map to retrieve localStorage values
    const LOCALSTORAGE_VALUES = {    
      code: window.localStorage.getItem(LOCALSTORAGE_KEYS.code),
      accessToken: window.localStorage.getItem(LOCALSTORAGE_KEYS.accessToken),
      refreshToken: window.localStorage.getItem(LOCALSTORAGE_KEYS.refreshToken),
      expireTime: window.localStorage.getItem(LOCALSTORAGE_KEYS.expireTime),
      timestamp: window.localStorage.getItem(LOCALSTORAGE_KEYS.timestamp),
    };
    return LOCALSTORAGE_VALUES
  }

  const ALERT_OPTIONS = { 
    iconSize: 35, // Size of the icon (px)
    iconType: 'solid', // Icon styles: now only 2 styles 'solid' and 'regular'
    position: 'top right' // Position of the alert 'top right', 'top left', 'bottom left', 'bottom right'
  } 

  const state = reactive({
    // title: 'Gerador de playlist aleatória do Spotify',
    isProcessing: false,
    randomic_playlist: null,
    is_playing: false,
    playlists: [],
    devices: [],
    tracks: [],
    top_tracks: [],
    recommendations: [],
    user: null,
    message: '',
  })

  const internalInstance = getCurrentInstance()
  const axios = internalInstance.appContext.config.globalProperties.axios
  const router = useRouter()
  const alert = ref(null)
  
  const hasTokenExpired = () => {
    const { accessToken, timestamp, expireTime } = getLocalStorage()
    let expired = true
    if(!accessToken || !timestamp || !expireTime){ 
      return true      
    }    
    const millisecondsElapsed = Date.now() - Number(timestamp)
    expired = (millisecondsElapsed / 1000) > Number(expireTime)
    if(expired){
      getRefreshedToken()
      return false
    }
  }

  const logout = () => {
    // Clear all localStorage items
    for (const property in LOCALSTORAGE_KEYS) {
      window.localStorage.removeItem(LOCALSTORAGE_KEYS[property]);
    }
    state.user = null
    router.push('/')
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  } 

  const getProfile = async() => {
    const { accessToken } = getLocalStorage()
    // alert('getprofile inicio, token: '+ accessToken)
    await axios
      .get('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        //console.log(response.data)
        state.user = response.data
      })
      .catch(error => {
        console.log('Houve um erro ao buscar seu perfil!')
        console.log(error)
        logout()
      })
  }

  const getDevices = async() => {
    const { accessToken } = getLocalStorage()
    await axios
      .get('https://api.spotify.com/v1/me/player/devices', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        console.log(response.data)
        //state.devices = response.data.devices
      })
  }

  const getUsersTopItems = async() => {
    const { accessToken } = getLocalStorage()
    await axios
      .get('https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=short_term', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        //console.log(response.data.items)
        state.top_tracks = response.data.items
        testPopularityLevel();
      })
  }

  const getUsersRecommendations = async() => {
    const { accessToken } = getLocalStorage()
    //console.log('toptracks: ' + state.top_tracks);
    const top_tracks = state.top_tracks.slice(0, 5).map((top_track) => {
      return top_track.id
    });
    //console.log('toptracks: '  + top_tracks);
    await axios
      .get('https://api.spotify.com/v1/recommendations?seed_tracks='+top_tracks, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        //console.log('recommendations:')
        //console.log(response.data.tracks)
        state.recommendations = response.data.tracks
        // testPopularityLevel();
      })
  }

  const testPopularityLevel = ()=>{
    var popularity = 0;
    const tracks = state.top_tracks;
    tracks.map(async(item) => {
      let track = JSON.parse(JSON.stringify(item));
      popularity+=track.popularity;
    });
    //console.log(popularity / state.top_tracks.length);
    state.user.popularity = popularity / state.top_tracks.length;
  }

  const getRefreshedToken = async() => {
    const { refreshToken } = getLocalStorage()
    const client_id = import.meta.env.VITE_SPOTIFY_CLIENT_ID
    const client_secret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET
    //the parameters encoded in application/x-www-form-urlencoded:
    const formData = new URLSearchParams()
    formData.append('grant_type', 'refresh_token')
    formData.append('refresh_token', refreshToken)
    await axios
      .post('https://accounts.spotify.com/api/token', formData, {
            headers: {
              Authorization: 'Basic ' + btoa(`${client_id}:${client_secret}`),
              "Content-type": "application/x-www-form-urlencoded"
            }
      })
      .then(response => {
        console.log(response.data)
        const { access_token, expires_in, timestamp } = response.data
        window.localStorage.setItem(LOCALSTORAGE_KEYS.accessToken, access_token)
        window.localStorage.setItem(LOCALSTORAGE_KEYS.expireTime, expires_in)
        localStorage.setItem(LOCALSTORAGE_KEYS.timestamp, Date.now())            
        router.push('/')
      })
      .catch(error => {
        console.log(error)
        alert('Houve um erro ao buscar o token!')
        logout()
      })
  }

  const openPlaylistApp = (playlist_id) => {
    window.open(`https://open.spotify.com/playlist/${playlist_id}`)
  }

  const openLink = (url) => {
    window.open(url, '_blank')
  }

  const getPlaybackState = async() => {
    try{
      const { accessToken } = getLocalStorage()
      const { is_playing } = await spotifyApi.getPlaybackState(accessToken)
      state.is_playing = is_playing
      console.log(state.is_playing)
    }
    catch(error){
      console.log(error)
      alert.value.showAlert(
        'error', // There are 4 types of alert: success, info, warning, error
        error.response, // Message of the alert
        'Ops', // Header of the alert
        ALERT_OPTIONS
      )
    }
  }

  const addTrackToQueue = async(track) => {
    try{
      const { accessToken } = getLocalStorage()
      await spotifyApi.addTrackToQueue(accessToken, track)
      return true
    }catch(error){
      console.log(error)
      alert.value.showAlert(
        'error', // There are 4 types of alert: success, info, warning, error
        error.response, // Message of the alert
        'Ops', // Header of the alert
        ALERT_OPTIONS
      )
      return false
    }
  }

  const executePlaylist = async() => {  
    state.isProcessing = true
    state.message = 'Adicionando músicas a fila de reprodução, aguarde...'  
    await getPlaybackState()
    if(!state.is_playing){
      await getDevices()      
      if(state.devices.length == 0){
        state.message = 'Nenhum dispositivo conectado, não foi possivel executar a playlist!'
        alert.value.showAlert(
          'info', // There are 4 types of alert: success, info, warning, error
          `Nenhum dispositivo conectado, não foi possível executar a playlist!`, // Message of the alert
          'Informação', // Header of the alert
          ALERT_OPTIONS
        )
        state.isProcessing = false
        return
      }
      const device_id = state.devices[0].id
      await transferPlayback(device_id)
    }
    const tracks = state.recommendations.map(track => track.uri)
    let added = false
    for (let i = 0; i < tracks.length; i++) {
      await new Promise(r => setTimeout(r, 500));
      added = await addTrackToQueue(tracks[i]);
    }
    if(!added){
      alert.value.showAlert(
        'error', // There are 4 types of alert: success, info, warning, error
        `Não foi possivel adicionar as músicas a lista de reprodução! Tente salvar a playlist e tentar novamente.`, // Message of the alert
        'Ops', // Header of the alert
        ALERT_OPTIONS
      )
      return
    }
    alert.value.showAlert(
      'success', // There are 4 types of alert: success, info, warning, error
      `As músicas foram adicionadas a lista de reprodução!`, // Message of the alert
      'Tudo certo', // Header of the alert
      ALERT_OPTIONS
    )
    state.message = 'As músicas foram adicionadas a lista de reprodução!'
    state.isProcessing = false
  }

  onMounted(async () => {
    if(hasTokenExpired()){              
      logout()
      return
    }      
    getProfile()
    // getPlaylists() 
    await getUsersTopItems()
    getUsersRecommendations();
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
    <h3 class="center statistics-title">As top 10 de {{state.user?.display_name}} </h3>
    <p class="center statistics-subtitle">No último mês</p>
    <p class="center" style="color: white;display: table;font-size: 12px;">
      <font-awesome-icon v-if="(state.user?.popularity < 40)" class="icon-popularity-bad" icon="chart-line"/>
      <font-awesome-icon v-else-if="(state.user?.popularity >= 40 && state.user?.popularity < 70)" class="icon-popularity-medium" icon="chart-line"/>
      <font-awesome-icon v-else-if="(state.user?.popularity >= 70)" class="icon-popularity-good" icon="chart-line"/>
      {{state.user?.popularity}}
    </p>
    <div class="list-list">
      <ul class="list">
        <li v-for="track in state.top_tracks" class="list-item">
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
    <h3 class="center statistics-title">Baseado no que você ouve: </h3>
    <button class="center btn-execute" @click="executePlaylist()" :disabled="state.isProcessing">
        <p style="margin: 0" v-if="!(state.isProcessing)"><font-awesome-icon icon="play" /> Adicionar à fila</p>
        <p style="margin: 0" v-if="(state.isProcessing)"><font-awesome-icon icon="hourglass" /> Adicionando, aguarde...</p>
    </button>
    <div class="list-list">
      <ul class="list">
        <li v-for="track in state.recommendations" class="list-item">
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
  background-color: #0c8d39;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
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
    flex-direction: row;
    align-items: center;
    justify-content: center;
    margin: auto;
    width: 100%;
    height: 50px;
}
.container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: right;
    flex: 10%;
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
    justify-content: flex-start;
    color: #fff;
    width: 100%;
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
    align-items: flex-end;
    justify-content: center;
    color: #999;
    font-size: 12px;
    text-align: right;
}
.btn-execute{
    margin-top: 15px;
    background-color: #ffffff;
    color: #1c1c1c;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
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
  position: relative;
  width: 100%;
  opacity: 0.3;
}
</style>
