<script setup>
  import { getCurrentInstance, onMounted, computed, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
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
    router.push('/login')
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
        console.log(error)
        alert('Houve um erro ao buscar seu perfil!')
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
      .get('https://api.spotify.com/v1/me/top/tracks?limit=10', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        console.log(response.data)
        state.top_tracks = response.data.items
      })
  }

  const openPlaylistApp = (playlist_id) => {
    window.open(`https://open.spotify.com/playlist/${playlist_id}`)
  }

  const openLink = (url) => {
    window.open(url, '_blank')
  }

  onMounted(async () => {
    var params = window.location.search.substr(1)
    // var params = window.location.hash
    console.log(params)
    if(params){
      // params = params.split('#')[1]
      params = params.split('&')
      params = params.map(param => {
        param = param.split('=')
        console.log(param);        
        return {
          key: param[0],
          value: param[1]
        }
      })

      params = params.reduce((acc, param) => {
        acc[param.key] = param.value
        return acc
      }, {}) 
      if(params.code){
        localStorage.setItem(LOCALSTORAGE_KEYS.code, params.code)        
        const client_id = import.meta.env.VITE_SPOTIFY_CLIENT_ID
        const client_secret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET
        //the parameters encoded in application/x-www-form-urlencoded:
        const formData = new URLSearchParams()
        formData.append('grant_type', 'authorization_code')
        formData.append('code', params.code)
        formData.append('redirect_uri', window.location.origin)

        // const formData = {
        //   'code' : params.code,
        //   'redirect_uri': window.location.origin,
        //   'grant_type': 'authorization_code'
        // }

        await axios
          .post(`https://accounts.spotify.com/api/token`, formData, {
            headers: {
              Authorization: 'Basic ' + btoa(`${client_id}:${client_secret}`),
              "Content-type": "application/x-www-form-urlencoded"
            }
          })
          .then(response => {
            console.log(response.data)
            localStorage.setItem(LOCALSTORAGE_KEYS.accessToken, response.data.access_token)        
            localStorage.setItem(LOCALSTORAGE_KEYS.refreshToken, response.data.refresh_token)        
            localStorage.setItem(LOCALSTORAGE_KEYS.expireTime, response.data.expires_in)
            localStorage.setItem(LOCALSTORAGE_KEYS.timestamp, Date.now())            
            router.push('/')
          })
          .catch(error => {
            console.log(error)
            alert('Erro ao entrar com sua conta!')
            logout()
          })
      }      
    }

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
    <router-link to="/randomic" style="text-decoration:none">
      <button class="btn-generate">
        <font-awesome-icon icon="play" /> Começar
      </button>
    </router-link>
    <br><br><hr>
    <h3 class="center" style="margin-top: 50px;color:#fff">As top 10 de {{state.user?.display_name}}</h3>      
    <p class="center" style="margin-top: 0px;color:#fff;font-size:12px">Nos últimos 6 meses</p>
    <div class="list-list">
      <ul class="list">
        <li v-for="track in state.top_tracks" class="list-item">
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
