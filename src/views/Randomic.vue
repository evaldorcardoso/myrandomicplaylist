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
    randomic_playlist: null,
    playlists: [],
    tracks: [],
    number_tracks: 2,
    user: null,
    message: '',
    step: 1,
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
        state.playlists = response.data.items
        // state.playlists = response.data.items.filter(item => item.public)        
        // console.log(state.playlists)
      })
      .catch(error => {
        console.log(error)
      })
  }

  const getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
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
        while(state.tracks.length < tracks + state.number_tracks) {
          // let random = Math.floor(Math.random() * response.data.items.length)
          let random = getRandomInt(0, response.data.items.length)
          let track = response.data.items[random].track
          if(track){
            track.checked = true
            state.tracks.push(track)
          }
        }
        
        // state.tracks = state.tracks.concat(response.data.items.map(item => item.track))
        // state.tracks = response.data.items
        // state.playlists = response.data.items.filter(item => item.public)        
      })
  }

  const generatePlaylist = async() => {    
    state.message = 'Gerando playlist, aguarde...'
    state.randomic_playlist = null
    const playlists_selecteds = state.playlists.filter(item => item.checked)
    
    state.tracks = []
    const unresolved = playlists_selecteds.map(async(playlist) => {
      await getTracks(playlist.id)
    })
    const resolved = await Promise.all(unresolved)
    console.log(`Playlist gerada com sucesso com ${state.tracks.length} músicas!`)
    state.message = ''
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
        // console.log(response.data)
        state.randomic_playlist = response.data
        state.message = 'Playlist criada com sucesso!'
        // router.push('/')
        addTracksToPlaylist(response.data.id)
      })
      .catch(error => {
        console.log('Nao foi possivel salvar a playlist:')
        console.log(error)
      })
  }

  const addTracksToPlaylist = async(playlist_id) => {
    const { accessToken } = getLocalStorage()    
    const tracks = state.tracks.filter(track => track.checked).map(track => track.uri)
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
        // alert('As músicas foram adicionadas com sucesso!')
      })
      .catch(error => {
        console.log('Nao foi possivel adicionar as musicas a playlist:')
        console.log(error)
      })    
  }

  const addTrackToQueue = async(track) => {
    const { accessToken } = getLocalStorage()
    return await axios
      .post(`https://api.spotify.com/v1/me/player/queue?uri=${track}`, null, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        return true
      })
      .catch(error => {
        console.log(error)
        return false
      })
  }

  const executePlaylist = async() => {    
    const { accessToken } = getLocalStorage()
    if(state.randomic_playlist){
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
      return
    }
    //nao salvou a playlist apenas adiciona a lista de reprodução
    state.message = 'Adicionando músicas a lista de reprodução, aguarde...'
    const tracks = state.tracks.filter(track => track.checked).map(track => track.uri)
    let added = false
    await Promise.all(tracks.map(async(track) => {
      added = await addTrackToQueue(track)
    }))

    if(!added){
      if(state.randomic_playlist){
        openPlaylistApp(state.randomic_playlist.id)
        return
      }
      state.message = 'Não foi possivel adicionar as músicas a lista de reprodução! Tente salvar a playlist e tentar novamente.'
      alert('Não foi possivel adicionar as músicas a lista de reprodução! Tente salvar a playlist e tentar novamente.') 
      return
    }
    state.message = 'As músicas foram adicionadas a lista de reprodução!'
    alert('As músicas foram adicionadas a lista de reprodução!')
  }

  const openPlaylistApp = (playlist_id) => {
    window.open(`https://open.spotify.com/playlist/${playlist_id}`)
  }

  const increaseStep = () => {
    if((state.step == 1)&&(state.playlists.filter(item => item.checked).length == 0)) {
      state.message = 'Selecione pelo menos uma playlist!'
      alert('Selecione pelo menos uma playlist!')
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
      <h3 v-if="state.tracks.length > 0" class="center" style="margin-top: 20px;color:#fff">Aqui está sua nova playlist gerada com {{state.tracks.filter(track => track.checked).length}} música(s):</h3>          
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
      <button v-if="state.step < 3" class="btn-next" @click="increaseStep()">
        <font-awesome-icon icon="arrow-right" />Avançar
      </button>
      <button v-if="state.step == 3" class="btn-generate" @click="generatePlaylist()">
        <font-awesome-icon icon="random" />
      </button>
      <button v-if="state.step == 3" class="btn-save" @click="savePlaylist()">
        <font-awesome-icon icon="save" />
      </button>
      <button v-if="state.step == 3" class="btn-execute" @click="executePlaylist()">
        <font-awesome-icon icon="play" />Executar
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
