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
        console.log(response.data)
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

  const executePlaylist = async(playlist_id) => {
    const { accessToken } = getLocalStorage()
    const formData = {
       "context_uri": "spotify:playlist:" + playlist.id,
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
  <div class="page" style="height: 88%;">
    <h2 class="center" style="padding-top: 15px;color:#fff">{{ msg + state.user?.display_name }}</h2>
    <p class="span">Clique na playlist para executar</p>
    <div class="playlists">
      <ul>
        <li v-for="playlist in state.playlists" :key="playlist.id" @click="executePlaylist(playlist.id)">
            <img :src="playlist.images[0]?.url"/>
            <h4>{{ playlist.name }}</h4>
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
    white-space: nowrap;
    overflow: hidden;
    font-size: 14px;
}
.playlists p{
    color: rgb(177, 177, 177);
    margin: 0 5px 5px 5px;    
    font-size: 12px;
    line-height: 1.5em;
    height: 3em;
    overflow: hidden;
}
</style>
