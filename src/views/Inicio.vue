<script setup>
  import { getCurrentInstance, onMounted, computed, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import VueBasicAlert from 'vue-basic-alert'
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

  const state = reactive({
    // title: 'Gerador de playlist aleatória do Spotify',
    randomic_playlist: null,
    playlists: [],
    devices: [],
    tracks: [],
    top_tracks: [],
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
        console.log(response.data)
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
        console.log(response.data)
        state.top_tracks = response.data.items
      })
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

  onMounted(async () => {
    
    
    
    if(hasTokenExpired()){              
      logout()
      return
    }      
    getProfile()
    // getPlaylists() 
    getUsersTopItems()
  })

</script>

<template>
  <div class="page">
    <h2 class="center" style="margin-top: 50px;color:#fff">{{ msg }}</h2>      
    <vue-basic-alert :duration="300" :closeIn="3000" ref="alert" />
    <router-link to="/randomic" style="text-decoration:none">
      <button class="btn-generate">
        <font-awesome-icon icon="play" /> Começar
      </button>
    </router-link>
    <br><br><hr>
    <h3 class="center" style="margin-top: 50px;color:#fff">As top 10 de {{state.user?.display_name}}</h3>      
    <p class="center" style="margin-top: 0px;color:#fff;font-size:12px">No último mês</p>
    <div class="list-list">
      <ul class="list">
        <li v-for="track in state.top_tracks" class="list-item">
          <img :src="track.album.images[0].url" style="width: 40px; height: 40px;margin-right: 20px;" />
          <div class="list-item-content">                
            <div class="list-item-title">
              {{track.name}}
            </div>
            <div class="list-item-popularity">
              <font-awesome-icon v-if="(track.popularity < 40)" class="icon-popularity-bad" icon="chart-line"/>
              <font-awesome-icon v-if="((track.popularity <= 40)&&(track.popularity < 70))" class="icon-popularity-medium" icon="chart-line"/>
              <font-awesome-icon v-if="(track.popularity >= 70)" class="icon-popularity-good" icon="chart-line"/>
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
.center{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: auto;
}
.btn-generate{
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

.list-list{
  margin-bottom: 200px;
  padding: 10px;
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
.list-item-content{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    margin: auto;
    flex: 90%;
}
.list-item-title{
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
    font-size: 10px;
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
.list-item-subtitle{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #999;
    font-size: 12px;
}

.footer{
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: auto;
  bottom: 65px;
  position: absolute;
  width: 100%;
}
</style>
