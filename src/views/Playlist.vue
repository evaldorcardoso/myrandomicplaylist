<script setup>
  import { onMounted, onUnmounted, computed, reactive, ref, inject, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useGeneral, useProfile } from '@/support/spotifyApi'
  import { usePlaylistStore } from '@/stores/playlist'
  import { useUserStore } from '@/stores/user'
  import FloatMenu from '@/components/FloatMenu.vue'
  import Notification from '@/components/Notification.vue'
  import SellSlotModal from '@/components/SellSlotModal.vue'
  import SlotManagementModal from '@/components/SlotManagementModal.vue'
  import { NOTIFICATIONS_TYPE } from '@/support/helpers'
  import { notify } from "@kyvg/vue3-notification";
  import { PlaylistService } from '@/services/PlaylistService'
  import { usePlaylistData, NOTIFICATION_ACTIONS } from '@/composables/usePlaylistData'
  import { PlaylistDetailsService } from '@/services/PlaylistDetailsService'
  import { TrackRequestService } from '@/services/TrackRequestService'

  const route = useRoute()
  const router = useRouter()
  const playlistStore = usePlaylistStore()
  const userStore = useUserStore()
  const progress = inject("progress")
  const { updateTracksOfPlaylist, updatePlaylist, removeTracksOfPlaylist } = useGeneral()
  const { addTrackToQueue } = useProfile()
  const { updatePlaylistTotalTracks } = PlaylistService()
  const { getPlaylistDetails, getAudience, getTrackSlot, getGrowth } = PlaylistDetailsService()
  const { getTrackRequests, deleteTrackRequest } = TrackRequestService()

  const PAGE_SIZE = 20

  const props = defineProps({
    forceRefresh: {
        type: Boolean,
        default: false,
    },
    removeTrack: {
      type: String,
      default: ''
    },
    stepData: {
      type: Number,
      default: 1
    },
    currentData: {
        type: Object,
        default: () => { },
    }
  });

  const emit = defineEmits(['updateStepData', 'updateMenuData'])

  const sortOptions = [
    'default',
    'top first',
    'top last',
    'added first',
    'added last'
  ]

  const callbacks = {}
  const pd = usePlaylistData(callbacks)

  const {
    state,
    playlistId,
    notificationOpened,
    notificationData,
    notificationAction,
    isNotificationOpened,
    init,
    onRefreshPage,
    onNotificationAction,
    showNotification,
    executeUserPlaylist,
    getPlaylistTracks,
    checkTracksStatistics,
    removeTrackStatistics,
    genres
  } = pd

  const isMenuOpened = ref(null)
  const menuDataReactive = ref(null)
  const editPlaylistDescription = ref(false)
  const activeTab = ref('Todas')
  const currentPage = ref(1)
  const sortPosition = ref(0)
  const differentSort = ref(false)
  const isProcessing = ref(false)
  const lastUpdatedLabel = ref('')
  const countdownTimer = ref(null)
  const trackRequests = ref([])
  const trackRequestsLoaded = ref(false)
  const isLoading = ref(true)
  const sellSlotOpened = ref(false)
  const sellSlotTrack = ref(null)
  const slotManagementOpened = ref(false)
  const slotManagementTrack = ref(null)
  const slotManagementRequest = ref(null)

  const followersReady = computed(() => state.playlist?.followers != null)
  const growthReady = computed(() => state.dataLikes.length > 0)
  const slotsReady = computed(() =>
    trackRequestsLoaded.value && (state.tracks.length > 0 || !isLoading.value)
  )

  const currentUser = computed(() => userStore.getUser)
  const currentPlaying = computed(() => props.currentData)

  const menuOpened = computed(() => isMenuOpened.value)
  const menuData = computed(() => menuDataReactive.value)

  const details = computed(() => {
    const trackIds = new Set(state.tracks.map(t => t.track?.id))
    const requests = trackRequests.value.filter(r => r.track_id && trackIds.has(r.track_id))
    const filledPositions = requests.length
    const monthlyRevenue = requests.reduce((sum, r) => sum + (r.value ?? 0), 0)
    return getPlaylistDetails(state.playlist ?? {}, state.tracks.length, filledPositions, monthlyRevenue, getGrowth(state.dataLikes))
  })
  const growthHint = computed(() => {
    const days = details.growth?.days
    return `Crescimento dos seguidores comparado com a última estatística salva${days ? ` (${days} dias atrás)` : ''}.`
  })

  const audience = computed(() => getAudience())

  const filteredTracks = computed(() => {
    if (activeTab.value === 'Expira em breve') {
      return state.tracks.filter(t => t._slot?.status && t._slot.status !== 'free' && t._slot?.urgent)
    }
    if (activeTab.value === 'Pendentes') {
      return state.tracks.filter(t => t._slot?.status === 'pending')
    }
    return state.tracks
  })

  const totalPages = computed(() => Math.max(1, Math.ceil(filteredTracks.value.length / PAGE_SIZE)))

  const pagedTracks = computed(() => {
    const start = (currentPage.value - 1) * PAGE_SIZE
    return filteredTracks.value.slice(start, start + PAGE_SIZE)
  })

  watch(activeTab, () => {
    currentPage.value = 1
  })

  const pad = (n) => String(n).padStart(2, '0')

  const formatCountdown = (seconds) => {
    if (seconds == null) return '--:--:--'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${pad(h)}:${pad(m)}:${pad(s)}`
  }

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('pt-BR') : '-'

  const formatNumber = (value) => {
    if (value == null) return '0'
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  const popularityDiff = (track) => (track.track?.popularity ?? 0) - (track.track?.popularity_old ?? track.track?.popularity ?? 0)

  const popularityIcon = (popularity) => {
    if (popularity <= 40) return 'text-[#ff1717]'
    if (popularity > 40 && popularity <= 70) return 'text-[#fff01e]'
    return 'text-[#75ff18]'
  }

  const buildSlots = () => {
    const requestsByTrackId = new Map(trackRequests.value.map(request => [request.track_id, request]))
    state.tracks.forEach((track, index) => {
      track._slot = getTrackSlot(track, index, requestsByTrackId.get(track?.track?.id))
    })
  }

  const loadTrackRequests = async () => {
    trackRequests.value = await getTrackRequests(playlistId.value)
    trackRequestsLoaded.value = true
    buildSlots()
  }

  const tickCountdown = () => {
    state.tracks.forEach(track => {
      if (track._slot?.secondsLeft != null && track._slot.secondsLeft > 0) {
        track._slot.secondsLeft--
      }
    })
  }

  const statusPill = (slot) => {
    if (!slot || slot.status === 'free') {
      return { label: 'free', cls: 'bg-surface-container-highest text-on-surface-variant border border-outline-variant/20' }
    }
    if (slot.status === 'pending') {
      return { label: 'pending', cls: 'bg-secondary-container/20 text-secondary border border-secondary/20' }
    }
    return { label: 'paid', cls: 'bg-primary/10 text-primary border border-primary/20' }
  }

  const expirationInfo = (slot) => {
    if (!slot || slot.status === 'free') {
      return { value: '--:--:--', label: 'Permanente', urgent: false }
    }
    if (slot.secondsLeft == null) {
      return { value: '--:--:--', label: 'Sem prazo', urgent: false }
    }
    if (slot.secondsLeft <= 0) {
      return { value: 'Expirado', label: 'Vencido', urgent: true }
    }
    if (slot.status === 'pending') {
      return { value: Math.ceil(slot.secondsLeft / 86400), label: 'Dias', urgent: slot.urgent }
    }
    if (slot.secondsLeft > 86400) {
      return {
        value: Math.ceil(slot.secondsLeft / 86400),
        label: slot.urgent ? 'Expirando' : 'Dias Restantes',
        urgent: slot.urgent
      }
    }
    return {
      value: formatCountdown(slot.secondsLeft),
      label: slot.urgent ? 'Expirando' : 'Tempo Restante',
      urgent: slot.urgent
    }
  }

  const openPlaylistApp = (playlistId) => {
    window.open(`https://open.spotify.com/playlist/${playlistId}`)
  }

  const sharePlaylist = async () => {
    const url = `https://open.spotify.com/playlist/${playlistId.value}`
    if (navigator.share) {
      try {
        await navigator.share({ title: state.playlist?.name, url })
      } catch (error) {
        console.log(error)
      }
      return
    }
    openPlaylistApp(playlistId.value)
  }

  const onSellPosition = () => {
    notify({
      title: 'Em breve',
      text: 'Venda de posições estará disponível em breve!',
      type: 'info'
    })
  }

  const openSellSlot = (track) => {
    sellSlotTrack.value = track
    sellSlotOpened.value = true
  }

  const closeSellSlot = () => {
    sellSlotOpened.value = false
    sellSlotTrack.value = null
  }

  const onConfirmSellSlot = async () => {
    closeSellSlot()
    trackRequestsLoaded.value = false
    state.tracks.forEach(track => {
      track._slot = null
    })
    try {
      await loadTrackRequests()
      notify({
        title: 'Alright',
        text: 'Slot vendido com sucesso!',
        type: 'success'
      })
    } catch (error) {
      console.error(error)
      notify({
        title: 'Ops',
        text: 'Erro ao atualizar as posições!',
        type: 'error'
      })
    }
  }

  const onOpenStatistics = () => {
    router.push(`/playlist/${playlistId.value}/stats`)
  }

  const onOpenArtists = () => {
    router.push(`/playlist/${playlistId.value}/stats`)
  }

  const onUpdateMenuOpened = (value) => {
    isMenuOpened.value = value
    if (!value) {
      checkTracksStatistics()
    }
  }

  const onRemoveTrack = async (value) => {
    playlistStore.removeTrack(playlistId.value, value)
    const trackFound = state.tracks.find(e => e.track.uri === value)?.track?.id
    if (trackFound) {
      removeTrackStatistics(trackFound)
    }
    await playlistStore.updateTracksPosition(playlistId.value)
    await getPlaylistTracks()
    await updatePlaylistTotalTracks(playlistId.value, state.tracks.length)
    sortUserPlaylist(false)
    buildSlots()
  }

  const removeInlineTrack = async (track) => {
    try {
      const formData = {
        'tracks': [{ 'uri': track.track.uri }]
      }
      const { status } = await removeTracksOfPlaylist(playlistId.value, formData)
      if (status === 200) {
        await onRemoveTrack(track.track.uri)
        notify({
          title: 'Alright',
          text: 'Song removed!',
          type: 'success'
        })
        return
      }
      notify({
        title: 'Ops',
        text: 'Status: ' + status + ' not expected!',
        type: 'error'
      })
    } catch (error) {
      console.log(error)
      notify({
        title: 'Ops',
        text: 'An error occurred!',
        type: 'error'
      })
    }
  }

  const openMenuPlaylist = async() => {
    let menuData = {
      type: 'playlist',
      playlist: state.playlist
    }

    let popularities = state.tracks.map(track => { return track.track?.popularity ?? 0 })
    let popularity = popularities.reduce(function(a, b) {
      return a + b
    }, 0)
    menuData.playlist.isOwner = state.playlist.owner.display_name == currentUser.value.display_name
    menuData.playlist.popularity = state.tracks.length ? (popularity / state.tracks.length).toFixed(2) : 0
    menuData.playlist.likesStats = state.dataLikes
    menuDataReactive.value = menuData
    isMenuOpened.value = true
  }

  const findTrackRequest = (track) => {
    return trackRequests.value.find(r => r.track_id === track.track?.id) ?? null
  }

  const openTrackSlotModal = (track) => {
    const status = track._slot?.status ?? 'free'
    if (status === 'free') {
      openSellSlot(track)
      return
    }
    slotManagementTrack.value = track
    slotManagementRequest.value = findTrackRequest(track)
    slotManagementOpened.value = true
  }

  const closeSlotManagement = () => {
    slotManagementOpened.value = false
    slotManagementTrack.value = null
    slotManagementRequest.value = null
  }

  const reloadSlots = async () => {
    trackRequestsLoaded.value = false
    state.tracks.forEach(track => {
      track._slot = null
    })
    await loadTrackRequests()
  }

  const onSlotUpdated = async (type) => {
    closeSlotManagement()
    try {
      await reloadSlots()
      const messages = {
        paid: { title: 'Alright', text: 'Pagamento confirmado!' },
        renewed: { title: 'Alright', text: 'Posição renovada!' },
        'made-free': { title: 'Alright', text: 'Posição liberada como gratuita!' }
      }
      const message = messages[type] ?? { title: 'Alright', text: 'Posição atualizada!' }
      notify({ title: message.title, text: message.text, type: 'success' })
    } catch (error) {
      console.error(error)
      notify({
        title: 'Ops',
        text: 'Erro ao atualizar as posições!',
        type: 'error'
      })
    }
  }

  const onSlotRemoveTrack = async ({ request, track }) => {
    closeSlotManagement()
    try {
      if (request?.id) {
        const { error } = await deleteTrackRequest(request.id)
        if (error) throw error
      }
      await removeInlineTrack(track)
      await reloadSlots()
    } catch (error) {
      console.error(error)
      notify({
        title: 'Ops',
        text: 'Erro ao remover a música!',
        type: 'error'
      })
    }
  }

  const openMovePositionMenu = (track, index) => {
    track['playlist'] = {
      id: state.playlist.id,
      owner: state.playlist.owner.display_name
    }

    let menuData = {
      type: 'track',
      track,
      moveMode: true,
      playlistTracks: state.tracks,
      currentPosition: index
    }
    menuDataReactive.value = menuData
    isMenuOpened.value = true
  }

  const addToQueue = async(track) => {
    try {
      const { status } = await addTrackToQueue(track)
      notify({
        title: 'Alright',
        text: 'Songs added to queue!',
        type: 'success'
      })
    } catch (error) {
      console.log(error)
      showNotification(NOTIFICATIONS_TYPE.danger, 'Ops', error.message)
    }
  }

  const removePartFromText = (text) => {
    const part = "Top artistas:";
    const indice = text.indexOf(part);

    if (indice !== -1) {
      text = text.substring(0, indice);
     }

    return text.trimEnd();
  }

  const openEditPlaylistDescription = (includeTopArtists = false) => {
    var description = state.playlist.description
    if (includeTopArtists) {
      description = removePartFromText(state.playlist.description)
        + ' Top artistas: '
        + state.playlist?.topArtists?.slice(0, 3).map(artist => artist.name).join(', ')
    }
    state.playlistDescription = description
    editPlaylistDescription.value = !editPlaylistDescription.value
    showNotification(
      NOTIFICATIONS_TYPE.info,
      'Info',
      'Save this description on Spotify ?',
      true,
      false
    )
    notificationAction.value = NOTIFICATION_ACTIONS.UPDATE_DESCRIPTION
  }

  const updatePlaylistDescription = async() => {
    isProcessing.value = true
    const formData = {
      'description': state.playlistDescription
    }
    try {
      await updatePlaylist(state.playlist.id, formData)
      notify({
        title: 'Awesome',
        text: 'Playlist description updated successfully!',
        type: 'success'
      })
      editPlaylistDescription.value = false
    } catch (error) {
      console.log(error)
      showNotification(NOTIFICATIONS_TYPE.danger, 'Ops', error.message)
    }
    await handleRefresh()
    isProcessing.value = false
  }

  const checkDifferentSort = () => {
    if (state.playlist?.owner?.display_name != currentUser.value?.display_name) {
      return
    }
    for (let i = 0; i < state.tracks.length; i++) {
      if (i != state.tracks[i].id) {
        showNotification(
          NOTIFICATIONS_TYPE.info,
          'Info',
          'Apply this sort on Spotify ?',
          true,
          false
        )
        differentSort.value = true
        notificationAction.value = NOTIFICATION_ACTIONS.UPDATE_SORT
        return;
      }
    }
    differentSort.value = false
    notificationAction.value = ''
    isNotificationOpened.value = false
  }

  const sortUserPlaylist = (increment = true) => {
    if (increment) {
      sortPosition.value++
      if (sortPosition.value >= sortOptions.length) {
        sortPosition.value = 0
      }
    }

    const option = sortOptions[sortPosition.value]
    if (option === 'top first') {
      state.tracks.sort((a, b) => b.track?.popularity - a.track?.popularity)
    } else if (option === 'top last') {
      state.tracks.sort((a, b) => a.track?.popularity - b.track?.popularity)
    } else if (option === 'added first') {
      state.tracks.sort((a, b) => new Date(a.added_at) - new Date(b.added_at))
    } else if (option === 'added last') {
      state.tracks.sort((a, b) => new Date(b.added_at) - new Date(a.added_at))
    } else {
      state.tracks.sort((a, b) => a.id - b.id)
    }
    checkDifferentSort()
    buildSlots()
    currentPage.value = 1
  }

  const updateTracksOrder = async() => {
    isProcessing.value = true
    var i = 0
    var changes = 0
    while(i < state.tracks.length) {
      let id = state.tracks[i].id
      if (id == i) {
        i++
        continue
      }
      changes++
      notify({ title: 'Please, wait', text: 'Sorting songs... (' + changes + '/' + state.tracks.length + ')', type: 'info' })
      const formData = {
        'range_start': id,
        'insert_before': i
      }
      await updateTracksOfPlaylist(playlistId.value, formData)
      state.tracks.sort((a, b) => a.id - b.id)
      let temp = state.tracks.splice(id, 1)
      state.tracks.splice(i, 0, temp[0])
      for(let j=0; j<state.tracks.length; j++) {
        state.tracks[j].id = j
      }
      sortUserPlaylist(false)
      i = 0
    }

    notify({ title: 'Alright!', text: 'Playlist updated with ' + changes + ' changes!', type: 'success' })
    sortPosition.value = 0
    await handleRefresh()
    differentSort.value = false
    isProcessing.value = false
    buildSlots()
  }

  const handleRefresh = async () => {
    isLoading.value = true
    try {
      await Promise.all([
        onRefreshPage(() => sortUserPlaylist(false)),
        loadTrackRequests()
      ])
      buildSlots()
    } finally {
      isLoading.value = false
    }
  }

  callbacks.onUpdateSort = () => updateTracksOrder()
  callbacks.onUpdateDescription = () => updatePlaylistDescription()
  callbacks.onCancelDescription = () => {
    editPlaylistDescription.value = false
  }

  onMounted(async () => {
    progress.start()
    try {
      await Promise.all([
        init({ topArtistsLimit: 10 }),
        loadTrackRequests()
      ])
      buildSlots()
      lastUpdatedLabel.value = 'Hoje, ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    } finally {
      isLoading.value = false
      progress.finish()
    }
  })

  onMounted(() => {
    countdownTimer.value = setInterval(tickCountdown, 1000)
  })

  onUnmounted(() => {
    if (countdownTimer.value) {
      clearInterval(countdownTimer.value)
    }
  })
</script>

<template>
  <Notification
    :open="notificationOpened"
    :data="notificationData"
    @notification-action="onNotificationAction"
  />
  <FloatMenu
    :menu-opened="menuOpened"
    :menu-data="menuData"
    :user-data="currentUser"
    @update-menu-opened="onUpdateMenuOpened"
    @remove-track="onRemoveTrack"
    @refresh-playlist="handleRefresh"
    @add-queue="addToQueue"
    @open-statistics="onOpenStatistics"
    @open-artists="onOpenArtists"
  />
  <SellSlotModal
    :open="sellSlotOpened"
    :track="sellSlotTrack"
    :playlist-id="playlistId"
    :playlist="state.playlist"
    :select-playlist="false"
    @close="closeSellSlot"
    @confirm="onConfirmSellSlot"
  />
  <SlotManagementModal
    :open="slotManagementOpened"
    :track="slotManagementTrack"
    :request="slotManagementRequest"
    :playlist-id="playlistId"
    :playlist="state.playlist"
    :select-playlist="false"
    @close="closeSlotManagement"
    @updated="onSlotUpdated"
    @remove-track="onSlotRemoveTrack"
  />
  <div class="page px-gutter md:px-lg py-md space-y-lg">
    <div v-if="isProcessing" class="fixed top-20 right-4 z-50 flex items-center gap-2 rounded-xl bg-surface-container-high px-4 py-2 text-on-surface text-body-sm shadow-xl">
      <font-awesome-icon icon="spinner" spin class="text-primary" />
      <span>Processing...</span>
    </div>

    <!-- Header Section: Playlist Profile -->
    <section class="relative flex flex-col md:flex-row gap-lg items-end pb-xl">
      <div class="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div class="relative group shrink-0">
        <div class="w-40 h-40 md:w-64 md:h-64 shadow-2xl rounded-xl overflow-hidden bg-surface-container">
          <img
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            :src="state.playlist?.images ? state.playlist?.images[0]?.url : state.playlist?.image"
          />
        </div>
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl cursor-pointer" @click="openEditPlaylistDescription()">
          <font-awesome-icon icon="edit" class="text-primary text-[48px]" />
        </div>
      </div>

      <div class="flex-1 flex flex-col gap-sm pb-2">
        <h1 class="text-headline-lg md:text-display-lg text-on-surface">{{ state.playlist?.name }}</h1>
        <div v-if="state.playlist?.owner?.display_name" class="flex items-center gap-2 text-primary lowercase tracking-widest text-label-sm">
          <font-awesome-icon icon="check-circle" class="text-[16px]" />
          by @{{ state.playlist.owner.display_name }}
        </div>
        <p v-if="!editPlaylistDescription" class="text-on-surface-variant max-w-2xl text-body-md cursor-pointer" @click="openEditPlaylistDescription()">
          {{ state.playlist?.description || 'Edit description...' }}
        </p>
        <textarea
          v-else
          v-model="state.playlistDescription"
          class="max-w-2xl rounded-xl bg-surface-container-high p-3 text-on-surface text-body-md outline-none resize-none focus:ring-2 focus:ring-primary"
          rows="3"
        />
        <div class="flex flex-wrap items-center gap-xl mt-4">
          <div v-if="!followersReady" class="flex flex-col gap-1">
            <div class="animate-pulse h-3 w-20 rounded bg-surface-container-high"></div>
            <div class="animate-pulse h-7 w-24 rounded bg-surface-container-high"></div>
          </div>
          <div v-else class="flex flex-col">
            <span class="text-on-surface-variant text-label-sm uppercase tracking-wider">Seguidores</span>
            <span class="text-headline-md text-primary">{{ formatNumber(state.playlist?.followers?.total) }}</span>
          </div>
          <div v-if="!growthReady" class="flex flex-col gap-1">
            <div class="animate-pulse h-3 w-20 rounded bg-surface-container-high"></div>
            <div class="animate-pulse h-7 w-24 rounded bg-surface-container-high"></div>
          </div>
          <div v-else class="flex flex-col">
            <span class="text-on-surface-variant text-label-sm uppercase tracking-wider cursor-help" :title="growthHint">Crescimento ({{ details.growth.days }}d)</span>
            <span class="text-headline-md text-primary">{{ details.growth.value }}</span>
          </div>
          <div v-if="!slotsReady" class="flex flex-col gap-1">
            <div class="animate-pulse h-3 w-20 rounded bg-surface-container-high"></div>
            <div class="animate-pulse h-7 w-24 rounded bg-surface-container-high"></div>
          </div>
          <div v-else class="flex flex-col">
            <span class="text-on-surface-variant text-label-sm uppercase tracking-wider">Slots Ocupados</span>
            <span class="text-headline-md text-on-surface">{{ details.filledPositions }}/{{ details.totalPositions }}</span>
          </div>
          <div v-if="!slotsReady" class="flex flex-col gap-1">
            <div class="animate-pulse h-3 w-20 rounded bg-surface-container-high"></div>
            <div class="animate-pulse h-7 w-24 rounded bg-surface-container-high"></div>
          </div>
          <div v-else class="flex flex-col">
            <span class="text-on-surface-variant text-label-sm uppercase tracking-wider">Faturamento Mensal</span>
            <span class="text-headline-md text-on-surface">{{ details.monthlyRevenue }}</span>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-4 self-center md:self-end items-end">
        <div class="flex gap-2">
          <button
            class="w-12 h-12 bg-surface-container-high rounded-full text-on-surface hover:bg-surface-variant transition-colors flex items-center justify-center"
            @click="executeUserPlaylist(currentPlaying)"
          >
            <font-awesome-icon :icon="currentPlaying?.is_playing ? 'pause' : 'play'" />
          </button>
          <button
            class="bg-primary-container text-on-primary-container px-8 py-3 rounded-full text-headline-sm font-headline-sm flex items-center gap-3 hover:scale-105 transition-all shadow-lg hover:shadow-primary/20"
            @click="onSellPosition"
          >
            <font-awesome-icon icon="plus-circle" />
            Vender Nova Posição
          </button>
        </div>
        <div class="flex gap-2">
          <button class="p-3 bg-surface-container-high rounded-xl text-on-surface hover:bg-surface-variant transition-colors" title="Estatísticas" @click="onOpenStatistics">
            <font-awesome-icon icon="chart-bar" />
          </button>
          <button class="p-3 bg-surface-container-high rounded-xl text-on-surface hover:bg-surface-variant transition-colors" title="Compartilhar" @click="sharePlaylist">
            <font-awesome-icon icon="share" />
          </button>
          <button class="p-3 bg-surface-container-high rounded-xl text-on-surface hover:bg-surface-variant transition-colors" title="Mais opções" @click="openMenuPlaylist">
            <font-awesome-icon icon="ellipsis-v" />
          </button>
        </div>
      </div>
    </section>

    <!-- Table Section -->
    <section class="bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/10 shadow-xl">
      <div class="p-6 border-b border-outline-variant/10 flex flex-wrap items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-6">
          <span class="text-on-surface text-headline-sm">Gerenciamento de Músicas</span>
          <nav class="flex gap-2 flex-wrap">
            <button
              v-for="tab in ['Todas', 'Expira em breve', 'Pendentes']"
              :key="tab"
              class="px-4 py-1.5 rounded-full text-label-sm transition-colors"
              :class="activeTab === tab
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'hover:bg-surface-container-high text-on-surface-variant'"
              @click="activeTab = tab"
            >
              {{ tab }}
            </button>
          </nav>
        </div>
        <div class="flex items-center gap-4">
          <button
            class="flex items-center gap-2 rounded-full bg-surface-container-high px-4 py-1.5 text-label-sm text-on-surface-variant hover:text-on-surface transition-colors"
            :title="sortOptions[sortPosition]"
            @click="sortUserPlaylist()"
          >
            <font-awesome-icon icon="sort" />
            {{ sortOptions[sortPosition] }}
          </button>
          <div class="text-on-surface-variant text-body-sm italic">
            Última atualização: {{ lastUpdatedLabel }}
          </div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr class="bg-surface-container-low/50">
              <th class="px-6 py-4 text-label-sm text-on-surface-variant uppercase tracking-wider"># Pos</th>
              <th class="px-6 py-4 text-label-sm text-on-surface-variant uppercase tracking-wider">Música / Artista</th>
              <th class="px-6 py-4 text-label-sm text-on-surface-variant uppercase tracking-wider text-center">Entrada</th>
              <th class="px-6 py-4 text-label-sm text-on-surface-variant uppercase tracking-wider text-center">Expiração</th>
              <th class="px-6 py-4 text-label-sm text-on-surface-variant uppercase tracking-wider">Status</th>
              <th class="px-6 py-4 text-label-sm text-on-surface-variant uppercase tracking-wider">Valor</th>
              <th class="px-6 py-4 text-label-sm text-on-surface-variant uppercase tracking-wider text-center">Popularity</th>
              <th class="px-6 py-4 text-label-sm text-on-surface-variant uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/10">
            <tr
              v-for="(track, i) in pagedTracks"
              :key="track.track?.uri"
              class="hover:bg-surface-container-high/30 transition-colors group cursor-pointer"
              :class="{ 'opacity-40': track.track?.available_markets && !track.track.available_markets.includes('BR') }"
              @click="openTrackSlotModal(track)"
            >
              <td class="px-6 py-4">
                <div
                  class="w-8 h-8 rounded flex items-center justify-center text-label-md font-bold"
                  :class="track.id === 0 && activeTab === 'Todas'
                    ? 'bg-primary/20 border border-primary/40 text-primary'
                    : 'bg-surface-container-high text-on-surface-variant'"
                >
                  {{ track.id + 1 }}
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-4">
                  <img class="w-10 h-10 rounded-lg object-cover" :src="track.track?.album?.images?.[0]?.url" />
                  <div class="flex flex-col">
                    <span class="text-on-surface text-body-md" :class="{ 'text-primary': track.track?.uri === currentPlaying?.item?.uri }">
                      <font-awesome-icon v-if="track.track?.tracked" icon="heart" class="text-primary mr-1" />
                      {{ track.track?.name }}
                    </span>
                    <span class="text-on-surface-variant text-body-sm">{{ track.track?.artists?.map(artist => artist.name).join(', ') }}</span>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 text-center text-body-sm text-on-surface-variant">{{ formatDate(track.added_at) }}</td>
              <td class="px-6 py-4 text-center">
                <div v-if="!track._slot" class="flex flex-col items-center gap-1">
                  <div class="animate-pulse h-3 w-16 rounded bg-surface-container-high"></div>
                  <div class="animate-pulse h-2 w-10 rounded bg-surface-container-high"></div>
                </div>
                <div v-else class="flex flex-col items-center" :class="{ 'animate-pulse': expirationInfo(track._slot).urgent }">
                  <span class="text-label-md" :class="expirationInfo(track._slot).urgent ? 'text-error' : (track._slot?.status === 'pending' ? 'text-on-surface-variant' : 'text-primary')">
                    {{ expirationInfo(track._slot).value }}
                  </span>
                  <span class="text-[10px] uppercase" :class="expirationInfo(track._slot).urgent ? 'text-error' : 'text-on-surface-variant'">
                    {{ expirationInfo(track._slot).label }}
                  </span>
                </div>
              </td>
              <td class="px-6 py-4">
                <div v-if="!track._slot" class="animate-pulse h-5 w-16 rounded-full bg-surface-container-high"></div>
                <button
                  v-else-if="track._slot.status === 'free'"
                  class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/80 text-black"
                  @click.stop="openSellSlot(track)"
                >
                  Sell slot
                </button>
                <span v-else class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest" :class="statusPill(track._slot).cls">
                  {{ statusPill(track._slot).label }}
                </span>
              </td>
              <td class="px-6 py-4">
                <div v-if="!track._slot" class="animate-pulse h-4 w-14 rounded bg-surface-container-high"></div>
                <span v-else class="text-label-md text-on-surface">{{ track._slot?.value ?? '-' }}</span>
              </td>
              <td class="px-6 py-4">
                <div class="flex flex-col items-center gap-0.5">
                  <div class="flex items-center gap-1 text-label-md text-on-surface">
                    <font-awesome-icon icon="chart-line" :class="popularityIcon(track.track?.popularity)" />
                    {{ track.track?.popularity }}%
                  </div>
                  <div v-if="popularityDiff(track) !== 0" class="flex items-center gap-1" :class="popularityDiff(track) < 0 ? 'text-[#ff1717]' : 'text-[#75ff18]'">
                    <font-awesome-icon :icon="popularityDiff(track) < 0 ? 'arrow-down' : 'arrow-up'" />
                    {{ popularityDiff(track) }}
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center justify-end gap-2 bg-surface-container-low/50 p-1 rounded-lg" @click.stop>
                  <button class="p-2 hover:bg-primary/20 hover:text-primary rounded-lg transition-colors text-on-surface-variant" title="Editar Posição" @click="openMovePositionMenu(track, track.id)">
                    <font-awesome-icon icon="sort" />
                  </button>
                  <button class="p-2 hover:bg-error/20 hover:text-error rounded-lg transition-colors text-on-surface-variant" title="Remover" @click="removeInlineTrack(track)">
                    <font-awesome-icon icon="trash" />
                  </button>
                  <button class="p-2 hover:bg-secondary/20 hover:text-secondary rounded-lg transition-colors text-on-surface-variant" title="Ver Detalhes" @click="openTrackSlotModal(track)">
                    <font-awesome-icon icon="eye" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="isLoading && state.tracks.length === 0">
              <td colspan="8" class="px-6 py-10 text-center text-on-surface-variant text-body-sm">
                <div class="flex items-center justify-center gap-3">
                  <font-awesome-icon icon="spinner" spin class="text-primary" />
                  <span>Carregando músicas...</span>
                </div>
              </td>
            </tr>
            <tr v-else-if="pagedTracks.length === 0">
              <td colspan="8" class="px-6 py-10 text-center text-on-surface-variant text-body-sm">
                Nenhuma música nesta categoria.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="p-6 bg-surface-container-low flex items-center justify-between">
        <span class="text-body-sm text-on-surface-variant">
          <template v-if="!slotsReady">Mostrando {{ state.tracks.length }} músicas</template>
          <template v-else>Mostrando {{ state.tracks.length }} de {{ details.filledPositions }} posições ocupadas</template>
        </span>
        <div class="flex items-center gap-2">
          <button
            class="p-2 rounded-lg bg-surface-container-highest text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-colors"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            <font-awesome-icon icon="chevron-left" />
          </button>
          <span class="text-label-sm text-on-surface-variant px-2">{{ currentPage }} / {{ totalPages }}</span>
          <button
            class="p-2 rounded-lg bg-surface-container-highest text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-colors"
            :disabled="currentPage >= totalPages"
            @click="currentPage++"
          >
            <font-awesome-icon icon="chevron-right" />
          </button>
        </div>
      </div>
    </section>

    <!-- Side Insights / Analytics Grid -->
    <section class="grid grid-cols-1 md:grid-cols-3 gap-lg mt-4">
      <div class="bg-surface-container rounded-2xl p-6 border border-outline-variant/10">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-headline-sm text-on-surface">Audiência</h3>
          <font-awesome-icon icon="users" class="text-primary" />
        </div>
        <div class="space-y-4">
          <template v-for="item in audience" :key="item.label">
            <div class="flex justify-between items-center text-body-sm">
              <span class="text-on-surface-variant">{{ item.label }}</span>
              <span class="text-on-surface text-label-md">{{ item.value }}%</span>
            </div>
            <div class="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
              <div class="h-full rounded-full" :class="item.tone === 'primary' ? 'bg-primary' : 'bg-secondary'" :style="{ width: item.value + '%' }"></div>
            </div>
          </template>
        </div>
      </div>

      <div class="bg-surface-container rounded-2xl p-6 border border-outline-variant/10">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-headline-sm text-on-surface">Tags de Gênero</h3>
          <font-awesome-icon icon="tags" class="text-primary" />
        </div>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="genre in genres"
            :key="genre.genre"
            class="px-3 py-1 bg-surface-container-high rounded text-label-sm text-on-surface-variant"
          >
            {{ genre.genre }}
          </span>
          <span v-if="genres.length === 0" class="text-body-sm text-on-surface-variant">
            Nenhum gênero disponível ainda.
          </span>
        </div>
      </div>

      <div class="bg-surface-container rounded-2xl p-6 border border-outline-variant/10 relative overflow-hidden group">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-headline-sm text-on-surface">Auto-Curation</h3>
          <font-awesome-icon icon="magic" class="text-primary" />
        </div>
        <p class="text-body-sm text-on-surface-variant mb-4">
          A inteligência SONIC sugere novas músicas baseadas no perfil dos seus seguidores.
        </p>
        <button
          class="w-full py-2 bg-primary/10 text-primary rounded-xl text-label-sm font-bold hover:bg-primary/20 transition-colors"
          @click="onSellPosition"
        >
          Ver Sugestões AI
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
</style>
