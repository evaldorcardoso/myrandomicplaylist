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
    user: null,
    message: '',
    track: {
      name: 'Musica X',
      artists: [{
        name: 'Artista X',
      }],
      time: "1:01",
      timeTotal: "2:44",
      album: {
        images : [{
          url: 'src/assets/Spotify_Icon_RGB_Green.png'
        }],
      },
    },
  })

  const internalInstance = getCurrentInstance()
  const axios = internalInstance.appContext.config.globalProperties.axios
  const router = useRouter()
  
  const hasTokenExpired = () => {
    const { accessToken, timestamp, expireTime } = getLocalStorage()
    if(!accessToken || !timestamp || !expireTime){ 
      return true      
    }    
    const millisecondsElapsed = Date.now() - Number(timestamp)
    return (millisecondsElapsed / 1000) > Number(expireTime)
  }

  const logout = () => {
    // Clear all localStorage items
    for (const property in LOCALSTORAGE_KEYS) {
      window.localStorage.removeItem(LOCALSTORAGE_KEYS[property]);
    }
    state.user = null
    router.push('/')
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
        //state.devices = response.data.devices
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
        if(response.data.is_playing){
          state.track = response.data.item
        }
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
    getPlaybackState()
    setTimeout(() => {
      getPlaybackState()
    }, 30000)
    
  })

</script>

<template>
  <p>    
    <div>      
      <div class="player" v-if="state.devices.length > 0">
        <div class="artwork">
          <img v-bind:src="state.track?.album.images[0].url" style="width: 100%; height: 100%;" />
        </div>
        <div class="track-name">
          <h2>{{ state.track?.name }}</h2>
        </div>
        <div class="track-artists">
          <!-- exibir os artistas separados por vírgula-->
          <h4>{{ state.track?.artists.map(artist => artist.name).join(', ') }}</h4>
        </div>
        <div class="bar-progress">
          <div class="bar-progress-fill" :style="{ width: state.progress + '%' }"></div>
        </div>
        <div class="track-time">
          <span>{{ state.track?.time }}</span>
          <span>{{ state.track?.timeTotal }}</span>
        </div>
        <!--<div class="player-controls">
          <button class="btn-previous" @click="">Previous</button>
          <button class="btn-play" @click="executePlaylist()">Play</button>
          <button class="btn-next" @click="">Next</button>
        </div>-->          
      </div>         
      <div v-else class="no-devices">
        <p class="span-no-devices">Desculpe, mas não conseguimos localizar nenhum dispositivo conectado à sua conta!</p>
      </div>
    </div>
  </p>
  <br/>
</template>

<style scoped>
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
  background-color: #fff;
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
}
.track-name h2{
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
  width: 10%;
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
}
.track-time span:nth-child(2){
  font-size: 12px;
  float:right;
}
</style>
