<script setup>
  import { getCurrentInstance, onMounted, computed, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'

  const msg = ref('Gerador de playlist aleatória do Spotify')

  const state = reactive({
    // title: 'Gerador de playlist aleatória do Spotify',
    randomic_playlist: null,
    playlists: [],
    tracks: [],
    user: null,
    message: '',
  })

  const internalInstance = getCurrentInstance()
  const axios = internalInstance.appContext.config.globalProperties.axios
  const router = useRouter()
  
  const authorize = () => {
    const url = 'https://accounts.spotify.com/authorize?'
    const client_id = 'a8f86c24a4f4475cbbd4c9dce531717c'
    const response_type = 'token'
    const redirect_uri = window.location.origin
    const scope = 'user-read-private user-read-email playlist-read-private playlist-modify-public playlist-modify-private'
    const state = '34fFs29kd09'
    const show_dialog = 'true'
    const query = `client_id=${client_id}&response_type=${response_type}&redirect_uri=${redirect_uri}&scope=${scope}&state=${state}&show_dialog=${show_dialog}`
    window.location.href = url + query    
  }

  const logout = () => {
    localStorage.removeItem('@myrandomicplaylist:access_token')
    localStorage.removeItem('@myrandomicplaylist:data')
    localStorage.removeItem('@myrandomicplaylist:expires_in')
    state.user = null
    router.push('/')
  }

  const getPlaylists = async() => {
    const access_token = localStorage.getItem('@myrandomicplaylist:access_token')
    // console.log('buscando playlists...')
    await axios
      .get('https://api.spotify.com/v1/me/playlists?limit=50', {
        headers: {
          Authorization: `Bearer ${access_token}`
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
    const access_token = localStorage.getItem('@myrandomicplaylist:access_token')
    
    await axios
      .get(`https://api.spotify.com/v1/playlists/${playlist_id}/tracks`, {
        headers: {
          Authorization: `Bearer ${access_token}`
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
    const access_token = localStorage.getItem('@myrandomicplaylist:access_token')
    
    await axios
      .get('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      })
      .then(response => {
        // console.log(response.data)
        state.user = response.data
      })
  }

  const savePlaylist = async() => {
    const access_token = localStorage.getItem('@myrandomicplaylist:access_token')
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
          Authorization: `Bearer ${access_token}`,
          "Content-type": "application/json"
        }
      })
      .then(response => {
        console.log(response.data)
        state.playlist = response.data
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
    const access_token = localStorage.getItem('@myrandomicplaylist:access_token')
    const tracks = state.tracks.map(track => track.uri)
    const formData = {
      'uris': tracks
    }
    axios
      .post(`https://api.spotify.com/v1/playlists/${playlist_id}/tracks`, JSON.stringify(formData), {
        headers: {
          Authorization: `Bearer ${access_token}`,
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

  onMounted(async () => {
    // var params = window.location.search.substr(1)
    var params = window.location.hash
    // console.log(params)
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
        localStorage.setItem('@myrandomicplaylist:access_token', params.access_token)        
        localStorage.setItem('@myrandomicplaylist:expires_in', params.expires_in)
        localStorage.setItem('@myrandomicplaylist:date', new Date().getTime())        
        router.push('/');
      }
    }

    if(localStorage.getItem('@myrandomicplaylist:access_token')&&
       localStorage.getItem('@myrandomicplaylist:date')&&
       localStorage.getItem('@myrandomicplaylist:expires_in')){
      if ((localStorage.getItem('@myrandomicplaylist:date')+
          localStorage.getItem('@myrandomicplaylist:expires_in')) < new Date()/1000) {
        console.log("LOGIN EXPIRED");
        logout()
        return
      }      
      getProfile()
      getPlaylists()
    }    
  });

</script>

<template>
  <h1>{{ msg }}</h1>

  <p>
    <div v-if="state.user">
      <img :src="state.user.images[0].url" style="width: 100px; height: 100px; border-radius: 50%;" />
      <h4>Olá {{ state.user.display_name }}</h4>
      <h5>Email: {{ state.user.email }}</h5>
      <button class="btn-logout" @click="logout()">Sair</button>
      <button class="btn-generate" @click="generatePlaylist()">Gerar playlist</button>
      <br><hr>
      <div v-if="state.tracks.length > 0">
        <h4>Aqui está sua nova playlist gerada com {{state.tracks.length}} músicas:</h4>
        <!--criar um botão para executar salvar a playlist-->
        <button class="btn-save" @click="savePlaylist()">Salvar playlist</button>
        <p v-if="state.message">{{state.message}}</p>
        <div v-for="track in state.tracks" style="display: flex">
          <img :src="track.album.images[0].url" style="width: 50px; height: 50px; border-radius: 50%;" />
          <h5>{{ track.name }}</h5>
          <h6>{{ track.artists[0].name }}</h6>
        </div>
      </div>
      <br><hr>
      <ul style="list-style: none">
        <li v-for="playlist in state.playlists" :key="playlist.id" style="float:left">
          <img :src="playlist.images[0]?.url" style="width:50px"/>
          {{ playlist.name }}
        </li>
      </ul>
    </div>

    <div v-if="!state.user">      
      <img alt="Vue logo" src="../assets/logo.png" />
      <a href="#" @click.prevent="authorize()">
        <button>Entrar com Spotify</button>
      </a>
      <p>
        <a href="https://vitejs.dev/guide/features.html" target="_blank">
          Vite Documentation
        </a>
        |
        <a href="https://v3.vuejs.org/" target="_blank">Vue 3 Documentation</a>
      </p>
    </div>

  </p>
  <br/>
</template>

<style scoped>
a {
  color: #42b983;
}

button{
  background-color: #42b983;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}
.btn-logout{
  background-color: #fff;
  color: #42b983;
  border: 1px solid #42b983;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}
.btn-generate{
  margin-left: 10px;
  background-color: #42b983;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}
</style>
