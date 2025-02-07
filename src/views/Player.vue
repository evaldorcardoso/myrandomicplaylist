<script setup>
  import { onMounted, onBeforeMount, ref, computed, reactive } from 'vue'
  import { useProfile } from '@/support/spotifyApi'
  import FloatMenu from '@/components/FloatMenu.vue'
  import { useUserStore } from '@/stores/user'
  import { usePlaylistStore } from '@/stores/playlist'

  var intervalProgress;
  const { 
    getDevices, 
    getPlaybackState,
    skipToNext,
    skipToPrevious,
    pausePlayback,
    startResumePlayback,
    transferPlayback
  } = useProfile()

  const state = reactive({
    progPerc: 0,
    prog: 0,
    progOrig: 0,
    devices: [],
    isPlaying: false,
    databaseTracks: [],
    message: '',
    progressMs: 0,
    item: null,
    track: {
      name: '',
      time: "",
      time_total: "",
      display_time_total: '',
      progress: 0,
      release: ""
    },
  })

  const isMenuOpened = ref(null)
  const menuDataReactive = ref(null)
  const userStore = useUserStore()
  const playlistStore = usePlaylistStore()
  const { getPlaylists } = useProfile()

  const currentUser = computed(() => {
    return userStore.getUser
  });

  const menuOpened = computed(() => {
    return isMenuOpened.value;
  })

  const menuData = computed(() => {
    return menuDataReactive.value
  })

  const onUpdateMenuOpened = (value) => {
    isMenuOpened.value = value    
  }

  const getTrackStatistics = async() => {
    if (state.databaseTracks.length == 0) {
      state.databaseTracks = await userStore.getTracks()
    }
    state.item.popularity_old = userStore.getTrack(state.item.id)?.popularity ?? state.item.popularity
    state.track.tracked = userStore.getTrack(state.item.id)
  }

  const trackInfo = (track, addToAnotherPlaylist = false) => {
    track['playlist'] = {
      id: state.item.id,
      owner: 'player'
    }

    let menuData = {
      type: 'track',
      track,
      listPlaylists: addToAnotherPlaylist
    }
    menuDataReactive.value = menuData
    isMenuOpened.value = true
  }

  const getUserDevices = async() => {
    const { data } = await getDevices()
    state.devices = data.devices
  }

  const getPlaybackUserState = async() => {
    const { data } = await getPlaybackState()
    state.isPlaying = data.is_playing
    let date = new Date(data.progress_ms);          
    state.item = data.item
    state.track.time = date.getUTCMinutes() + ':' + date.getUTCSeconds()
    date = new Date(data.item.duration_ms);
    state.track.time_total = data.item.duration_ms
    state.track.display_time_total = date.getUTCMinutes() + ':' + ('0' + date.getUTCSeconds()).slice(-2)
    state.track.progress = (data.progress_ms / state.track.duration_ms) * 100
    state.progressMs = data.progress_ms
    date = new Date(data.item?.album.release_date)
    state.track.release = ((date.getDate() )) + "/" + ((date.getMonth() + 1)) + "/" + date.getFullYear();
  }

  const resumeUserPlayback = async() => {
    const { status } = await startResumePlayback()
    if (status == 204){
        state.isPlaying = !state.isPlaying
        progress()
    }
  }

  const pauseUserPlayback = async() => {
      const { status } = await pausePlayback()
      if (status == 204){
          state.isPlaying = !state.isPlaying
          clearInterval(intervalProgress);
      }
  }

  const skipToUserNext = async() => {
      const { status } = await skipToNext()
      if (status == 204){
        state.progPerc = 0
      }
  }

  const skipToUserPrevious = async() => {
      const { status } = await skipToPrevious()
      if (status == 204){
        state.progPerc = 0
      }
  }

  const transferUserPlayback = async(deviceId) => {
    const formData = {
      "device_ids": [deviceId]
    }
    await transferPlayback(formData)
    const device = state.devices.find(device => device.id === deviceId)
    if((device.is_active)&&(!state.isPlaying)){
      await startResumePlayback()
    }
    await getUserDevices()
  }

  const progress = async() => {
    const interval = 500
    intervalProgress = setInterval(function() {
        if (!state.isPlaying){
            state.prog = 0
            return
        }
        state.prog = state.prog + interval
        if (state.prog >= state.track.time_total) {
            state.prog = 0
            getPlaybackUserState()            
            return
        }
        if (state.progOrig != state.progressMs) {
            state.progOrig = state.progressMs
            state.prog = state.progressMs
        }
        state.progPerc = (state.prog / state.item.duration_ms) * 100
        let date = new Date(state.prog);          
        state.track.time = date.getUTCMinutes() + ':' + ('0' + date.getUTCSeconds()).slice(-2)
        getTrackStatistics()
    }, interval)
  };

  setInterval(async () => {
    try{
      await getPlaybackUserState()
    } catch(error) {
      console.log('error on get playback state')
    }
  }, 10000)

  onMounted(async () => {
    progress()
    if (! playlistStore.isLoaded) {
      const data = await getPlaylists()
      const filteredItems = data.filter(Boolean)
      filteredItems.forEach((item) => {
      item.isOwner = item.owner.display_name === currentUser.value.display_name
      })
      playlistStore.loadAll(filteredItems)
    }
    getTrackStatistics()
  })
  
  onBeforeMount(async () => {
    await getUserDevices()
    await getPlaybackUserState()
  })

</script>

<template>
  <FloatMenu 
    :menu-opened="menuOpened"
    :menu-data="menuData"
    :user-data="currentUser"
    @update-menu-opened="onUpdateMenuOpened" 
    /> 
  <div class="page"> 
    <p class="message">{{state.message}}</p>     
    <div class="player" v-if="state.devices.length > 0">
      <div class="artwork">
        <img v-bind:src="state.item?.album.images[0].url" style="width: 100%; height: 100%;" />
      </div>
      <div class="track-name">
        <font-awesome-icon v-if="state.track?.tracked" icon="heart" style="vertical-align:middle;margin-right:5px;color: rgb(30, 215, 96);;" />
        <h3>{{ state.item?.name }}</h3>
      </div>
      <div class="track-artists">
        <!-- exibir os artistas separados por vírgula-->
        <h4>{{ state.item?.artists.map(artist => artist.name).join(', ') }}</h4>
      </div>
      <div class="bar-progress">
        <div class="bar-progress-fill" :style="{ width: (state.progPerc) + '%'}"></div>
      </div>
      <div class="track-time">
        <span>{{ state.track?.time }}</span>
        <span>{{ state.track?.display_time_total }}</span>
      </div>
      <div class="player-controls">
        <button class="btn-previous" @click="skipToUserPrevious()"><font-awesome-icon icon="step-backward"/></button>
        <button v-if="!state.isPlaying" class="btn-play" @click="resumeUserPlayback()"><font-awesome-icon icon="play"/></button>
        <button v-if="state.isPlaying" class="btn-play" @click="pauseUserPlayback()"><font-awesome-icon icon="pause"/></button>
        <button class="btn-next" @click="skipToUserNext()"><font-awesome-icon icon="step-forward"/></button>
      </div>
      <div class="info">
        <h4>Popularity: {{ state.item?.popularity }}</h4>
        <h4>Released: {{ state.track?.release }}</h4>
        <button class="btn-generate" @click="trackInfo(state.item, true)">Add to playlist</button>
      </div>
    </div>         
    <div class="devices" v-if="state.devices.length > 0">
      <h3>Dispositivos disponíveis:</h3>
      <div class="device" v-for="device in state.devices" @click="transferUserPlayback(device.id)">
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

<style lang="scss" scoped>
.message{
    color: #fff;
    font-size: 12px;
    text-align: center;
}
.span-no-devices{
  text-align: center;
  font-size: 18px;
  margin-top: 40px;
  color: #fff;
}
.center{
  display: block;
    margin-left: auto;
    margin-right: auto
}
.player{
  margin: 40px auto 40px auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 300px;
  height: auto;
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
  display: flex;
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
  transition: width 0.1s;
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
.btn-down{
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
.info {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 300px;
  height: auto;
  color: #999;
}
.info h4 {
  margin: 10px 5px;
}
.btn-generate {
  margin: 25px auto auto auto;
  background-image: linear-gradient(60deg, #e0eb98, #62faf5);
  color: black;
  border: none;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  border-radius: 20px;
  border: none;
}
</style>
