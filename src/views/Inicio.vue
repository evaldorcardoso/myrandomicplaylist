<script setup>
  import { getCurrentInstance, onMounted, computed, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'

  const msg = ref('Gerador de playlist aleatória do Spotify')

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
    playlists: [],
    devices: [],
    tracks: [],
    user: null,
    message: '',
    track: {
      name: 'Musica X',
      artist: 'Artista Y',
      time: "1:01",
      timeTotal: "2:44"
    }
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
        // console.log(response.data.items)
        state.playlists = response.data.items.filter(item => item.public)        
        console.log(state.playlists)
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

  const generatePlaylist = async() => {
    state.tracks = []
    console.log('Gerando playlist...')
    const unresolved = state.playlists.map(async(playlist) => {
      await getTracks(playlist.id)
    })
    const resolved = await Promise.all(unresolved)
    console.log(`Playlist gerada com sucesso com ${state.tracks.length} músicas!`)
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
        // console.log(response.data)
        state.user = response.data
      })
      .catch(error => {
        console.log(error)
      })
  }

  const savePlaylist = async() => {
    const { accessToken } = getLocalStorage()
    const user_id = state.user.id
    const name = prompt('Informe o Nome da playlist: ', 'Playlist Aleatória')
    const description = 'Playlist gerada automaticamente pelo gerador de playlist aleatória do Spotify @evaldorcardoso'
    const _public = true
    // const tracks = state.tracks.map(track => track.uri)
    
    //let query = `name=${name}&description=${description}&public=${_public}`
    const formData = {
      'name' : name,
      'description': description,
      'public': _public
    }
    await axios
      .post(`https://api.spotify.com/v1/users/${user_id}/playlists`, JSON.stringify(formData), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-type": "application/json"
        }
      })
      .then(response => {
        console.log(response.data)
        state.randomic_playlist = response.data
        state.message = 'Playlist criada com sucesso!'
        router.push('/')
        addTracksToPlaylist(response.data.id)
      })
      .catch(error => {
        console.log('Nao foi possivel salvar a playlist:')
        console.log(error)
      })
  }

  const addTracksToPlaylist = async(playlist_id) => {
    const { accessToken } = getLocalStorage()
    const tracks = state.tracks.map(track => track.uri)
    const formData = {
      'uris': tracks
    }
    axios
      .post(`https://api.spotify.com/v1/playlists/${playlist_id}/tracks`, JSON.stringify(formData), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-type": "application/json"
        }
      })
      .then(response => {
        console.log(response.data)
        state.playlist = response.data
        state.message = 'As músicas foram adicionadas com sucesso!'
        router.push('/')
      })
      .catch(error => {
        console.log('Nao foi possivel adicionar as musicas a playlist:')
        console.log(error)
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

  const openPlaylistApp = (playlist_id) => {
    window.open(`https://open.spotify.com/playlist/${playlist_id}`)
  }

  onMounted(async () => {
    // var params = window.location.search.substr(1)
    var params = window.location.hash
    console.log(params)
    if(params){
      params = params.split('#')[1]
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
      if(params.access_token){
        localStorage.setItem(LOCALSTORAGE_KEYS.accessToken, params.access_token)        
        localStorage.setItem(LOCALSTORAGE_KEYS.expireTime, params.expires_in)
        localStorage.setItem(LOCALSTORAGE_KEYS.timestamp, Date.now())        
        router.push('/')
        // setTimeout(() => {
        //   window.location.reload()
        // }, 1000)
      }
    }

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
    <h2 class="center" style="margin-top: 50px;color:#fff">{{ msg }}</h2>      
    <router-link to="/randomic" style="text-decoration:none">
      <button class="btn-generate">
        <font-awesome-icon icon="play" /> Começar
      </button>
    </router-link>
    <div v-if="state.tracks.length > 0">
      <h4>Aqui está sua nova playlist gerada com {{state.tracks.length}} músicas:</h4>
      <!--criar um botão para executar salvar a playlist-->
      <button class="btn-save" @click="savePlaylist()">Salvar playlist</button>
      <p v-if="state.message">{{state.message}}</p>
      <button v-if="state.playlist" @click="executePlaylist()" >Executar playlist</button>
      <a @click="openPlaylistApp(state.randomic_playlist.id)">
        <button v-if="state.playlist">Abrir no Spotify</button>
      </a>
      <div v-for="track in state.tracks" style="display: flex">
        <img :src="track.album.images[0].url" style="width: 50px; height: 50px; border-radius: 50%;" />
        <h5>{{ track.name }}</h5>
        <h6>{{ track.artists[0].name }}</h6>
      </div>
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
</style>
