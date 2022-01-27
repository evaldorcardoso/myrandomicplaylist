<script setup>
  import { getCurrentInstance, onMounted, computed, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import spotifyApi from '../api/spotifyApi'
  import VueBasicAlert from 'vue-basic-alert'

  // Map for localStorage keys
  const LOCALSTORAGE_KEYS = {
    accessToken: 'spotify_access_token',
    refreshToken: 'spotify_refresh_token',
    expireTime: 'spotify_token_expire_time',
    timestamp: 'spotify_token_timestamp',
  }

  const ALERT_OPTIONS = { 
    iconSize: 35, // Size of the icon (px)
    iconType: 'solid', // Icon styles: now only 2 styles 'solid' and 'regular'
    position: 'top right' // Position of the alert 'top right', 'top left', 'bottom left', 'bottom right'
  } 

  const getLocalStorage = () =>{
    // Map to retrieve localStorage values
    const LOCALSTORAGE_VALUES = {    
      accessToken: window.localStorage.getItem(LOCALSTORAGE_KEYS.accessToken),
      expireTime: window.localStorage.getItem(LOCALSTORAGE_KEYS.expireTime),
      timestamp: window.localStorage.getItem(LOCALSTORAGE_KEYS.timestamp),
    };
    return LOCALSTORAGE_VALUES
  }

  const state = reactive({
    isProcessing: false,
    is_playing: false,
    randomic_playlist: null,
    playlists: [],
    tracks: [],
    devices: [],
    number_tracks: 2,
    user: null,
    message: '',
    step: 1,
  })

  const internalInstance = getCurrentInstance()
  // const axios = internalInstance.appContext.config.globalProperties.axios
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
    router.push('/login')
  }

  const getRefreshedToken = async() => {
    try{
      const { refreshToken } = getLocalStorage()
      const client_id = import.meta.env.VITE_SPOTIFY_CLIENT_ID
      const client_secret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET      
      const formData = new URLSearchParams()
      formData.append('grant_type', 'refresh_token')
      formData.append('refresh_token', refreshToken)
      const { access_token, expires_in, timestamp } = await spotifyApi.getRefreshedToken(formData, client_id, client_secret)              
      window.localStorage.setItem(LOCALSTORAGE_KEYS.accessToken, access_token)
      window.localStorage.setItem(LOCALSTORAGE_KEYS.expireTime, expires_in)
      localStorage.setItem(LOCALSTORAGE_KEYS.timestamp, Date.now())            
      router.push('/')
    }catch(error){
      console.log(error)
      alert.value.show({
        type: 'error',
        title: 'Error',
        message: 'Something went wrong, please try again later',
        options: ALERT_OPTIONS
      })
      logout()
    }
  }

  const getPlaylists = async() => {
    state.isProcessing = true
    try { 
      const { accessToken } = getLocalStorage()
      const { items } = await spotifyApi.getPlaylists(accessToken)
      state.playlists = items 
      state.isProcessing = false
    } catch (error) {
       state.isProcessing = false
    }
  }

  const getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
  }  

  const pickTracks = async(tracksitems) => {
    let tracksToPick = state.number_tracks
    let tracks = state.tracks.length
    if(state.number_tracks > tracksitems.length){
      tracksToPick = tracksitems.length
    }
    while(state.tracks.length < (tracks + tracksToPick)) {
      // let random = Math.floor(Math.random() * response.data.items.length)
      let random = getRandomInt(0, tracksitems.length)
      let track = tracksitems[random].track
      if(track){
        //somente adiciona se já não existir
        if(undefined == state.tracks.find(item => item.track.id === track.id)){
          track.checked = true
          state.tracks.push(track)
          await new Promise(r => setTimeout(r, 200));
        }
      }
      //limpa os itens repetidos em um array
      state.tracks = [...new Set(state.tracks)]            
    }
  }

  const getTracks = async(playlist_id) => {    
    try{ 
      const { accessToken } = getLocalStorage()
      const{ items } = await spotifyApi.getTracks(accessToken, playlist_id)
      return pickTracks(items)
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

  const generatePlaylist = async() => {    
    state.isProcessing = true
    state.message = 'Gerando playlist, aguarde...'
    state.randomic_playlist = null
    const playlists_selecteds = state.playlists.filter(item => item.checked)    
    state.tracks = []
    const unresolved = playlists_selecteds.map(async(playlist) => {
      await getTracks(playlist.id)
    })
    const resolved = await Promise.all(unresolved)
    alert.value.showAlert(
      'success', // There are 4 types of alert: success, info, warning, error
      `Playlist gerada com sucesso com ${state.tracks.length} músicas!`, // Message of the alert
      'Tudo certo', // Header of the alert
      ALERT_OPTIONS
    )
    state.message = ''
    state.isProcessing = false
  }

  const getProfile = async() => {
    try{
      const { accessToken } = getLocalStorage()
      state.user = await spotifyApi.getProfile(accessToken)       
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

  const getDevices = async() => {
    try{
      const { accessToken } = getLocalStorage()
      const { devices } = await spotifyApi.getDevices(accessToken)
      state.devices = devices        
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

  const startResumePlayback = async() => {
    try{
      const { accessToken } = getLocalStorage()
      await spotifyApi.startResumePlayback(accessToken)      
      state.is_playing = true
    }catch(error){
      console.log(error)
      alert.value.showAlert(
        'error', // There are 4 types of alert: success, info, warning, error
        error.response, // Message of the alert
        'Ops', // Header of the alert
        ALERT_OPTIONS
      )
    }
  }

  const skipToNext = async() => {
    try{
      const { accessToken } = getLocalStorage()
      await spotifyApi.skipToNext(accessToken)      
      getPlaybackState()    
    }catch(error){
      console.log(error)
      alert.value.showAlert(
        'error', // There are 4 types of alert: success, info, warning, error
        error.response, // Message of the alert
        'Ops', // Header of the alert
        ALERT_OPTIONS
      )
    }
  }

  const transferPlayback = async(device_id) => {
    try{
      const { accessToken } = getLocalStorage()
      const formData = {
        "device_ids": [device_id]
      }
      await spotifyApi.transferPlayback(accessToken, formData)      
      const device = state.devices.find(device => device.id === device_id)
      if((device.is_active)&&(!state.is_playing)){
        skipToNext()
        startResumePlayback()
      }    
    }catch(error){
      console.log(error)
      alert.value.showAlert(
        'error', // There are 4 types of alert: success, info, warning, error
        error.response, // Message of the alert
        'Ops', // Header of the alert
        ALERT_OPTIONS
      )
    }
  }

  const savePlaylist = async() => {
    try{  
      state.isProcessing = true
      const { accessToken } = getLocalStorage()
      const user_id = state.user.id
      const name = prompt('Informe o Nome da playlist: ', 'Playlist Aleatória')
      const description = 'Playlist gerada automaticamente pelo gerador de playlist aleatória do Spotify @evaldorcardoso'
      const _public = true    
      const formData = {
        'name' : name,
        'description': description,
        'public': _public
      }
      state.randomic_playlist = await spotifyApi.savePlaylist(accessToken, user_id, formData)      
      state.message = 'Playlist criada com sucesso!'
      alert.value.showAlert(
        'success', // There are 4 types of alert: success, info, warning, error
        `Playlist salva com sucesso!`, // Message of the alert
        'Tudo certo', // Header of the alert
        ALERT_OPTIONS
      )
      addTracksToPlaylist(response.data.id)
      state.isProcessing = false
    }catch(error){      
      console.log(error)
      state.isProcessing = false
      alert.value.showAlert(
        'error', // There are 4 types of alert: success, info, warning, error
        error.response, // Message of the alert
        'Ops', // Header of the alert
        ALERT_OPTIONS
      )
    }
  }

  const addTracksToPlaylist = async(playlist_id) => {
    try{  
      state.isProcessing = true
      const { accessToken } = getLocalStorage()    
      const tracks = state.tracks.filter(track => track.checked).map(track => track.uri)
      const formData = {
        'uris': tracks
      }
      state.randomic_playlist = await spotifyApi.addTracksToPlaylist(accessToken, playlist_id, formData)
      state.message = 'As músicas foram adicionadas com sucesso!'
      alert.value.showAlert(
        'success', // There are 4 types of alert: success, info, warning, error
        `As músicas foram adicionadas com sucesso!`, // Message of the alert
        'Tudo certo', // Header of the alert
        ALERT_OPTIONS
      )
      state.isProcessing = false
    }catch(error){        
      console.log(error)
      state.isProcessing = false
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
    const { accessToken } = getLocalStorage()
    if(state.randomic_playlist){
      try{
        const formData = {
          "context_uri": "spotify:playlist:" + state.randomic_playlist.id,
            "offset": {
              "position": 0
            },
            "position_ms": 0,
        }
        await spotifyApi.executePlaylist(accessToken, formData)        
        state.isProcessing = false
      }catch(error){
        console.log(error)
        state.isProcessing = false
        alert.value.showAlert(
          'error', // There are 4 types of alert: success, info, warning, error
          error.response, // Message of the alert
          'Ops', // Header of the alert
          ALERT_OPTIONS
        )
      }
      return
    }
    //nao salvou a playlist apenas adiciona a lista de reprodução
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
    const tracks = state.tracks.filter(track => track.checked).map(track => track.uri)
    let added = false
    await Promise.all(tracks.map(async(track) => {
      added = await addTrackToQueue(track)
    }))
    if(!added){
      if(state.randomic_playlist){
        openPlaylistApp(state.randomic_playlist.id)
        state.isProcessing = false
        return
      }
      state.message = 'Não foi possivel adicionar as músicas a lista de reprodução! Tente salvar a playlist e tentar novamente.'
      alert.value.showAlert(
        'error', // There are 4 types of alert: success, info, warning, error
        `Não foi possivel adicionar as músicas a lista de reprodução! Tente salvar a playlist e tentar novamente.`, // Message of the alert
        'Ops', // Header of the alert
        ALERT_OPTIONS
      )
      state.isProcessing = false
      return
    }
    state.message = 'As músicas foram adicionadas a lista de reprodução!'
    alert.value.showAlert(
      'success', // There are 4 types of alert: success, info, warning, error
      `As músicas foram adicionadas a lista de reprodução!`, // Message of the alert
      'Tudo certo', // Header of the alert
      ALERT_OPTIONS
    )
    state.isProcessing = false
  }

  const openPlaylistApp = (playlist_id) => {
    window.open(`https://open.spotify.com/playlist/${playlist_id}`)
  }

  const increaseStep = () => {
    if((state.step == 1)&&(state.playlists.filter(item => item.checked).length == 0)) {
      state.message = 'Selecione pelo menos uma playlist!'
      alert.value.showAlert(
        'warning', // There are 4 types of alert: success, info, warning, error
        `Selecione ao menos 1 playlist`, // Message of the alert
        'Atenção', // Header of the alert
        ALERT_OPTIONS
      )
      return
    }
    state.message = ''
    state.step++
    if(state.step == 3) {
      generatePlaylist()
    }
  }

  const decreaseStep = () => {
    if(state.step == 1){
      router.push('/')
      return
    }
    state.step--
  }

  onMounted(async () => {    
    if(hasTokenExpired()){        
      logout()
      return
    }      
    getProfile()
    getPlaylists()    
  })

</script>

<template>
  <div class="page">
    <vue-basic-alert :duration="300" :closeIn="3000" ref="alert" />    
    <div v-if="(state.step == 1)">
      <h3 class="center" style="margin-top: 20px;color:#fff">Selecione as playlists que você mais gosta:</h3>          
      <p class="message">{{state.message}}</p>
      <!-- exibir uma lista com as músicas como no spotify-->
      <div class="list-list">
          <ul class="list">
            <li v-for="playlist in state.playlists" class="list-item">
              <div class="container">
                <div class="round">
                  <label class="label-checkbox" :class="{ 'checked': playlist.checked }">
                    <input type="checkbox" v-model="playlist.checked" class="check-day" :id="playlist.name" :value="playlist.name" />                  
                  </label>
                </div>
              </div>
              <div class="list-item-content">
                <div class="list-item-title">{{playlist.name}}</div>
                <div class="list-item-subtitle">{{playlist.tracks.total}} músicas</div>
              </div>
            </li>
          </ul>
      </div>
    </div>
    <div v-if="(state.step == 2)">
      <h3 class="center" style="margin-top: 20px;color:#fff">Quantas músicas devemos utilizar de cada playlist?</h3>          
      <p class="message">{{state.message}}</p>
      <input type="number" v-model="state.number_tracks" class="input-number center" min="1" max="10" />
    </div>
    <div v-if="(state.step == 3)">
      <h3 @click="getPlaybackState()" v-if="state.tracks.length > 0" class="center" style="margin-top: 20px;color:#fff">Aqui está sua nova playlist gerada com {{state.tracks.filter(track => track.checked).length}} música(s):</h3>          
      <p class="message">{{state.message}}</p>
      <!-- exibir uma lista com as músicas como no spotify-->
      <div class="list-list">
          <ul class="list">
            <li v-for="track in state.tracks" class="list-item">
              <div class="container">
                <div class="round">
                  <label class="label-checkbox" :class="{ 'checked': track.checked }">
                    <input type="checkbox" v-model="track.checked" class="check-day" :id="track.id" :value="track.name" />                  
                  </label>
                </div>
              </div>
              <div class="list-item-content">                
                <div class="list-item-title">
                  <img :src="track.album.images[0].url" style="width: 40px; height: 40px;margin-right: 20px;" />
                  {{track.name}}
                </div>
                <div class="list-item-subtitle">{{track.artists[0].name}}</div>
              </div>
            </li>
          </ul>
      </div>
    </div>
    <div class="footer-fixed">
      <a class="btn-voltar" @click="decreaseStep()">Voltar</a>
      <button v-if="state.step < 3" class="btn-next" @click="increaseStep()" :disabled="state.isProcessing">
        <font-awesome-icon icon="arrow-right" v-if="!(state.isProcessing)"/>
        <!-- <font-awesome-icon :icon="['fas', 'spinner']" pulse v-show="state.isProcessing" /> -->
        <div v-if="!(state.isProcessing)">Avançar</div>
      </button>
      <button v-if="state.step == 3" class="btn-generate" @click="generatePlaylist()" :disabled="state.isProcessing">
        <font-awesome-icon icon="random" v-if="!(state.isProcessing)"/>
        <!-- <font-awesome-icon :icon="['fas', 'spinner']" pulse v-show="state.isProcessing" /> -->
      </button>
      <button v-if="state.step == 3" class="btn-save" @click="savePlaylist()" :disabled="state.isProcessing">
        <font-awesome-icon icon="save" v-if="!(state.isProcessing)"/>
        <!-- <font-awesome-icon :icon="['fas', 'spinner']" pulse v-show="state.isProcessing" /> -->
      </button>
      <button v-if="state.step == 3" class="btn-execute" @click="executePlaylist()" :disabled="state.isProcessing">
        <font-awesome-icon icon="play" v-if="!(state.isProcessing)"/>
        <!-- <font-awesome-icon :icon="['fas', 'spinner']" pulse v-show="state.isProcessing" /> -->
        <div v-if="!(state.isProcessing)">Executar</div>
      </button>
    </div>          
  </div>
</template>

<style scoped>
.page{
  height: 80%;
}
.center{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: auto;
}
.message{
    color: #fff;
    font-size: 12px;
    text-align: center;
}
.list{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: auto;
    padding: 0px;
}
.list-item{
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    margin: auto;
    width: 100%;
    height: 50px;
}
.container{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: right;
    flex: 10%;
}

.label-checkbox {
  border: 1px solid #fff;
  box-sizing: border-box;
  border-radius: 50%;
  padding: 10px 10px;
  text-align: center;
  display: block;
  font-family: Roboto;
  font-style: normal;
  font-weight: normal;
  font-size: 0px;
  line-height: 0px;
}

.check-day {
  visibility: hidden;
  position: absolute;
  right: 0;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
}

.checked {
  background: #fff;
  color: transparent;
}

.list-item-content{
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: auto;
    flex: 90%;
}
.list-item-title{
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    color: #fff;
}
.list-item-subtitle{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #999;
    font-size: 12px;
}
.input-number{
    width: 20%;
    height: 50px;
    border-radius: 50px;
    border: 1px solid #fff;
    text-align: center;
    font-family: Roboto;
    font-style: normal;
    font-weight: normal;
    font-size: 16px;
    line-height: 24px;
    color: black;
}
.btn-voltar{
  display: flex;
  color: #fff;
  margin-right: 25px;
}
.btn-next{
    margin-right: 25px;
    background-color: #0c8d39;
    color: #fff;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
}
.btn-save{
    margin-right: 25px;
    background-color: #0c8d39;
    color: #fff;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
}
.btn-generate{
    margin-right: 25px;
    background-color: transparent;
    color: #fff;
    border: 1px solid #fff;
    padding: 10px 20px;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
}
.btn-execute{
    margin-right: 25px;
    background-color: #ffffff;
    color: #1c1c1c;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
}
.footer-fixed{
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 10;
    background-color: #414040;
    padding: 10px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
}
</style>
