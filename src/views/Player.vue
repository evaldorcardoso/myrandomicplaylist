<script setup>
  import { onMounted, onBeforeMount, onBeforeUnmount, ref, reactive } from 'vue'
  import { useProfile } from '@/support/spotifyApi'
  import AddToPlaylistModal from '@/components/AddToPlaylistModal.vue'
  import SellSlotModal from '@/components/SellSlotModal.vue'
  import { useUserStore } from '@/stores/user'
  import { usePlaylistStore } from '@/stores/playlist'
  import { PlaylistService } from '../services/PlaylistService'

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

  const { loadAllFromDatabase } = PlaylistService()

  const props = defineProps({
    stepData: {
      type: Number,
      default: 0
    },
    removeTrack: {
      type: String,
      default: ''
    },
    currentData: {
      type: [Object, String, null],
      default: () => ({})
    }
  });

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

  const addToPlaylistOpen = ref(false)
  const sellSlotOpened = ref(false)
  const sellSlotData = ref(null)
  const userStore = useUserStore()
  const playlistStore = usePlaylistStore()

  const getTrackStatistics = async() => {
    if (! state.item) return
    if (state.databaseTracks.length == 0) {
      state.databaseTracks = await userStore.getTracks()
    }
    state.item.popularity_old = userStore.getTrack(state.item?.id)?.popularity ?? state.item?.popularity
    state.track.tracked = userStore.getTrack(state.item?.id)
  }

  const copyTrackName = async () => {
    if (state.item?.name) {
      await navigator.clipboard.writeText(state.item.name)
      state.message = 'Track name copied!'
      setTimeout(() => { state.message = '' }, 2000)
    }
  }

  const copyTrackArtist = async () => {
    if (state.item?.artists?.[0]?.name) {
      await navigator.clipboard.writeText(state.item.artists[0].name)
      state.message = 'Artist name copied!'
      setTimeout(() => { state.message = '' }, 2000)
    }
  }

  const openAddToPlaylist = () => {
    addToPlaylistOpen.value = true
  }

  const onCloseAddToPlaylist = () => {
    addToPlaylistOpen.value = false
  }

  const onSellSlot = (data) => {
    addToPlaylistOpen.value = false
    sellSlotData.value = data
    sellSlotOpened.value = true
  }

  const onCloseSellSlot = () => {
    sellSlotOpened.value = false
    sellSlotData.value = null
  }

  const getUserDevices = async() => {
    const { data } = await getDevices()
    state.devices = data.devices
  }

  const getPlaybackUserState = async() => {
    const { data } = await getPlaybackState()
    if (! data) {
      stopProgress()
      return
    }
    state.isPlaying = data.is_playing
    if (! data.is_playing) {
      stopProgress()
      return
    }
    let date = new Date(data.progress_ms)
    state.item = data.item
    state.track.time = date.getUTCMinutes() + ':' + date.getUTCSeconds()
    date = new Date(data.item.duration_ms)
    state.track.time_total = data.item.duration_ms
    state.track.display_time_total = date.getUTCMinutes() + ':' + ('0' + date.getUTCSeconds()).slice(-2)
    state.track.progress = (data.progress_ms / state.track.duration_ms) * 100
    state.progressMs = data.progress_ms
    date = new Date(data.item?.album.release_date)
    state.track.release = ((date.getDate() )) + "/" + ((date.getMonth() + 1)) + "/" + date.getFullYear()
    progress()
  }

  const resumeUserPlayback = async() => {
    const { status } = await startResumePlayback()
    await getPlaybackUserState()
  }

  const pauseUserPlayback = async() => {
      const { status } = await pausePlayback()
      await getPlaybackUserState()
  }

  const skipToUserNext = async() => {
      const { status } = await skipToNext()
      await getPlaybackUserState()
  }

  const skipToUserPrevious = async() => {
      const { status } = await skipToPrevious()
      await getPlaybackUserState()
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

  const stopProgress = () => {
    clearInterval(intervalProgress)
    intervalProgress = null
  }

  const progress = async() => {
    const interval = 500
    if (intervalProgress) {
      return //interval already started
    }
    intervalProgress = setInterval(function() {
        if (! state.isPlaying){
            state.prog = 0
            stopProgress()
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
        let date = new Date(state.prog)
        state.track.time = date.getUTCMinutes() + ':' + ('0' + date.getUTCSeconds()).slice(-2)
    }, interval)
  };

  setInterval(async () => {
    try{
      await getPlaybackUserState()
      getTrackStatistics()
    } catch(error) {
      console.log('error on get playback state')
      console.error(error)
    }
  }, 10000)

  onMounted(async () => {
    progress()
    if (! playlistStore.isLoaded) {
      const playlists = await loadAllFromDatabase()
      playlistStore.loadAll(playlists)
    }
    getTrackStatistics()
  })
  
  onBeforeMount(async () => {
    await getUserDevices()
    await getPlaybackUserState()
  })

  onBeforeUnmount(() => {
    stopProgress()
  })

</script>

<template>
  <AddToPlaylistModal
    :open="addToPlaylistOpen"
    :track="state.item"
    @close="onCloseAddToPlaylist"
    @sell-slot="onSellSlot"
  />
  <SellSlotModal
    :open="sellSlotOpened"
    :track="sellSlotData ? { track: sellSlotData.track } : null"
    :playlist-id="sellSlotData?.playlistId ?? ''"
    :playlist="sellSlotData?.playlist ?? null"
    :position="sellSlotData?.position"
    :select-playlist="false"
    @close="onCloseSellSlot"
    @confirm="onCloseSellSlot"
  />
  <div class="page px-gutter md:px-lg py-md space-y-lg"> 
    <p v-if="state.message" class="text-center text-label-sm text-primary">{{ state.message }}</p>     

    <div v-if="state.devices.length === 0" class="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div class="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center">
        <font-awesome-icon icon="mobile-alt" class="text-primary text-[32px]" />
      </div>
      <p class="text-body-md text-on-surface-variant max-w-[420px]">
        Desculpe, mas não conseguimos localizar nenhum dispositivo conectado à sua conta!
      </p>
    </div>

    <!-- Player Hero -->
    <div v-if="state.devices.length > 0" class="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-xl border border-outline-variant/10 shadow-xl">
      <div class="absolute top-0 right-0 -mt-16 -mr-16 w-96 h-96 bg-primary/10 blur-[120px] rounded-full"></div>
      <div class="relative flex flex-col md:flex-row gap-xl items-center md:items-start">
        <div class="relative group shrink-0">
          <div class="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"></div>
          <img
            v-if="state.item?.album?.images?.[0]?.url"
            class="relative w-52 h-52 md:w-72 md:h-72 object-cover rounded-xl shadow-2xl border border-outline-variant/20"
            :src="state.item.album.images[0].url"
          />
          <div v-else class="relative w-52 h-52 md:w-72 md:h-72 rounded-xl bg-surface-container-high flex items-center justify-center">
            <font-awesome-icon icon="music" class="text-on-surface-variant text-[48px]" />
          </div>
        </div>

        <div class="flex-1 flex flex-col gap-4 py-2 w-full min-w-0">
          <div class="flex items-center gap-3">
            <font-awesome-icon v-if="state.track?.tracked" icon="heart" class="text-primary text-[22px] shrink-0" />
            <h1 class="text-headline-lg md:text-display-lg text-on-surface truncate">{{ state.item?.name }}</h1>
          </div>
          <h4 class="text-body-md text-on-surface-variant">{{ state.item?.artists?.map(artist => artist.name).join(', ') }}</h4>

          <div class="flex flex-col gap-1 w-full">
            <div class="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
              <div class="h-full bg-primary transition-[width] duration-100" :style="{ width: state.progPerc + '%' }"></div>
            </div>
            <div class="flex justify-between text-[10px] text-on-surface-variant tabular-nums">
              <span>{{ state.track?.time }}</span>
              <span>{{ state.track?.display_time_total }}</span>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <button class="w-12 h-12 bg-surface-container-high text-on-surface rounded-full flex items-center justify-center hover:text-primary hover:scale-105 transition-all" @click="skipToUserPrevious()">
              <font-awesome-icon icon="step-backward" />
            </button>
            <button
              v-if="!state.isPlaying"
              class="w-16 h-16 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
              @click="resumeUserPlayback()"
            >
              <font-awesome-icon icon="play" class="text-[24px] ml-1" />
            </button>
            <button
              v-else
              class="w-16 h-16 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
              @click="pauseUserPlayback()"
            >
              <font-awesome-icon icon="pause" class="text-[24px]" />
            </button>
            <button class="w-12 h-12 bg-surface-container-high text-on-surface rounded-full flex items-center justify-center hover:text-primary hover:scale-105 transition-all" @click="skipToUserNext()">
              <font-awesome-icon icon="step-forward" />
            </button>
          </div>

          <div class="flex flex-wrap gap-8 py-4 border-t border-outline-variant/10">
            <div class="flex flex-col">
              <span class="text-label-sm text-on-surface-variant uppercase tracking-wider">Popularity</span>
              <div class="flex items-center gap-1 text-headline-md text-on-surface">
                <font-awesome-icon icon="chart-line" class="text-primary text-[16px]" />
                {{ state.item?.popularity }}%
              </div>
            </div>
            <div class="flex flex-col">
              <span class="text-label-sm text-on-surface-variant uppercase tracking-wider">Released</span>
              <span class="text-headline-md text-on-surface">{{ state.track?.release }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="relative flex flex-wrap items-center gap-3 pt-4 border-t border-outline-variant/10">
        <button class="flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-full font-bold hover:brightness-110 transition-all" @click="openAddToPlaylist()">
          <font-awesome-icon icon="plus" />
          Add to playlist
        </button>
        <button class="flex items-center gap-2 bg-surface-container-high text-on-surface px-4 py-3 rounded-full text-label-md hover:bg-surface-variant transition-colors" @click="copyTrackName()" title="Copy track name">
          <font-awesome-icon icon="copy" />
          Copy Track
        </button>
        <button class="flex items-center gap-2 bg-surface-container-high text-on-surface px-4 py-3 rounded-full text-label-md hover:bg-surface-variant transition-colors" @click="copyTrackArtist()" title="Copy artist name">
          <font-awesome-icon icon="copy" />
          Copy Artist
        </button>
      </div>
    </div>         

    <!-- Devices -->
    <section v-if="state.devices.length > 0" class="flex flex-col gap-md">
      <div class="flex items-center justify-between">
        <h3 class="text-headline-sm text-on-surface">Dispositivos disponíveis</h3>
        <span class="px-2 py-0.5 bg-surface-container-high rounded text-label-sm text-on-surface-variant">
          {{ state.devices.length }} {{ state.devices.length === 1 ? 'dispositivo' : 'dispositivos' }}
        </span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter md:gap-md">
        <button
          v-for="device in state.devices"
          :key="device.id"
          class="flex items-center gap-4 bg-surface-container-low rounded-xl p-4 border border-outline-variant/10 hover:bg-surface-container transition-colors text-left"
          :class="{ 'border-primary/40': device.is_active }"
          @click="transferUserPlayback(device.id)"
        >
          <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0" :class="device.is_active ? 'bg-primary/20 text-primary' : 'bg-surface-container-high text-on-surface-variant'">
            <font-awesome-icon :icon="device.is_active ? 'check' : 'mobile-alt'" />
          </div>
          <div class="flex flex-col min-w-0 flex-1">
            <span class="text-body-md font-semibold text-on-surface truncate">{{ device.name }}</span>
            <span class="text-label-sm" :class="device.is_active ? 'text-primary' : 'text-on-surface-variant'">{{ device.type }}</span>
          </div>
          <span v-if="device.is_active" class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest shrink-0">
            Ativo
          </span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
</style>
