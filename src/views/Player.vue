<script setup>
  import { getCurrentInstance, onMounted, computed, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'

  // Map for localStorage keys
  const LOCALSTORAGE_KEYS = {
    accessToken: 'spotify_access_token',
    refreshToken: 'spotify_refresh_token',
    expireTime: 'spotify_token_expire_time',
    timestamp: 'spotify_token_timestamp',
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
    // title: 'Gerador de playlist aleatória do Spotify',    
    devices: [],
    is_playing: false,
    user: null,
    message: '',
    track: {
      name: '',
      artists: [{
        name: '',
      }],
      time: "",
      time_total: "",
      progress: 0,
      album: {
        images : [{
          url: ''
        }],
      },
    },
  })

  const internalInstance = getCurrentInstance()
  const axios = internalInstance.appContext.config.globalProperties.axios
  const router = useRouter()
  
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

  const getProfile = async() => {
    const { accessToken } = getLocalStorage()
    await axios
      .get('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        console.log(response.data)
        state.user = response.data
      })
  }
  
  const executePlaylist = async() => {
    const { accessToken } = getLocalStorage()
    const formData = {
       "context_uri": "spotify:playlist:" + state.randomic_playlist.id,
        "offset": {
          "position": 0
        },
        "position_ms": 0,
    }
    axios
      .put(`https://api.spotify.com/v1/me/player/play`, JSON.stringify(formData), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-type": "application/json"
        }
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
        state.devices = response.data.devices        
      })
  }

  const getPlaybackState = async() => {
    const { accessToken } = getLocalStorage()
    await axios
      .get('https://api.spotify.com/v1/me/player', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {                
        if(response.data){          
          state.is_playing = response.data.is_playing
          let date = new Date(response.data.progress_ms);          
          state.track = response.data.item
          state.track.time = date.getUTCMinutes() + ':' + date.getUTCSeconds()
          date = new Date(state.track.duration_ms);
          state.track.time_total = date.getUTCMinutes() + ':' + date.getUTCSeconds()
          state.track.progress = (response.data.progress_ms / state.track.duration_ms) * 100
        }
      })
  }

  const startResumePlayback = async() => {
    const { accessToken } = getLocalStorage()
    await axios
      .put(`https://api.spotify.com/v1/me/player/play`, {}, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        state.is_playing = true
        getPlaybackState()
      })
      .catch(error => {
        console.log(error)
        state.message = error.response.data.error.message
      })
  }

  const pausePlayback = async() => {
    const { accessToken } = getLocalStorage()
    await axios
      .put(`https://api.spotify.com/v1/me/player/pause`, {}, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        state.is_playing = false
        getPlaybackState()
      })
      .catch(error => {
        console.log(error)
        state.message = error.response.data.error.message
      })
  }

  const skipToPrevious = async() => {
    const { accessToken } = getLocalStorage()
    await axios
      .post(`https://api.spotify.com/v1/me/player/previous`, {}, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        getPlaybackState()
      })
      .catch(error => {
        console.log(error)
        state.message = error.response.data.error.message
      })
  }

  const skipToNext = async() => {
    const { accessToken } = getLocalStorage()
    await axios
      .post(`https://api.spotify.com/v1/me/player/next`, {}, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        getPlaybackState()
      })
      .catch(error => {
        console.log(error)
        state.message = error.response.data.error.message
      })
  }

  const transferPlayback = async(device_id) => {
    const { accessToken } = getLocalStorage()
    const formData = {
      "device_ids": [device_id]
    }
    await axios
      .put(`https://api.spotify.com/v1/me/player`, JSON.stringify(formData), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-type": "application/json"
        }
      })
      .then(response => {
        console.log(response.data)
        const device = state.devices.find(device => device.id === device_id)
        if((device.is_active)&&(!state.is_playing)){
          startResumePlayback()
        }
        getDevices()
      })
      .catch(error => {
        console.log(error)
        state.message = error.response.data.error.message
      })
  }

  const openPlaylistApp = (playlist_id) => {
    window.open(`https://open.spotify.com/playlist/${playlist_id}`)
  }

  onMounted(async () => {
    if(hasTokenExpired()){        
      logout()
      return
    }      
    getProfile()    
    getDevices()
    getPlaybackState()

    var atualizador = setInterval(() => {
      getDevices()
      getPlaybackState()
    }, 10000)
    
  })

</script>

<template> 
<div class="page"> 
  <p class="message">{{state.message}}</p>     
  <div class="player" v-if="state.is_playing">
    <div class="artwork">
      <img v-bind:src="state.track?.album.images[0].url" style="width: 100%; height: 100%;" />
    </div>
    <div class="track-name">
      <h3>{{ state.track?.name }}</h3>
    </div>
    <div class="track-artists">
      <!-- exibir os artistas separados por vírgula-->
      <h4>{{ state.track?.artists.map(artist => artist.name).join(', ') }}</h4>
    </div>
    <div class="bar-progress">
      <div class="bar-progress-fill" :style="{ width: state.track.progress + '%' }"></div>
    </div>
    <div class="track-time">
      <span>{{ state.track?.time }}</span>
      <span>{{ state.track?.time_total }}</span>
    </div>
    <div class="player-controls">
      <button class="btn-previous" @click="skipToPrevious()"><font-awesome-icon icon="step-backward"/></button>
      <button v-if="!state.is_playing" class="btn-play" @click="startResumePlayback()"><font-awesome-icon icon="play"/></button>
      <button v-if="state.is_playing" class="btn-play" @click="pausePlayback()"><font-awesome-icon icon="pause"/></button>
      <button class="btn-next" @click="skipToNext()"><font-awesome-icon icon="step-forward"/></button>
    </div>
  </div>         
  <div class="devices" v-if="state.devices.length > 0">
    <h3>Dispositivos disponíveis:</h3>
    <div class="device" v-for="device in state.devices" @click="transferPlayback(device.id)">
      <div class="device-name">
        <h4 v-if="device.is_active" :style="{ color: '#fff'}">{{ device.name }}</h4>
        <h4 v-else>{{ device.name }}</h4>
      </div>      
    </div>
  </div>
  <div v-if="(state.devices.length == 0)">
    <p class="span-no-devices">Desculpe, mas não conseguimos localizar nenhum dispositivo conectado à sua conta!</p>
  </div>
</div>
</template>

<style scoped>
.message{
    color: #fff;
    font-size: 12px;
    text-align: center;
}
.no-devices{
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: auto;
}
.span-no-devices{
  text-align: center;
  font-size: 18px;
  margin-top: 40px;
  color: #fff;
}
.player{
  margin: 40px auto 40px auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 300px;
  height: 400px;
  padding: 20px;
  border-radius: 4px;
  box-shadow: 0px 0px 10px #000;
}
.artwork{
  width: 250px;
  height: 250px;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  margin: auto;
}
.track-name{
  text-align: center;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 30px;  
  margin-top: 10px;
  color: #fff;
}
.track-name h3{
  margin: 0;
  white-space: nowrap;
  max-width: 300px;
  overflow: hidden;
}
.track-artists{
  text-align: center;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 30px;
  white-space: nowrap;
  max-width: 300px;
  overflow: hidden;
}
.track-artists h4{
  margin: 0;
  color: #999;
}
.bar-progress{
  width: 100%;
  height: 4px;
  background-color: #ccc;
  border-radius: 4px;
}
.bar-progress-fill{  
  height: 4px;
  background-color: #42b983;
  border-radius: 4px;
}
.track-time{
  margin-top: 5px;
  width: 100%;
  height: 20px;
  text-align: left;
}

.track-time span{
  font-size: 12px;
  float:left;
  color: #999;
}
.track-time span:nth-child(2){
  font-size: 12px;
  float:right;
  color: #999;
}
.player-controls{
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-gap: 10px;
}
.btn-previous{
  font-size: 20px;
  border-radius: 50%;
  background-color: #1c1c1c;
  border: none;
  outline: none;
  margin-right: 10px;
  margin-top: 10px;
  cursor: pointer;
  color: #999;
  text-align: center;
}
.btn-next{
  font-size: 20px;
  border-radius: 50%;
  background-color: #1c1c1c;
  border: none;
  outline: none;
  margin-top: 10px;
  cursor: pointer;
  color: #999;
  text-align: center;
}
.btn-play{
  font-size: 20px;
  height: 40px;
  width: 40px;
  border-radius: 50%;
  background-color: #fff;
  border: none;
  outline: none;
  margin: 10px auto auto auto;
  cursor: pointer;
  color: #1c1c1c;
  text-align: center;
}
.devices{
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: auto;
  border-radius: 4px;
  box-shadow: 0px 0px 10px #000;
  width: 340px;
}
.devices h3{
  text-align: center;
  color: #fff;
}
.device{
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 300px;
  height: 50px;
}
.device-name{
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 30px;
  color: #999;
  align-items: center;
  justify-content: center;
}
.device-name h4{
  margin: 0;
  white-space: nowrap;
  max-width: 300px;
  overflow: hidden;
}

</style>
