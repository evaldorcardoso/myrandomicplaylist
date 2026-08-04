<script setup>
  import { onMounted, onUnmounted, computed, reactive, ref, inject, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useGeneral } from '@/support/spotifyApi'
  import { usePlaylistStore } from '@/stores/playlist'
  import { useUserStore } from '@/stores/user'
  import Notification from '@/components/Notification.vue'
  import SellSlotModal from '@/components/SellSlotModal.vue'
  import SlotManagementModal from '@/components/SlotManagementModal.vue'
  import ConfirmRemovePlaylistModal from '@/components/ConfirmRemovePlaylistModal.vue'
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
  const { updateTracksOfPlaylist, updatePlaylist, removeTracksOfPlaylist, getTracks } = useGeneral()
  const { updatePlaylistTotalTracks, savePlaylist, removeFromDatabase } = PlaylistService()
  const { getPlaylistDetails, getTrackSlot, getGrowth } = PlaylistDetailsService()
  const { getTrackRequests, getPricePositions, deleteTrackRequest } = TrackRequestService()

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

  const TABS = ['Todas', 'Expira em breve', 'Expiradas', 'Disponíveis', 'Pendentes']

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
    removeTrackStatistics
  } = pd

  const editPlaylistDescription = ref(false)
  const activeTab = ref('Todas')
  const currentPage = ref(1)
  const sortPosition = ref(0)
  const differentSort = ref(false)
  const isProcessing = ref(false)
  const lastUpdatedLabel = ref('')
  const countdownTimer = ref(null)
  const now = ref(Date.now())
  const countdownActive = ref(false)
  const trackRequests = ref([])
  const trackRequestsLoaded = ref(false)
  const pricePositions = ref(new Map())
  const isLoading = ref(true)
  const sellSlotOpened = ref(false)
  const sellSlotTrack = ref(null)
  const slotManagementOpened = ref(false)
  const slotManagementTrack = ref(null)
  const slotManagementRequest = ref(null)
  const confirmRemovePlaylistOpened = ref(false)
  const slotsVersion = ref(0)
  const bumpSlots = () => slotsVersion.value++

  const followersReady = computed(() => state.playlist?.followers != null)
  const growthReady = computed(() => state.dataLikes.length > 0)
  const slotsReady = computed(() =>
    trackRequestsLoaded.value && (state.tracks.length > 0 || !isLoading.value)
  )

  const currentUser = computed(() => userStore.getUser)
  const currentPlaying = computed(() => props.currentData)
  const playlistSaved = computed(() => state.playlist?.tracked ?? false)

  const availableTabs = computed(() => {
    if (!playlistSaved.value) return ['Todas']
    return TABS
  })

  const details = computed(() => {
    const trackIds = new Set(state.tracks.map(t => t.track?.id))
    const requests = trackRequests.value.filter(r => r.track_id && trackIds.has(r.track_id))
    const filledPositions = requests.length
    const monthlyRevenue = requests.reduce((sum, r) => sum + (r.value ?? 0), 0)
    return getPlaylistDetails(state.playlist ?? {}, state.tracks.length, filledPositions, monthlyRevenue, getGrowth(state.dataLikes, state.playlist?.followers?.total))
  })
  const growthHint = computed(() => {
    const days = details.growth?.days
    return `Crescimento dos seguidores comparado com a última estatística salva${days ? ` (${days} dias atrás)` : ''}.`
  })

  const positionMismatchCount = computed(() => {
    slotsVersion.value
    return state.tracks.filter(track => track._slot?.positionMismatch).length
  })

  const hasSoldSlots = computed(() => {
    slotsVersion.value
    return state.tracks.some(track => track._slot?.status && track._slot.status !== 'free')
  })

  const hasPriceValues = computed(() => pricePositions.value.size > 0)

  const tableColumns = computed(() => {
    const base = 5 + (hasSoldSlots.value ? 1 : 0) + ((hasSoldSlots.value || hasPriceValues.value) ? 1 : 0)
    return playlistSaved.value ? base : base - 1
  })

  const filteredTracks = computed(() => {
    slotsVersion.value
    if (activeTab.value === 'Expira em breve') {
      return state.tracks.filter(t =>
        t._slot?.dueTs != null &&
        t._slot.dueTs > now.value &&
        (t._slot.dueTs - now.value) <= 86400000
      )
    }
    if (activeTab.value === 'Expiradas') {
      return state.tracks.filter(t =>
        t._slot?.status &&
        t._slot.status !== 'free' &&
        t._slot.dueTs != null &&
        t._slot.dueTs <= now.value
      )
    }
    if (activeTab.value === 'Disponíveis') {
      return state.tracks.filter(t => t._slot?.status === 'free')
    }
    if (activeTab.value === 'Pendentes') {
      return state.tracks.filter(t => t._slot?.status === 'pending')
    }
    return state.tracks
  })

  const tabCounts = computed(() => {
    slotsVersion.value
    return {
      'Expira em breve': state.tracks.filter(t =>
        t._slot?.dueTs != null &&
        t._slot.dueTs > now.value &&
        (t._slot.dueTs - now.value) <= 86400000
      ).length,
      'Expiradas': state.tracks.filter(t =>
        t._slot?.status &&
        t._slot.status !== 'free' &&
        t._slot.dueTs != null &&
        t._slot.dueTs <= now.value
      ).length,
      'Pendentes': state.tracks.filter(t => t._slot?.status === 'pending').length
    }
  })

  const pendingTotalValue = computed(() => {
    slotsVersion.value
    const trackIds = new Set(state.tracks.map(t => t.track?.id))
    return trackRequests.value
      .filter(r => r.status === 'pending' && r.track_id && trackIds.has(r.track_id))
      .reduce((sum, r) => sum + (r.value ?? 0), 0)
  })

  const totalPages = computed(() => Math.max(1, Math.ceil(filteredTracks.value.length / PAGE_SIZE)))

  const pagedTracks = computed(() => {
    if (activeTab.value !== 'Todas') {
      return filteredTracks.value
    }
    const start = (currentPage.value - 1) * PAGE_SIZE
    return filteredTracks.value.slice(start, start + PAGE_SIZE)
  })

  watch(activeTab, () => {
    currentPage.value = 1
  })

  watch(playlistSaved, (saved) => {
    if (!saved) {
      activeTab.value = 'Todas'
    }
  })

  watch(
    () => playlistStore.playlistRevision[playlistId.value],
    async () => {
      if (!state.playlist || !playlistId.value) return
      try {
        await getPlaylistTracks()
        state.playlist.items = state.tracks.length
        await loadTrackRequests()
        if (sortPosition.value !== 0) sortUserPlaylist(false)
      } catch (error) {
        console.error(error)
      }
    }
  )

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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
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
    countdownActive.value = state.tracks.some(track => track._slot?.dueTs != null)
    bumpSlots()
  }

  const loadTrackRequests = async () => {
    trackRequests.value = await getTrackRequests(playlistId.value)
    trackRequestsLoaded.value = true
    const { data: priceRows } = await getPricePositions(playlistId.value)
    pricePositions.value = new Map((priceRows ?? []).map(row => [row.position, row.value]))
    buildSlots()
  }

  const slotValueLabel = (track) => {
    if (track._slot?.status && track._slot.status !== 'free') {
      return track._slot?.value ?? '-'
    }
    const value = pricePositions.value.get((track.id ?? 0) + 1)
    return value != null ? formatCurrency(value) : '-'
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
    if (slot.dueTs == null) {
      return { value: '--:--:--', label: 'Sem prazo', urgent: false }
    }
    const secondsLeft = Math.max(0, Math.floor((slot.dueTs - now.value) / 1000))
    const urgent = secondsLeft <= 86400
    if (secondsLeft <= 0) {
      return { value: 'Expirado', label: 'Vencido', urgent: true }
    }
    if (slot.status === 'pending') {
      return { value: Math.ceil(secondsLeft / 86400), label: 'Dias', urgent }
    }
    if (secondsLeft > 86400) {
      return {
        value: Math.ceil(secondsLeft / 86400),
        label: urgent ? 'Expirando' : 'Dias Restantes',
        urgent
      }
    }
    return {
      value: formatCountdown(secondsLeft),
      label: urgent ? 'Expirando' : 'Tempo Restante',
      urgent
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

  const handleSavePlaylist = async () => {
    notify({ title: 'Please, wait', text: 'Saving playlist...', type: 'info' })
    const result = await savePlaylist(state.playlist)
    if (!result) {
      notify({ title: 'Ops', text: 'It´s not possible to save the Playlist at this time.', type: 'error' })
      return
    }
    notify({ title: 'Alright', text: 'Playlist saved!', type: 'success' })
  }

  const confirmRemoveFromManagement = () => {
    confirmRemovePlaylistOpened.value = true
  }

  const closeRemoveFromManagement = () => {
    confirmRemovePlaylistOpened.value = false
  }

  const handleRemoveFromManagement = async () => {
    confirmRemovePlaylistOpened.value = false
    isProcessing.value = true
    try {
      const removed = await removeFromDatabase(playlistId.value)
      if (!removed) {
        notify({ title: 'Ops', text: 'Não foi possível remover a playlist do banco.', type: 'error' })
        return
      }
      playlistStore.remove(playlistId.value)
      notify({ title: 'Alright', text: 'Playlist removida da gestão!', type: 'success' })
      router.push('/')
    } catch (error) {
      console.error(error)
      notify({ title: 'Ops', text: 'Erro ao remover a playlist.', type: 'error' })
    } finally {
      isProcessing.value = false
    }
  }

  const onFixPositionMismatch = () => {
    notify({
      title: 'Em breve',
      text: 'Correção de posição estará disponível em breve!',
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

  const onRemoveTrack = async (value) => {
    playlistStore.removeTrack(playlistId.value, value)
    const trackFound = state.tracks.find(e => e.track.uri === value)?.track?.id
    if (trackFound) {
      removeTrackStatistics(trackFound)
    }
    await playlistStore.updateTracksPosition(playlistId.value)
    await getPlaylistTracks()
    state.playlist.items = state.tracks.length
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

  const findTrackRequest = (track) => {
    return trackRequests.value.find(r => r.track_id === track.track?.id) ?? null
  }

  const openTrackSlotModal = (track) => {
    slotManagementTrack.value = track
    slotManagementRequest.value = findTrackRequest(track)
    slotManagementOpened.value = true
  }

  const closeSlotManagement = () => {
    slotManagementOpened.value = false
    slotManagementTrack.value = null
    slotManagementRequest.value = null
  }

  const onSellSlotFromManagement = (track) => {
    closeSlotManagement()
    openSellSlot(track)
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

  const onSlotReplaceTrack = async ({ request, track, replacement }) => {
    closeSlotManagement()
    try {
      if (request?.id) {
        const { error } = await deleteTrackRequest(request.id)
        if (error) throw error
      }

      const targetUri = track?.track?.uri ?? track?.uri
      const replacementUri = replacement?.track?.uri ?? replacement?.uri

      let tracks = await playlistStore.getTracks(playlistId.value) ?? []
      if (tracks.length === 0) {
        playlistStore.loadTracks(playlistId.value, await getTracks(playlistId.value))
        tracks = await playlistStore.getTracks(playlistId.value)
      }

      const replacementTrack = tracks.find(t => (t.track?.uri ?? t.uri) === replacementUri)
      const removalTrack = tracks.find(t => (t.track?.uri ?? t.uri) === targetUri)

      if (!replacementTrack || !removalTrack) {
        notify({ title: 'Ops', text: 'Música não encontrada!', type: 'error' })
        return
      }

      const moveFormData = {
        'range_start': replacementTrack.id,
        'insert_before': removalTrack.id
      }
      await updateTracksOfPlaylist(playlistId.value, moveFormData)

      const updatedTracks = await getTracks(playlistId.value)
      const newRemovalTrack = updatedTracks.find(t => (t.track?.uri ?? t.uri) === targetUri)

      if (newRemovalTrack) {
        const removeFormData = {
          'tracks': [{ 'uri': targetUri }]
        }
        await removeTracksOfPlaylist(playlistId.value, removeFormData)
      }

      playlistStore.loadTracks(playlistId.value, await getTracks(playlistId.value))

      const trackFound = state.tracks.find(e => e.track.uri === targetUri)?.track?.id
      if (trackFound) {
        removeTrackStatistics(trackFound)
      }

      await getPlaylistTracks()
      state.playlist.items = state.tracks.length
      await updatePlaylistTotalTracks(playlistId.value, state.tracks.length)
      sortUserPlaylist(false)
      buildSlots()
      await reloadSlots()

      notify({
        title: 'Alright',
        text: 'Música substituída!',
        type: 'success'
      })
    } catch (error) {
      console.error(error)
      notify({
        title: 'Ops',
        text: 'Erro ao substituir a música!',
        type: 'error'
      })
    }
  }

  const onSlotMoveTrack = async ({ track, replacement }) => {
    closeSlotManagement()
    try {
      const sourcePos = track?.id ?? 0
      const targetPos = replacement?.id ?? 0

      if (sourcePos === targetPos) {
        notify({
          title: 'Ops',
          text: 'Mesma posição!',
          type: 'warn'
        })
        return
      }

      notify({
        title: 'Please, wait',
        text: 'Trocando posições...',
        type: 'info'
      })

      const lo = Math.min(sourcePos, targetPos)
      const hi = Math.max(sourcePos, targetPos)

      await updateTracksOfPlaylist(playlistId.value, {
        'range_start': hi,
        'insert_before': lo
      })
      await updateTracksOfPlaylist(playlistId.value, {
        'range_start': lo + 1,
        'insert_before': hi + 1
      })

      playlistStore.loadTracks(playlistId.value, await getTracks(playlistId.value))

      await getPlaylistTracks()
      state.playlist.items = state.tracks.length
      await updatePlaylistTotalTracks(playlistId.value, state.tracks.length)
      sortUserPlaylist(false)
      buildSlots()
      await reloadSlots()

      notify({
        title: 'Alright',
        text: 'Posições trocadas!',
        type: 'success'
      })
    } catch (error) {
      console.error(error)
      notify({
        title: 'Ops',
        text: 'Erro ao trocar as posições!',
        type: 'error'
      })
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
      lastUpdatedLabel.value = 'Hoje, ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
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
    countdownTimer.value = setInterval(() => {
      if (countdownActive.value) {
        now.value = Date.now()
      }
    }, 1000)
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
  <SellSlotModal
    :open="sellSlotOpened"
    :track="sellSlotTrack"
    :playlist-id="playlistId"
    :playlist="state.playlist"
    :price-position-value="sellSlotTrack ? pricePositions.get((sellSlotTrack.id ?? 0) + 1) ?? null : null"
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
    @replace-track="onSlotReplaceTrack"
    @move-track="onSlotMoveTrack"
    @sell-slot="onSellSlotFromManagement"
  />
  <ConfirmRemovePlaylistModal
    :open="confirmRemovePlaylistOpened"
    :playlist="state.playlist"
    :is-submitting="isProcessing"
    @close="closeRemoveFromManagement"
    @confirm="handleRemoveFromManagement"
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
          <div v-if="playlistSaved && !growthReady" class="flex flex-col gap-1">
            <div class="animate-pulse h-3 w-20 rounded bg-surface-container-high"></div>
            <div class="animate-pulse h-7 w-24 rounded bg-surface-container-high"></div>
          </div>
          <div v-if="playlistSaved && growthReady" class="flex flex-col">
            <span class="text-on-surface-variant text-label-sm uppercase tracking-wider cursor-help" :title="growthHint">Crescimento ({{ details.growth.days }}d)</span>
            <span class="text-headline-md" :class="details.growth.negative ? 'text-[#ff1717]' : 'text-primary'">{{ details.growth.value }}</span>
          </div>
          <div v-if="playlistSaved && !slotsReady" class="flex flex-col gap-1">
            <div class="animate-pulse h-3 w-20 rounded bg-surface-container-high"></div>
            <div class="animate-pulse h-7 w-24 rounded bg-surface-container-high"></div>
          </div>
          <div v-if="playlistSaved && slotsReady" class="flex flex-col">
            <span class="text-on-surface-variant text-label-sm uppercase tracking-wider">Slots Ocupados</span>
            <span class="text-headline-md text-on-surface">{{ details.filledPositions }}/{{ details.totalPositions }}</span>
          </div>
          <div v-if="playlistSaved && !slotsReady" class="flex flex-col gap-1">
            <div class="animate-pulse h-3 w-20 rounded bg-surface-container-high"></div>
            <div class="animate-pulse h-7 w-24 rounded bg-surface-container-high"></div>
          </div>
          <div v-if="playlistSaved && slotsReady" class="flex flex-col">
            <span class="text-on-surface-variant text-label-sm uppercase tracking-wider">Faturamento Mensal</span>
            <span class="text-headline-md text-on-surface">{{ details.monthlyRevenue }}</span>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-4 self-center md:self-end items-end">
        <div class="flex gap-2">
          <button
            class="w-12 h-12 bg-primary rounded-full text-on-primary hover:bg-primary-fixed hover:scale-105 transition-all flex items-center justify-center shadow-lg hover:shadow-primary/20"
            @click="executeUserPlaylist(currentPlaying)"
          >
            <font-awesome-icon :icon="currentPlaying?.is_playing ? 'pause' : 'play'" />
          </button>
        </div>
        <div class="flex gap-2">
          <button class="p-3 bg-surface-container-high rounded-xl text-on-surface hover:bg-surface-variant transition-colors" title="Estatísticas" @click="onOpenStatistics">
            <font-awesome-icon icon="chart-bar" />
          </button>
          <button class="p-3 bg-surface-container-high rounded-xl text-on-surface hover:bg-surface-variant transition-colors" title="Compartilhar" @click="sharePlaylist">
            <font-awesome-icon icon="share" />
          </button>
          <button
            class="p-3 bg-surface-container-high rounded-xl text-on-surface hover:bg-surface-variant transition-colors"
            :title="playlistSaved ? 'Update on Database' : 'Save'"
            @click="handleSavePlaylist"
          >
            <font-awesome-icon icon="save" />
          </button>
          <button
            v-if="playlistSaved"
            class="p-3 bg-surface-container-high rounded-xl text-on-surface hover:bg-error hover:text-on-error transition-colors"
            title="Remover da gestão"
            @click="confirmRemoveFromManagement"
          >
            <font-awesome-icon icon="trash" />
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
              v-for="tab in availableTabs"
              :key="tab"
              class="px-4 py-1.5 rounded-full text-label-sm transition-colors inline-flex items-center justify-center gap-1.5"
              :class="activeTab === tab
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'hover:bg-surface-container-high text-on-surface-variant'"
              @click="activeTab = tab"
            >
              {{ tab }}
              <span
                v-if="tabCounts[tab] > 0"
                class="inline-flex min-w-[20px] h-5 items-center justify-center rounded-full bg-primary/20 px-1.5 text-[10px] font-bold tabular-nums text-primary"
              >
                {{ tabCounts[tab] }}
              </span>
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
          <div class="flex items-center gap-4">
            <div class="text-on-surface-variant text-body-sm italic">
              Última atualização: {{ lastUpdatedLabel }}
            </div>
            <button
              class="flex items-center gap-1.5 text-primary hover:underline text-label-sm font-medium transition-colors"
              :disabled="isLoading"
              @click="handleRefresh"
            >
              <font-awesome-icon icon="sync" :spin="isLoading" />
              Atualizar do Spotify
            </button>
          </div>
        </div>
      </div>

      <div v-if="positionMismatchCount > 0" class="flex flex-wrap items-center justify-between gap-4 bg-tertiary-container/10 border-b border-tertiary-container/30 px-6 py-4">
        <div class="flex items-center gap-3 text-body-sm text-on-surface-variant">
          <font-awesome-icon icon="exclamation-triangle" class="text-tertiary text-[18px]" />
          <span>
            <strong class="text-tertiary">{{ positionMismatchCount }}</strong>
            {{ positionMismatchCount === 1 ? 'posição divergente' : 'posições divergentes' }} entre o Spotify e o registro de venda.
          </span>
        </div>
        <button
          class="flex items-center gap-2 rounded-full bg-tertiary-container/10 border border-tertiary-container/40 px-4 py-1.5 text-label-sm font-bold text-tertiary hover:bg-tertiary-container/20 transition-colors"
          @click="onFixPositionMismatch"
        >
          <font-awesome-icon icon="sync" />
          Corrigir
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr class="bg-surface-container-low/50">
              <th class="px-6 py-4 text-label-sm text-on-surface-variant uppercase tracking-wider"># Pos</th>
              <th class="px-6 py-4 text-label-sm text-on-surface-variant uppercase tracking-wider">Música / Artista</th>
              <th class="px-6 py-4 text-label-sm text-on-surface-variant uppercase tracking-wider text-center">Entrada</th>
              <th v-if="hasSoldSlots" class="px-6 py-4 text-label-sm text-on-surface-variant uppercase tracking-wider text-center">Expiração</th>
              <th v-if="playlistSaved" class="px-6 py-4 text-label-sm text-on-surface-variant uppercase tracking-wider">Status</th>
              <th v-if="hasSoldSlots || hasPriceValues" class="px-6 py-4 text-label-sm text-on-surface-variant uppercase tracking-wider">Valor</th>
              <th class="px-6 py-4 text-label-sm text-on-surface-variant uppercase tracking-wider text-center">Popularity</th>
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
                <div class="flex items-center gap-2">
                  <div
                    class="w-8 h-8 rounded flex items-center justify-center text-label-md font-bold"
                    :class="track.id === 0 && activeTab === 'Todas'
                      ? 'bg-primary/20 border border-primary/40 text-primary'
                      : 'bg-surface-container-high text-on-surface-variant'"
                  >
                    {{ track.id + 1 }}
                  </div>
                  <font-awesome-icon
                    v-if="track._slot?.positionMismatch"
                    icon="exclamation-triangle"
                    class="text-tertiary text-[16px]"
                    :title="`Spotify #${track._slot.expectedPosition} · registrado #${track._slot.storedPosition}`"
                  />
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
              <td v-if="hasSoldSlots" class="px-6 py-4 text-center">
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
              <td v-if="playlistSaved" class="px-6 py-4">
                <div v-if="!track._slot" class="animate-pulse h-5 w-16 rounded-full bg-surface-container-high"></div>
                <button
                  v-else-if="track._slot.status === 'free'"
                  class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/80 text-black"
                  @click.stop="openSellSlot(track)"
                >
                  DISPONÍVEL
                </button>
                <span v-else class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest" :class="statusPill(track._slot).cls">
                  {{ statusPill(track._slot).label }}
                </span>
              </td>
              <td v-if="hasSoldSlots || hasPriceValues" class="px-6 py-4">
                <div v-if="!track._slot" class="animate-pulse h-4 w-14 rounded bg-surface-container-high"></div>
                <span v-else class="text-label-md text-on-surface">{{ slotValueLabel(track) }}</span>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-1 text-label-md text-on-surface">
                  <font-awesome-icon icon="chart-line" :class="popularityIcon(track.track?.popularity)" />
                  {{ track.track?.popularity }}%
                  <span v-if="popularityDiff(track) !== 0" class="flex items-center gap-0" :class="popularityDiff(track) < 0 ? 'text-[#ff1717]' : 'text-[#75ff18]'">
                    (<font-awesome-icon :icon="popularityDiff(track) < 0 ? 'arrow-down' : 'arrow-up'" />{{ popularityDiff(track) }})
                  </span>
                </div>
              </td>
            </tr>
            <tr v-if="isLoading && state.tracks.length === 0">
              <td :colspan="tableColumns" class="px-6 py-10 text-center text-on-surface-variant text-body-sm">
                <div class="flex items-center justify-center gap-3">
                  <font-awesome-icon icon="spinner" spin class="text-primary" />
                  <span>Carregando músicas...</span>
                </div>
              </td>
            </tr>
            <tr v-else-if="pagedTracks.length === 0">
              <td :colspan="tableColumns" class="px-6 py-10 text-center text-on-surface-variant text-body-sm">
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
        <div v-if="activeTab === 'Pendentes'" class="flex items-center gap-2">
          <span class="text-body-sm text-on-surface-variant">Total pendente:</span>
          <span class="text-label-md font-bold text-secondary">{{ formatCurrency(pendingTotalValue) }}</span>
        </div>
        <div v-if="activeTab === 'Todas'" class="flex items-center gap-2">
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
  </div>
</template>

<style scoped>
</style>
