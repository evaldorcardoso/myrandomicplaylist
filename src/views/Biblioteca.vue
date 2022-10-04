<script setup>
  import { getCurrentInstance, onMounted, computed, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'

  const msg = ref('Playlists de ')

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
    randomic_playlist: null,
    playlists_original:[],
    playlists: [],
    filters: ['private_playlists'],
    devices: [],
    tracks: [],
    user: null,
    message: '',
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
    setTimeout(() => {
      window.location.reload()
    }, 1000)
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
        const { access_token, expires_in, timestamp } = response.data
        window.localStorage.setItem(LOCALSTORAGE_KEYS.accessToken, access_token)
        window.localStorage.setItem(LOCALSTORAGE_KEYS.expireTime, expires_in)
        localStorage.setItem(LOCALSTORAGE_KEYS.timestamp, Date.now())            
        router.push('/')
      })
      .catch(error => {
        console.log(error)
        console.log('Houve um erro ao buscar o token!')
        logout()
      })
  }

  const getPlaylists = async() => {
    const { accessToken } = getLocalStorage()
    // console.log('buscando playlists...')
    await axios
      .get('https://api.spotify.com/v1/me/playlists?limit=50', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        // state.playlists = response.data.items.filter(item => item.public)        
        state.playlists_original = response.data.items
        filterPLaylists()
        // console.log(state.playlists)
      })
      .catch(error => {
        console.log(error)
      })
  }

  const getTracks = async(playlist_id) => {
    const { accessToken } = getLocalStorage()
    
    await axios
      .get(`https://api.spotify.com/v1/playlists/${playlist_id}/tracks`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        let tracks = state.tracks.length
        // console.log(tracks + 'musicas')
        // console.log(response.data.items)
        //adicionar 2 musicas aleatórias dessa playlist com as demais
        while(state.tracks.length < tracks + 2) {
          let random = Math.floor(Math.random() * response.data.items.length)
          let track = response.data.items[random].track
          state.tracks.push(track)
        }
        
        // state.tracks = state.tracks.concat(response.data.items.map(item => item.track))
        // state.tracks = response.data.items
        // state.playlists = response.data.items.filter(item => item.public)        
      })
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
      })
  }

  const executePlaylist = async(playlist_id) => {
    const { accessToken } = getLocalStorage()
    const formData = {
       "context_uri": "spotify:playlist:" + playlist_id,
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
      .then(response => {
        
      })
      .catch(error => {
        console.log(error)
        state.message = error.response.data.error.message
        openPlaylistApp(playlist_id)
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
        // console.log(response.data)
        //state.devices = response.data.devices
      })
  }

  const openPlaylistApp = (playlist_id) => {
    window.open(`https://open.spotify.com/playlist/${playlist_id}`)
  }

  const changeFilterPrivatePlaylists = async (value) => {
    if (state.filters.includes('private_playlists'))
      state.filters = state.filters.filter(item => item != 'private_playlists')
    else
      state.filters.push('private_playlists')
      
    await filterPLaylists()
  }

  const filterPLaylists = async () => {
    if(state.filters.length == 0) {
      state.playlists = state.playlists_original
      return
    }

    state.filters.map(item => {
      switch (item) {
        case 'private_playlists':
          filterPrivatePlaylists()
          break;
      
        default:
          break;
      }
    })
  }

  const filterPrivatePlaylists = async () => {
    state.playlists = state.playlists_original.filter(
      playlist => playlist.owner.display_name == state.user.display_name          
    )
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
  <div class="page" style="height: 88%;">
    <h2 class="center" style="padding-top: 15px;color:#fff">{{ msg + state.user?.display_name }}</h2>
    <div style="margin-top: 10px;">
        <label class="switch">
          <input type="checkbox" @click="changeFilterPrivatePlaylists">
          <span class="slider round"></span>
        </label>
        <span style="margin: 8px 0px 0px 10px;color: #999;position: absolute;">Filtrar somente minhas playlists</span>
      </div>
    <p class="span">Clique na playlist para executar</p>
    <div class="playlists">
      <ul>
        <li v-for="playlist in state.playlists" :key="playlist.id" @click="executePlaylist(playlist.id)">
            <img :src="playlist.images[0]?.url"/>
            <h4>{{ playlist.name }}</h4>
            <h5>By: {{ playlist.owner.display_name }}</h5>
            <p>{{ playlist.description ? playlist.description : 'By ' + playlist.owner.display_name }}</p>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.span{
  color: rgb(124, 123, 123);
  font-size: 12px;
  text-align: center;
  padding: 5px;
  margin: 0;
}
.center{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: auto;
}
.playlists{
    
}
.playlists ul{
    list-style-type: none;
    padding: 0;   
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, max-content));
    gap: 20px;    
}
.playlists li{
    background-color: #333;
    display: flex;
    flex-direction: column;
    border-radius: 5px;
}
.playlists img{
    max-width: 230px;
    border-top-left-radius: 5px;    
    border-top-right-radius: 5px;    
}
.playlists h4{
    color: #fff;
    margin: 5px;
    white-space: wrap;
    overflow: hidden;
    font-size: 14px;
}
.playlists h5 {
  margin: 1px 1px 1px 5px;
  color: rgb(124, 123, 123);
  font-size: 10px;
}
.playlists p{
    color: rgb(177, 177, 177);
    margin: 0 5px 5px 5px;    
    font-size: 12px;
    line-height: 1.5em;
    height: 3em;
    overflow: hidden;
}
/**SLIDER BEGIN */
/* The switch - the box around the slider */
.switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 30px;
}

/* Hide default HTML checkbox */
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

/* The slider */
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #0c8d39;
  -webkit-transition: .5s;
  transition: .5s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 30px;
  bottom: 2px;
  background-color: white;
  -webkit-transition: .5s;
  transition: .5s;
}

input:checked + .slider {
  background-color: #ccc;
}

input:focus + .slider {
  box-shadow: 0 0 1px #0c8d39;
}

input:checked + .slider:before {
  -webkit-transform: translateX(-26px);
  -ms-transform: translateX(-26px);
  transform: translateX(-26px);
}

/* Rounded sliders */
.slider.round {
  border-radius: 34px;
}

.slider.round:before {
  border-radius: 50%;
}
/**SLIDER END */
</style>
