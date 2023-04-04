<script setup>
  import { onMounted, computed, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import VueBasicAlert from 'vue-basic-alert'
  import { useProfile, useGeneral } from '@/support/spotifyApi'

  const { 
    getProfile, 
    getPlaylists,  
    executePlaylist, 
    getPlaybackState,
    getDevices,
    transferPlayback,
    skipToNext,
    startResumePlayback,
    addTrackToQueue,
    getTopItens
  } = useProfile()
  const { getTracks, addTracksToPlaylist, savePlaylist } = useGeneral()

  const ALERT_OPTIONS = { 
    iconSize: 35,
    iconType: 'solid', // Icon styles: now only 2 styles 'solid' and 'regular'
    position: 'top right' // Position of the alert 'top right', 'top left', 'bottom left', 'bottom right'
  }

  const state = reactive({
    isProcessing: false,
    processingStart: 0,
    processingEnd: 0,
    isPlaying: false,
    randomPlaylist: null,
    playlistsOriginal:[],
    playlists: [],
    tracks: [],
    devices: [],
    numberTracks: 50,
    user: null,
    message: '',
    filters: ['all'],
    pickMode: 'random',
    orderMode: 'top'
  })

  const router = useRouter()
  const alert = ref(null)
  
  const getUserPlaylists = async() => {
    state.isProcessing = true
    const { data } = await getPlaylists()
    state.playlistsOriginal = data.items
    state.playlistsOriginal.forEach(item => item.checked = false)
    filterPLaylists()
    state.isProcessing = false
  }

  const getRandomInt = (min, max) => {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min)) + min
  }

  const pickTracks = async(allTracks) => {
    let tracksToPick = state.numberTracks
    let tracks = []
    if(tracksToPick > allTracks.length){
      tracksToPick = allTracks.length
    }
    
    while(tracks.length < tracksToPick) {
      let random = getRandomInt(0, allTracks.length)
      let track = allTracks[random]
      if(track){
        if(! tracks.find(item => item.id === track.id)){
          tracks.push(track)
        }
      }
    }  

    state.tracks = tracks     
  }

  const getPlaylistTracks = async(playlistId) => {
    const { data } = await getTracks(playlistId)
    
    data.items.map(item => {
      item.track.checked = true 
      state.tracks.push(item.track)
    })
  }

  const hasPlaylistSelected = () => {
    if (state.playlists.filter(item => item.checked).length == 0) {
      let message = 'Select at least 1 playlist!'
      state.message = message
      alert.value.showAlert(
        'warning', // There are 4 types of alert: success, info, warning, error
        message, // Message of the alert
        'Atenção', // Header of the alert
        ALERT_OPTIONS
      )
      return false
    }

    return true
  }

  const generatePlaylist = async() => {
    if (! hasPlaylistSelected()) {
      emit('update-step-data', 1)
      return
    }
    state.tracks = []
    setMode('random')  
    state.isProcessing = true
    state.processingStart = 1
    state.processingEnd = state.tracks.length
    state.message = 'Picking songs, wait...'
    state.randomPlaylist = null
    const playlists_selected = state.playlists.filter(item => item.checked)    
    state.tracks = []
    const unresolved = playlists_selected.map(async(playlist) => {
      await getPlaylistTracks(playlist.id)
    })
    const resolved = await Promise.all(unresolved)
    await pickTracks(state.tracks)
    alert.value.showAlert(
      'success', // There are 4 types of alert: success, info, warning, error
      `Successful ${state.tracks.length} songs picked!`, // Message of the alert
      'Alright', // Header of the alert
      ALERT_OPTIONS
    )
    state.message = ''
    state.isProcessing = false
    emit('update-step-data', 99)
  }

  const getUserPlaylistTracks = async() => {
    if (! hasPlaylistSelected()) {
      emit('update-step-data', 1)
      return
    }
    state.isProcessing = true
    state.message = 'Searching for songs, wait...'  
    const playlists_selected = state.playlists.filter(item => item.checked)    
    state.tracks = []
    const unresolved = playlists_selected.map(async(playlist) => {
      await getPlaylistTracks(playlist.id)
    })
    await Promise.all(unresolved)
    filterPopTracks()
    state.isProcessing = false
    state.message = ''
    emit('update-step-data', 99)
  }

  const getUserTopItems = async() => {
    const { data } = await getTopItens(state.numberTracks)
    data.items.map(item => {
      item.checked = true 
      state.tracks.push(item)
    })

    if (state.orderMode == 'bottom') {
      state.tracks = state.tracks.reverse()
    }
  }

  const filterPopTracks = () => {
    if (state.orderMode == 'top') {
      state.tracks.sort((a, b) => b.popularity - a.popularity)
      state.tracks = state.tracks.slice(0, state.numberTracks)
      return
    }

    state.tracks.sort((a, b) => a.popularity - b.popularity)
    state.tracks = state.tracks.slice(0, state.numberTracks)
    state.tracks = state.tracks.reverse()
  }

  const getPlaybackUserState = async() => {
    try{
      const { data } = await getPlaybackState()
      state.isPlaying = data.is_playing
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

  const transferUserPlayback = async(device_id) => {
    try{
      const formData = {
        "device_ids": [device_id],
        "play": true
      }
      await transferPlayback(formData)

      const { data } = await getDevices()
      state.devices = data.devices
      const device = state.devices.find(device => device.id === device_id)
      if((device.is_active)&&(!state.isPlaying)){
        await skipToNext()
        await startResumePlayback()
        state.isPlaying = true
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

  const saveUserPlaylist = async() => {
    state.isProcessing = true
    const name = prompt('Playlist name: ', 'Random Playlist')
    const description = 'Playlist created by MyRandomicPlaylist App from @evaldorcardoso'
    const _public = false    
    const formData = {
      'name' : name,
      'description': description,
      'public': _public
    }
    const userId = state.user.id
    const { data } = await savePlaylist(userId, formData)
    state.randomPlaylist = data
    let message = 'Playlist created successfully!'
    state.message = message
    alert.value.showAlert(
      'success', // There are 4 types of alert: success, info, warning, error
      message, // Message of the alert
      'Alright', // Header of the alert
      ALERT_OPTIONS
    )
    addTracksToUserPlaylist(state.randomPlaylist.id)
    state.isProcessing = false
  }

  const separar = (items, max) => {
    return items.reduce((accumulator, item, index) => {
      const group = Math.floor(index / max)
      accumulator[group] = [...(accumulator[group] || []), item]
      return accumulator
    }, [])
  }

  const addTracksToUserPlaylist = async(playlistId) => {
    try{
      state.isProcessing = true
      const tracks = state.tracks.filter(track => track.checked).map(track => track.uri)
      const tracksGroups = separar(tracks, 100)
      tracksGroups.forEach(async (trackGroup) => {
        const formData = {
          'uris': trackGroup
        }
        const { data } = await addTracksToPlaylist(playlistId, formData)
        state.randomPlaylist = data
      })
      state.message = 'The songs were successfully added!'
      setTimeout(() => {
        router.push('/playlist/' + playlistId)
      }, 1000)
    }catch(error){
      console.log(error)
      alert.value.showAlert(
        'error', // There are 4 types of alert: success, info, warning, error
        error.response, // Message of the alert
        'Ops', // Header of the alert
        ALERT_OPTIONS
      )
    } 
    state.isProcessing = false  
  }

  const tryTransferPLaybackState = async() => {
    const { data } = await getDevices()
    state.devices = data.devices
    if(state.devices.length == 0){
      let message = 'No device connected!'
      state.message = message
      alert.value.showAlert(
        'info', // There are 4 types of alert: success, info, warning, error
        message, // Message of the alert
        'Info', // Header of the alert
        ALERT_OPTIONS
      )
      state.isProcessing = false
      return
    }
    const device_id = state.devices[0].id
    await transferUserPlayback(device_id)
  }

  const addToQueue = async() => {
    state.message = 'Adding songs, wait...'
    await getPlaybackUserState()
    if(!state.isPlaying){
      tryTransferPLaybackState()
    }
    const tracks = state.tracks.filter(track => track.checked).map(track => track.uri)
    let added = false
    state.processingEnd = tracks.length
    for (let i = 0; i < tracks.length; i++) {
      state.processingStart = i+1
      await new Promise(r => setTimeout(r, 200))
      await addTrackToQueue(tracks[i])
      added = true
    }
    if(!added){
      if(state.randomPlaylist){
        openPlaylistApp(state.randomPlaylist.id)
        state.isProcessing = false
        return
      }
      let message = "It's not possible to add song to the playlist! Try again."
      state.message = message
      alert.value.showAlert(
        'error', // There are 4 types of alert: success, info, warning, error
        message, // Message of the alert
        'Error', // Header of the alert
        ALERT_OPTIONS
      )
      state.isProcessing = false
      return
    }
    let message = 'Songs added to playlist successfully!'
    state.message = message
    alert.value.showAlert(
      'success', // There are 4 types of alert: success, info, warning, error
      message, // Message of the alert
      'Alright', // Header of the alert
      ALERT_OPTIONS
    )
    state.isProcessing = false
  }

  const executeUserPlaylist = async() => {
    state.processingStart = 1    
    state.isProcessing = true
    if(!state.randomPlaylist){
      await addToQueue()
      return
    }

    try{
      const formData = {
        "context_uri": "spotify:playlist:" + state.randomPlaylist.id,
          "offset": {
            "position": 0
          },
          "position_ms": 0,
      }
      await executePlaylist(formData)
      state.isProcessing = false
    }catch(error){
      console.log(error)
      state.isProcessing = false
      alert.value.showAlert(
        'error', // There are 4 types of alert: success, info, warning, error
        error.response, // Message of the alert
        'Error', // Header of the alert
        ALERT_OPTIONS
      )
    }
  }

  const openPlaylistApp = (playlist_id) => {
    window.open(`https://open.spotify.com/playlist/${playlist_id}`)
  }

  const setPickMode = (mode) => {
    state.pickMode = mode
  }

  const setOrderMode = (order) => {
    state.orderMode = order
    setMode()
  }

  const setMode = async() => {
    state.tracks = []
    switch (state.pickMode) {
      case 'popularity':
        await getUserPlaylistTracks()
        break;
      
      case 'usertopitems':
        await getUserTopItems()
        emit('update-step-data', 99)
        
      default:
        break;
    }
  }

  const filterPLaylists = (value = 'all') => {
    state.filters = [value]

    state.filters.map(item => {
      switch (item) {
        case 'all':
          state.playlists = state.playlistsOriginal
          break

        case 'liked':
          filterPrivatePlaylists(false)
          break

        case 'private':
          filterPrivatePlaylists(true)
          break
      
        default:
          break
      }
    })
  }

  const filterPrivatePlaylists = (value = true) => {
    state.playlists.forEach(item => item.checked = false)
    if (value) {
      state.playlists = state.playlistsOriginal.filter(
        playlist => playlist.owner.display_name == state.user.display_name          
      )
      return
    }
    
    state.playlists = state.playlistsOriginal.filter(
      playlist => playlist.owner.display_name != state.user.display_name          
    )
  }

  const selectAll = () => {
    const playlists_selected = state.playlists.filter(item => item.checked)
    if (playlists_selected.length < state.playlists.length) {
      state.playlists.forEach(item => item.checked = true)
      return
    }

    state.playlists.forEach(item => item.checked = false)
  }

  const props = defineProps({
    stepData: {
      type: Number,
      default: 1
    }
  });

  const currentStep = computed(() => {
    return props.stepData;
  })

  const emit = defineEmits(['update-step-data'])

  onMounted(async () => {    
    const { data } = await getProfile()
    state.user = data
    getUserPlaylists()
    emit('update-step-data', 1)
  })

</script>

<template>
  <div class="page">
    <vue-basic-alert :duration="300" :closeIn="3000" ref="alert" />    
    <div class="footer-fixed" v-if="currentStep == 99">
      <button class="btn-save" @click="saveUserPlaylist()" :disabled="state.isProcessing">
        <font-awesome-icon icon="save" v-if="!(state.isProcessing)"/>
        <font-awesome-icon icon="spinner" v-if="(state.isProcessing)"/>
      </button>
      <button class="btn-execute" @click="executeUserPlaylist()" :disabled="state.isProcessing">
        <font-awesome-icon icon="play" v-if="!(state.isProcessing)"/>
        <font-awesome-icon icon="hourglass" v-if="(state.isProcessing)"/>
        <div v-if="!(state.isProcessing)"> Play</div>
        <div v-if="(state.isProcessing)"> Loading... {{state.processingStart}}/{{state.processingEnd}}</div>
      </button>
    </div> 
    <div v-if="(currentStep == 1)">
      <h3
        class="center" 
        style="margin: 20px 0 20px 0;color:#fff"
      >
      Select the playlists you like the most:
      </h3>          
      <button 
        class="button-spotify-clear-filter button-light" 
        v-if="!state.filters.includes('all')"
        @click="filterPLaylists('all')"
      >
      X
      </button>
      <button 
        class="button-spotify" 
        :class="{ 'button-dark': state.filters.includes('private'), 'button-light': !state.filters.includes('private') }"
        @click="filterPLaylists('private')"
      >
      My playlists
      </button>
      <button 
        class="button-spotify" 
        :class="{ 'button-dark': state.filters.includes('liked'), 'button-light': !state.filters.includes('liked') }" 
        @click="filterPLaylists('liked')"
      >
      Liked
      </button>
      <button 
        class="button-spotify-no-border" 
        :class="'button-light-no-border'" 
        @click="selectAll()"
      >
      Select all
      </button>
      <p class="message">{{state.message}}</p>
      <!-- lista com as playlists-->
      <div style="margin-top: 20px" class="list-list">
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
                <div class="list-item-image">
                  <img :src="playlist.images[0]?.url" style="width: 40px; height: 40px;margin-right: 20px;" />
                </div>
                <div class="list-item-text">
                  <div class="list-item-title">{{playlist.name}}</div>
                  <div class="list-item-subtitle">{{playlist.tracks.total}} songs</div>
                </div>
              </div>
            </li>
          </ul>
      </div>
    </div>
    <div v-if="(currentStep == 2)">
      <h3 class="center" style="margin-top: 20px;color:#fff">How many songs ?</h3>          
      <p class="message">{{state.message}}</p>
      <input type="number" v-model="state.numberTracks" class="input-number center" min="1" max="999" />
    </div>
    <div v-if="(currentStep == 3)">
      <h3 class="center" style="margin-top: 20px;color:#fff">How the songs will be picked?</h3>          
      <p class="message">{{state.message}}</p>
      <button class="button-spotify button-light" 
        @click="generatePlaylist()">Random
      </button>
      <button class="button-spotify" 
        :class="{ 'button-dark': state.pickMode == 'popularity', 'button-light': state.pickMode != 'popularity' }" 
        @click="setPickMode('popularity')">By popularity
      </button>
      <button class="button-spotify" 
      :class="{ 'button-dark': state.pickMode == 'usertopitems', 'button-light': state.pickMode != 'usertopitems' }" 
        @click="setPickMode('usertopitems')">User top items</button>
    </div>
    <div v-if="((state.pickMode == 'popularity') || (state.pickMode == 'usertopitems')) &&
      currentStep == 3">
      <h3 class="center" style="margin-top: 20px;color:#fff">How the songs will be ordered?</h3>          
      <p class="message">{{state.message}}</p>
      <button class="button-spotify button-light" @click="setOrderMode('top')">Top first</button>
      <button class="button-spotify button-light" @click="setOrderMode('bottom')">Top last</button>
    </div>
    <div v-if="(currentStep == 99)">
      <h3 v-if="state.tracks.length > 0" class="center" style="margin-top: 20px;color:#fff">This is your {{state.tracks.filter(track => track.checked).length}} picked track(s):</h3>          
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
                <div class="list-item-image">
                  <img :src="track.album.images[0].url" style="width: 40px; height: 40px;margin-right: 20px;" />
                </div>
                <div class="list-item-text">
                  <div class="list-item-title">{{track.name}}</div>
                  <div class="list-item-subtitle">{{track.artists[0].name}}</div>
                </div>
              </div>
              <div class="list-item-popularity">
                <font-awesome-icon v-if="(track.popularity < 40)" class="icon-popularity-bad" icon="chart-line"/>
                <font-awesome-icon v-else-if="(track.popularity >= 40 && track.popularity < 70)" class="icon-popularity-medium" icon="chart-line"/>
                <font-awesome-icon v-else-if="(track.popularity >= 70)" class="icon-popularity-good" icon="chart-line"/>
                {{track.popularity}}%
              </div>
            </li>
          </ul>
      </div>
    </div>             
  </div>
</template>

<style scoped>

.page{
  /*margin-top: 40px;*/
}
.button-spotify-clear-filter {
  border-radius: 20px;
  border: none;
  padding: 10px 13px;
  letter-spacing: 1px;
  font-size: 11px;
  outline: none;
  margin: 3px;
  cursor: pointer;
}
.button-spotify {
  border-radius: 20px;
  border: none;
  padding: 10px 18px;
  letter-spacing: 1px;
  font-size: 11px;
  outline: none;
  margin: 3px;
  cursor: pointer;
}
.button-spotify-no-border {
  border: none;
  padding: 10px 18px;
  letter-spacing: 1px;
  font-size: 11px;
  outline: none;
  margin: 3px;
  cursor: pointer;
}
.button-dark {
  background: rgb(30, 215, 96);
  color: rgb(255, 255, 255);
  border: 1px solid rgb(30, 215, 96);
}
.button-light {
  background: none;
  color: rgb(200, 200, 200);
  border: 1px solid rgb(200, 200, 200);
}
.button-light-no-border {
  background: none;
  color: rgb(200, 200, 200);
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
    padding: 0px;
    margin-bottom: 130px;
}
.list-item{
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    margin: auto;
    width: 100%;
    height: auto;
    margin-top: 10px;
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
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  margin: auto;
  flex: 90%;
}
.list-item-title{
    color: #fff;
}
.list-item-subtitle{
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
.btn-save{
    margin-right: 10px;
    /* background-image: linear-gradient(60deg, #e0eb98, #62faf5); */
    background-color: #62faf5;
    color: black;
    border: none;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
}
.btn-execute{
    margin-right: 10px;
    background-image: linear-gradient(60deg, #e0eb98, #62faf5);
    color: #1c1c1c;
    border: none;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
}
.footer-fixed{
    position: absolute;
    top: 58px;
    left: 0;
    right: 0;
    background-color: #1c1c1c;
    padding: 10px;
    display: flex;
    justify-content: center;
}
.list-item-popularity{
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  color: #fff;
  font-size: 11px;
}
.icon-popularity-bad {
  color: rgb(255, 23, 23);
  margin-right: 3px;
}
.icon-popularity-medium {
  color: rgb(255, 240, 30);
  margin-right: 3px;
}
.icon-popularity-good {
  color: rgb(117, 255, 24);
  margin-right: 3px;
}
</style>
