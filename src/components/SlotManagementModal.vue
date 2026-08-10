<script setup>
  import { ref, computed, watch, onBeforeUnmount, markRaw } from 'vue'
  import { notify } from "@kyvg/vue3-notification";
  import { TrackRequestService } from '@/services/TrackRequestService'
  import { useCuratorSuggestions } from '@/composables/useCuratorSuggestions'
  import { useGeneral, useProfile } from '@/support/spotifyApi'
  import { usePlaylistStore } from '@/stores/playlist'
  import { PlaylistService } from '@/services/PlaylistService'

  const PERMANENCE_DAYS = 30
  const DUE_DATE_DEADLINE_HOUR = 9
  const TIMEZONE_OFFSET = '-03:00'

  const emit = defineEmits(['close', 'updated', 'remove-track', 'replace-track', 'move-track', 'sell-slot', 'fix-spotify'])

  const props = defineProps({
    open: {
      type: Boolean,
      default: false
    },
    track: {
      type: Object,
      default: null
    },
    request: {
      type: Object,
      default: null
    },
    playlistId: {
      type: String,
      default: ''
    },
    playlist: {
      type: Object,
      default: null
    },
    selectPlaylist: {
      type: Boolean,
      default: false
    }
  })

  const { updateTrackRequest, deleteTrackRequest, getOrCreateRequester, getPricePosition, recordEarning, hasEarnings } = TrackRequestService()
  const { suggestions, loadSuggestions, trackCurator } = useCuratorSuggestions()
  const { getTracks } = useGeneral()
  const { executePlaylist } = useProfile()
  const playlistStore = usePlaylistStore()
  const { getGenres } = PlaylistService()

  const requesterName = ref('')
  const curator = ref('')
  const value = ref('')
  const dueDate = ref('')
  const isSubmitting = ref(false)
  const submitState = ref('idle')
  const removalOpen = ref(false)
  const removalMode = ref('')
  const searchQuery = ref('')
  const availableTracks = ref([])
  const selectedReplacement = ref(null)
  const tracksLoading = ref(false)
  const isLoading = ref(false)

  const isPending = computed(() => props.request?.status === 'pending')

  const isFree = computed(() => !props.request)

  const trackData = computed(() => props.track?.track ?? null)

  const duration = computed(() => {
    if (!trackData.value?.duration_ms) return '--:--'
    return new Date(trackData.value.duration_ms).toISOString().slice(14, 19)
  })

  const position = computed(() => (props.track?.id ?? 0) + 1)

  const positionMismatch = computed(() => props.track?._slot?.positionMismatch ?? false)

  const storedPosition = computed(() => props.track?._slot?.storedPosition ?? props.request?.position ?? null)

  const slotPositionPrice = ref(null)

  const formatPrice = (value) => {
    if (value == null) return '-'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const loadSlotPositionPrice = async () => {
    slotPositionPrice.value = null
    try {
      const { data: pricePosition } = await getPricePosition(props.playlistId, position.value)
      slotPositionPrice.value = pricePosition?.value ?? null
    } catch (error) {
      console.error(error)
      slotPositionPrice.value = null
    }
  }

  const releaseDate = computed(() => {
    const date = trackData.value?.album?.release_date
    if (!date) return '—'
    const [year, month, day] = date.split('-')
    const parts = []
    if (day) parts.push(day)
    if (month) parts.push(month)
    parts.push(year)
    return parts.join('/')
  })

  const trackGenres = ref([])

  const loadTrackGenres = async () => {
    try {
      trackGenres.value = await getGenres(trackData.value?.artists ?? []).catch(() => [])
    } catch (error) {
      console.error(error)
      trackGenres.value = []
    }
  }

  const filteredReplacementTracks = computed(() => {
    if (!searchQuery.value) return availableTracks.value
    const query = searchQuery.value.toLowerCase()
    return availableTracks.value.filter(track =>
      (track.track?.name ?? track.name).toLowerCase().includes(query) ||
      (track.track?.artists?.map(a => a.name).join(', ') ?? track.artists?.map(a => a.name).join(', ')).toLowerCase().includes(query)
    )
  })

  const daysLeft = computed(() => {
    if (!props.request?.due_date) return null
    const due = new Date(`${props.request.due_date}T${String(DUE_DATE_DEADLINE_HOUR).padStart(2, '0')}:00:00${TIMEZONE_OFFSET}`).getTime()
    return Math.max(0, Math.ceil((due - Date.now()) / (24 * 60 * 60 * 1000)))
  })

  const isExpired = computed(() => {
    if (isFree.value || isPending.value) return false
    if (!props.request?.due_date) return false
    const due = new Date(`${props.request.due_date}T${String(DUE_DATE_DEADLINE_HOUR).padStart(2, '0')}:00:00${TIMEZONE_OFFSET}`).getTime()
    return Date.now() >= due
  })

  const expiresLabel = computed(() => {
    if (daysLeft.value == null) return 'sem prazo'
    if (daysLeft.value <= 0) return 'hoje'
    return daysLeft.value === 1 ? 'em 1 dia' : `em ${daysLeft.value} dias`
  })

  const pad = (n) => String(n).padStart(2, '0')

  const calcDueDateISO = (days, from = null) => {
    const date = from ? new Date(`${from}T00:00:00`) : new Date()
    date.setDate(date.getDate() + days)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }

  const parseValue = () => {
    const raw = String(value.value ?? '').trim()
    if (raw === '') return NaN
    return parseFloat(raw.replace(/\./g, '').replace(',', '.'))
  }

  const resolveRequester = async () => {
    const trimmed = requesterName.value.trim()
    if (!trimmed) return null
    const { data: requester, error } = await getOrCreateRequester({
      name: trimmed,
      curator: curator.value.trim()
    })
    if (error) throw error
    return requester
  }

  const loadCuratorSuggestions = async () => {
    isLoading.value = true
    try {
      await loadSuggestions()
    } finally {
      isLoading.value = false
    }
  }

  const init = () => {
    requesterName.value = props.request?.requester_name ?? ''
    curator.value = props.request?.curator ?? ''
    value.value = props.request?.value != null
      ? Number(props.request.value).toFixed(2).replace('.', ',')
      : ''
    dueDate.value = props.request?.due_date ?? calcDueDateISO(PERMANENCE_DAYS)
    isSubmitting.value = false
    submitState.value = 'idle'
    resetRemoval()
    if (!curator.value) {
      loadCuratorSuggestions()
    }
    loadTrackGenres()
    loadSlotPositionPrice()
  }

  watch(() => props.open, (opened) => {
    if (opened) {
      init()
    }
  })

  const saveRequester = async () => {
    if (isSubmitting.value || !props.request) return
    if (!requesterName.value.trim()) return
    const nameChanged = requesterName.value.trim() !== (props.request.requester_name ?? '').trim()
    if (!nameChanged) return
    try {
      const requester = await resolveRequester()
      if (requester.id === props.request.requester_id) return
      const { error } = await updateTrackRequest(props.request.id, { requester_id: requester.id })
      if (error) throw error
      notify({
        title: 'Alright',
        text: 'Solicitante atualizado!',
        type: 'success'
      })
    } catch (error) {
      console.error(error)
      notify({
        title: 'Ops',
        text: 'Erro ao atualizar o solicitante!',
        type: 'error'
      })
    }
  }

  const selectCuratorSuggestion = (name) => {
    curator.value = name
    trackCurator(name)
  }

  const saveValue = async () => {
    if (isSubmitting.value || !props.request) return
    const parsed = parseValue()
    if (!Number.isFinite(parsed) || parsed <= 0) return
    if (parsed === props.request.value) return
    try {
      const { error } = await updateTrackRequest(props.request.id, { value: parsed })
      if (error) throw error
      notify({
        title: 'Alright',
        text: 'Valor atualizado!',
        type: 'success'
      })
    } catch (error) {
      console.error(error)
      notify({
        title: 'Ops',
        text: 'Erro ao atualizar o valor!',
        type: 'error'
      })
    }
  }

  const saveDueDate = async (due) => {
    if (isSubmitting.value || !props.request) return
    if (due === props.request.due_date) return
    try {
      const { error } = await updateTrackRequest(props.request.id, { due_date: due })
      if (error) throw error
      notify({
        title: 'Alright',
        text: 'Vencimento atualizado!',
        type: 'success'
      })
    } catch (error) {
      console.error(error)
      notify({
        title: 'Ops',
        text: 'Erro ao atualizar o vencimento!',
        type: 'error'
      })
    }
  }

  const onDueChange = () => {
    saveDueDate(dueDate.value)
  }

  const close = () => {
    if (isSubmitting.value) return
    resetRemoval()
    emit('close')
  }

  const primaryAction = async () => {
    if (isSubmitting.value || !props.request) return
    isSubmitting.value = true
    submitState.value = 'idle'
    try {
      let requesterId = props.request?.requester_id ?? null
      if (requesterName.value.trim() !== (props.request.requester_name ?? '').trim()) {
        const requester = await resolveRequester()
        if (requester) requesterId = requester.id
      }
      const parsedValue = parseValue()
      const payload = {
        requester_id: requesterId
      }
      if (Number.isFinite(parsedValue) && parsedValue > 0) {
        payload.value = parsedValue
      }

      if (isPending.value) {
        if (dueDate.value) payload.due_date = dueDate.value
        payload.status = 'paid'
        const { error } = await updateTrackRequest(props.request.id, payload)
        if (error) throw error
        const currentAmount = Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : props.request?.value ?? null
        const ledgerType = await hasEarnings(props.request.id) ? 'renewal' : 'new'
        const { error: ledgerError } = await recordEarning({
          track_request_id: props.request.id,
          playlist_id: props.request?.playlist_id ?? props.playlistId,
          playlist_name: props.playlist?.name ?? null,
          track_id: props.request?.track_id ?? trackData.value?.id ?? null,
          track_name: props.request?.name ?? trackData.value?.name ?? null,
          requester_name: requesterName.value.trim() || (props.request?.requester_name ?? null),
          curator: curator.value.trim() || (props.request?.curator ?? null),
          amount: currentAmount,
          type: ledgerType
        })
        if (ledgerError) console.error(ledgerError.message)
        submitState.value = 'success'
        emit('updated', 'paid')
      } else {
        payload.due_date = calcDueDateISO(PERMANENCE_DAYS, props.request.due_date)
        payload.status = 'pending'
        const { error } = await updateTrackRequest(props.request.id, payload)
        if (error) throw error
        submitState.value = 'success'
        emit('updated', 'renewed')
      }

      setTimeout(() => emit('close'), 400)
    } catch (error) {
      console.error(error)
      notify({
        title: 'Ops',
        text: 'Não foi possível concluir a ação!',
        type: 'error'
      })
    } finally {
      isSubmitting.value = false
    }
  }

  const makeFree = async () => {
    if (isSubmitting.value || !props.request) return
    isSubmitting.value = true
    try {
      const { error } = await deleteTrackRequest(props.request.id)
      if (error) throw error
      emit('updated', 'made-free')
      emit('close')
    } catch (error) {
      console.error(error)
      notify({
        title: 'Ops',
        text: 'Não foi possível liberar a posição!',
        type: 'error'
      })
    } finally {
      isSubmitting.value = false
    }
  }

  const loadReplacementTracks = async () => {
    if (availableTracks.value.length > 0) return
    tracksLoading.value = true
    try {
      const playlistId = props.playlistId
      let tracks = await playlistStore.getTracks(playlistId)
      if (!tracks || tracks.length === 0) {
        tracks = await getTracks(playlistId)
        playlistStore.loadTracks(playlistId, tracks)
        tracks = await playlistStore.getTracks(playlistId)
      }
      const targetUri = props.track?.track?.uri ?? props.track?.uri
      availableTracks.value = (tracks ?? []).filter(
        t => (t.track?.uri ?? t.uri) !== targetUri
      ).map(track => markRaw(track))
    } catch (error) {
      console.error(error)
    } finally {
      tracksLoading.value = false
    }
  }

  const resetRemoval = () => {
    removalOpen.value = false
    removalMode.value = ''
    searchQuery.value = ''
    selectedReplacement.value = null
    availableTracks.value = []
  }

  const onRemoveTrack = () => {
    if (isSubmitting.value) return
    removalOpen.value = true
  }

  const onMoveTrack = () => {
    if (isSubmitting.value) return
    removalOpen.value = true
    removalMode.value = 'move'
    selectedReplacement.value = null
    loadReplacementTracks()
  }

  const chooseRemove = () => {
    doRemove()
  }

  const chooseReplace = async () => {
    removalMode.value = 'replace'
    selectedReplacement.value = null
    await loadReplacementTracks()
  }

  const selectReplacement = (track) => {
    selectedReplacement.value = track
  }

  const cancelRemoval = () => {
    resetRemoval()
  }

  const doRemove = () => {
    emit('remove-track', { request: props.request, track: props.track })
    emit('close')
  }

  const confirmAction = () => {
    if (!selectedReplacement.value) return
    const payload = {
      request: props.request,
      track: props.track,
      replacement: selectedReplacement.value
    }
    if (removalMode.value === 'move') {
      emit('move-track', payload)
    } else {
      emit('replace-track', payload)
    }
    emit('close')
  }

  const onSellSlot = () => {
    emit('sell-slot', props.track)
  }

  const fixSlotPosition = async () => {
    if (isSubmitting.value || !props.request) return
    isSubmitting.value = true
    try {
      const payload = { position: position.value }
      if (slotPositionPrice.value != null && slotPositionPrice.value !== props.request.value) {
        payload.value = slotPositionPrice.value
      }
      const { error } = await updateTrackRequest(props.request.id, payload)
      if (error) throw error
      notify({
        title: 'Alright',
        text: 'Posição do slot atualizada!',
        type: 'success'
      })
      emit('updated', 'position-fixed')
      emit('close')
    } catch (error) {
      console.error(error)
      notify({
        title: 'Ops',
        text: 'Não foi possível atualizar a posição do slot!',
        type: 'error'
      })
    } finally {
      isSubmitting.value = false
    }
  }

  const fixSpotifyPosition = () => {
    if (isSubmitting.value || !props.request) return
    emit('fix-spotify', { track: props.track, request: props.request })
    emit('close')
  }

  const formatDueDateBR = (date) => {
    if (!date) return ''
    const [year, month, day] = String(date).split('-')
    if (!year || !month || !day) return date
    return `${day}/${month}/${year}`
  }

  const notifyRequester = async () => {
    if (isSubmitting.value) return
    const trackName = trackData.value?.name ?? ''
    const artistName = trackData.value?.artists?.map(artist => artist.name).join(', ') ?? ''
    const curatorName = props.request?.curator?.trim() ?? ''
    const artistLabel = curatorName ? `${artistName} by ${curatorName}` : artistName
    const playlistName = props.playlist?.name ?? ''
    const dueDateBR = formatDueDateBR(props.request?.due_date)
    const message = `Música vencendo na playlist: A música *${trackName}* do artista *${artistLabel}*, posição *${position.value}* na playlist ${playlistName}, vence no dia *${dueDateBR}*. Avise caso queira renovar, senão será *removida* em até *3 dias*.`
    try {
      await navigator.clipboard.writeText(message)
      notify({
        title: 'Alright',
        text: 'Mensagem copiada! Cole no WhatsApp do solicitante.',
        type: 'success'
      })
    } catch (error) {
      console.error(error)
      notify({
        title: 'Ops',
        text: 'Não foi possível copiar a mensagem!',
        type: 'error'
      })
    }
  }

  const playTrack = async () => {
    const uri = trackData.value?.uri
    if (!uri) return
    try {
      const { status } = await executePlaylist({ uris: [uri] })
      if (status !== 204) {
        notify({ title: 'Ops', text: 'Nenhum dispositivo Spotify ativo!', type: 'error' })
      }
    } catch (error) {
      console.error(error)
      notify({ title: 'Ops', text: 'Não foi possível tocar a música!', type: 'error' })
    }
  }

  onBeforeUnmount(() => {
    resetRemoval()
  })
</script>

<template>
  <transition name="modal-fade">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
      <div class="absolute inset-0 bg-black/70" @click="close"></div>
      <div class="relative w-full max-w-4xl bg-surface-container-lowest border border-outline-variant/20 rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col md:flex-row max-h-[90vh] overflow-y-auto md:overflow-y-visible">
        <!-- Left Panel: Track Context -->
        <div class="w-full md:w-5/12 bg-surface-container-low p-8 md:p-10 flex flex-col items-center justify-center gap-8 border-b md:border-b-0 md:border-r border-outline-variant/10">
          <div class="flex flex-col items-center gap-1">
            <span class="text-label-sm text-on-surface-variant uppercase tracking-wider">Posição</span>
            <span class="w-20 h-20 flex items-center justify-center rounded-full bg-primary/10 border-2 border-primary/40 text-display-lg text-primary font-bold leading-none shadow-xl">{{ position }}</span>
            <div v-if="positionMismatch" class="flex flex-col items-center gap-1 mt-2">
              <span class="text-label-sm text-[#ff1717] uppercase tracking-wider">Posição no slot</span>
              <span class="text-body-lg text-[#ff1717] font-bold">{{ storedPosition }}</span>
            </div>
          </div>
          <div class="relative group">
            <div class="absolute -inset-4 bg-primary/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div class="relative w-52 h-52 md:w-64 md:h-64 rounded-full border-8 border-surface-container-highest shadow-2xl overflow-hidden animate-[spin_20s_linear_infinite]">
              <img class="w-full h-full object-cover" :src="trackData?.album?.images?.[0]?.url" />
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="w-12 h-12 bg-surface-container-lowest rounded-full border-4 border-surface-container-high flex items-center justify-center">
                  <div class="w-2 h-2 bg-primary rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="text-center space-y-2">
            <h2 class="text-headline-lg text-on-surface">{{ trackData?.name }}</h2>
            <p class="text-body-lg text-primary">{{ trackData?.artists?.map(artist => artist.name).join(', ') }}</p>
            <div class="flex items-center justify-center gap-3 mt-4">
              <span
                class="text-label-sm px-3 py-1 rounded-full font-bold"
                :class="isFree
                  ? 'bg-surface-container-highest text-on-surface-variant'
                  : isPending
                    ? 'bg-tertiary-container/10 border border-tertiary-container/30 text-tertiary-container'
                    : isExpired
                      ? 'bg-[#ff1717]/10 border border-[#ff1717]/30 text-[#ff1717]'
                      : 'bg-primary/10 border border-primary/30 text-primary'"
              >
                {{ isFree ? 'LIVRE' : (isPending ? 'PENDENTE' : (isExpired ? 'EXPIRADA' : 'PAGA')) }}
              </span>
              <span class="text-label-sm px-3 py-1 bg-surface-container-highest rounded-full text-on-surface-variant">{{ duration }}</span>
            </div>
            <div class="mt-4 flex flex-col items-center gap-1">
              <p class="text-label-sm text-on-surface-variant">{{ releaseDate }}</p>
              <div class="flex items-center gap-2">
                <font-awesome-icon icon="chart-line" class="text-primary text-sm" />
                <span class="text-label-sm text-primary uppercase tracking-widest">Popularidade: {{ trackData?.popularity }}/100</span>
              </div>
              <div v-if="trackGenres.length" class="flex items-center gap-1 opacity-60">
                <font-awesome-icon icon="music" class="text-sm" />
                <span class="text-label-sm">{{ trackGenres.slice(0, 3).map(genre => genre.genre).join(', ') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Panel: Management Form -->
        <div class="w-full md:w-7/12 p-8 md:p-10 flex flex-col gap-7">
          <div class="flex justify-between items-start">
            <div class="space-y-1">
              <h3 class="text-headline-md text-on-surface">{{ isFree ? 'Gestão de posição' : 'Gestão de Posição Paga' }}</h3>
            </div>
            <button class="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant" title="Fechar" @click="close">
              <font-awesome-icon icon="times" />
            </button>
          </div>

          <div class="grid grid-cols-1 gap-6">
            <!-- Playlist Selection -->
            <div class="space-y-3">
              <label class="text-label-md text-primary uppercase tracking-wider">Playlist Alvo</label>
              <div v-if="selectPlaylist" class="relative">
                <select
                  :value="playlistId"
                  class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface appearance-none focus:outline-none focus:border-primary transition-all cursor-pointer"
                >
                  <option :value="playlistId">{{ playlist?.name ?? 'Playlist atual' }}</option>
                </select>
                <font-awesome-icon icon="chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[14px]" />
              </div>
              <div v-else class="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-5 py-2 text-body-md text-on-surface-variant">
                {{ playlist?.name ?? 'Playlist atual' }}
              </div>
            </div>

            <!-- Requester + Curator -->
            <div v-if="!isFree" class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-3">
                <label class="text-label-md text-primary uppercase tracking-wider">Solicitante</label>
                <input
                  v-model="requesterName"
                  type="text"
                  placeholder="Nome do solicitante"
                  class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
                  @blur="saveRequester"
                />
              </div>
              <div class="space-y-3">
                <label class="text-label-md text-primary uppercase tracking-wider">Curator</label>
                <div v-if="isLoading" class="animate-pulse h-10 w-full rounded-xl bg-surface-container-high"></div>
                <template v-else>
                  <input
                    v-model="curator"
                    type="text"
                    placeholder="Nome do curator"
                    class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
                    @blur="saveRequester"
                  />
                  <div v-if="!curator && suggestions.length" class="flex flex-wrap gap-2">
                    <span
                      v-for="name in suggestions"
                      :key="name"
                      class="px-3 py-1 bg-primary text-on-primary border border-primary/40 rounded-full text-label-sm cursor-pointer hover:bg-primary-fixed transition-colors"
                      @click="selectCuratorSuggestion(name)"
                    >
                      {{ name }}
                    </span>
                  </div>
                </template>
              </div>
            </div>

            <!-- Permanence + Value + Due date -->
            <div v-if="!isFree" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-3">
                <label class="text-label-md text-primary uppercase tracking-wider">Valor (R$)</label>
                <input
                  v-model="value"
                  type="text"
                  inputmode="decimal"
                  placeholder="0,00"
                  class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
                  @blur="saveValue"
                />
              </div>
              <div class="space-y-3">
                <label class="text-label-md text-primary uppercase tracking-wider">Vencimento</label>
                <div class="relative">
                  <input
                    v-model="dueDate"
                    type="date"
                    class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
                    @change="onDueChange"
                  />
                  <font-awesome-icon icon="calendar-alt" class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]" />
                </div>
              </div>
            </div>
          </div>

          <!-- Logic Card -->
          <div
            v-if="!isFree"
            class="p-2 rounded-xl space-y-3"
            :class="positionMismatch
              ? 'bg-[#ff1717]/5 border-l-4 border-[#ff1717]'
              : isPending
                ? 'bg-tertiary-container/5 border-l-4 border-tertiary-container'
                : 'bg-primary/5 border-l-4 border-primary'"
          >
            <div class="flex items-center gap-2" :class="positionMismatch ? 'text-[#ff1717]' : (isPending ? 'text-tertiary-container' : 'text-primary')">
              <font-awesome-icon :icon="positionMismatch ? 'exclamation-triangle' : (isPending ? 'hourglass' : 'clock')" class="text-[20px]" />
              <span class="text-label-md font-bold uppercase tracking-tight">Status da Posição</span>
            </div>
            <p class="text-body-sm text-on-surface-variant leading-relaxed">
              <template v-if="positionMismatch">
                Posição divergente entre o Spotify e o registro de venda. O slot está registrado na posição <strong class="text-[#ff1717]">#{{ storedPosition }}</strong> mas a música está na <strong class="text-[#ff1717]">#{{ position }}</strong> no Spotify.
              </template>
              <template v-else-if="isPending">
                Esta posição está aguardando pagamento. Realize o pagamento para confirmar sua permanência.
              </template>
              <template v-else-if="isExpired">
                Esta posição está <strong class="text-tertiary">expirada</strong>. Renove agora para garantir a permanência na grade.
              </template>
              <template v-else>
                Esta posição está ativa e expira <strong class="text-primary">{{ expiresLabel }}</strong>. Renove agora para garantir a permanência na grade.
              </template>
            </p>
          </div>

          <!-- Removal Options -->
          <div v-if="removalOpen" class="space-y-4">
            <div>
              <h3 class="text-headline-sm text-on-surface">{{ removalMode === 'move' ? 'Editar Posição' : 'Remover da Playlist' }}</h3>
              <p class="text-body-sm text-on-surface-variant">{{ removalMode === 'move' ? 'Escolha a música da grade para trocar de posição com esta.' : 'Deseja apenas remover esta música ou substituí-la por outra da grade?' }}</p>
            </div>

            <div v-if="removalMode !== 'move'" class="grid grid-cols-2 gap-4">
              <button
                class="flex flex-col items-center justify-center p-6 rounded-xl border border-outline-variant/30 bg-surface-container-high/40 hover:border-primary/60 transition-all group"
                @click="chooseRemove"
              >
                <font-awesome-icon icon="trash" class="text-3xl mb-2 text-on-surface-variant group-hover:text-primary" />
                <span class="text-label-md text-on-surface">Apenas Remover</span>
              </button>
              <button
                class="flex flex-col items-center justify-center p-6 rounded-xl border-2 bg-primary/5 transition-all group"
                :class="removalMode === 'replace' ? 'border-primary' : 'border-outline-variant/30 hover:border-primary/60'"
                @click="chooseReplace"
              >
                <font-awesome-icon icon="exchange-alt" :class="removalMode === 'replace' ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'" class="text-3xl mb-2" />
                <span :class="removalMode === 'replace' ? 'text-primary' : 'text-on-surface'" class="text-label-md">Substituir por outra</span>
              </button>
            </div>

            <div v-if="removalMode === 'replace' || removalMode === 'move'" class="space-y-4">
              <div class="relative">
                <font-awesome-icon icon="search" class="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px] pointer-events-none" />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Buscar música na playlist..."
                  class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl py-3 pl-12 pr-4 text-body-sm text-on-surface focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <div v-if="tracksLoading" class="space-y-2">
                <div v-for="n in 4" :key="n" class="animate-pulse h-12 rounded-lg bg-surface-container-high"></div>
              </div>
              <div v-else class="space-y-2 max-h-48 overflow-y-auto pr-2">
                <div
                  v-for="track in filteredReplacementTracks"
                  :key="track.track?.uri ?? track.uri"
                  class="flex items-center justify-between p-3 rounded-lg bg-surface-container-highest/50 border border-outline-variant/10 hover:bg-surface-container-highest transition-colors cursor-pointer"
                  @click="selectReplacement(track)"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <span class="text-label-sm text-primary">{{ String((track.id ?? 0) + 1).padStart(2, '0') }}</span>
                    <div class="flex flex-col min-w-0">
                      <span class="text-body-sm font-bold text-on-surface truncate">{{ track.track?.name ?? track.name }}</span>
                      <span class="text-[10px] text-on-surface-variant truncate">{{ track.track?.artists?.map(a => a.name).join(', ') ?? track.artists?.map(a => a.name).join(', ') }}</span>
                    </div>
                  </div>
                  <font-awesome-icon
                    :icon="selectedReplacement === track ? 'check-circle' : 'circle'"
                    :class="selectedReplacement === track ? 'text-primary' : 'text-on-surface-variant'"
                    class="flex-shrink-0"
                  />
                </div>
                <p v-if="filteredReplacementTracks.length === 0" class="text-center text-body-sm text-on-surface-variant py-4">
                  Nenhuma música encontrada.
                </p>
              </div>
            </div>

            <div v-if="removalMode === 'replace' || removalMode === 'move'" class="flex flex-col gap-3">
              <button
                class="w-full bg-primary hover:bg-primary-fixed text-on-primary text-headline-sm py-3 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                :disabled="!selectedReplacement"
                @click="confirmAction"
              >
                <font-awesome-icon icon="check-circle" class="text-[20px]" />
                <span>{{ removalMode === 'move' ? 'Trocar Posições' : 'Confirmar Mudança' }}</span>
              </button>
              <button
                class="w-full border border-outline-variant/30 hover:bg-surface-container-high text-on-surface-variant text-label-md py-3 rounded-xl transition-all"
                @click="cancelRemoval"
              >
                Cancelar
              </button>
            </div>
          </div>

          <!-- Action Buttons -->
          <div v-else class="flex flex-col gap-3">
            <button
              v-if="isFree"
              class="group relative w-full bg-primary hover:bg-primary-fixed text-on-primary text-headline-sm py-3 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              :disabled="isSubmitting"
              @click="onSellSlot"
            >
              <div class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <font-awesome-icon icon="bolt" class="relative z-10" />
              <span class="relative z-10">Vender slot</span>
            </button>
            <button
              v-if="!isFree && !positionMismatch"
              class="group relative w-full text-headline-sm py-2 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              :class="isPending
                ? 'bg-primary hover:bg-primary-fixed text-on-primary'
                : 'bg-primary hover:bg-primary-fixed text-on-primary'"
              :disabled="isSubmitting"
              @click="primaryAction"
            >
              <div class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <font-awesome-icon v-if="submitState === 'success'" icon="check-circle" class="relative z-10" />
              <font-awesome-icon v-else-if="isSubmitting" icon="sync" spin class="relative z-10" />
              <font-awesome-icon v-else :icon="isPending ? 'dollar-sign' : 'sync'" class="relative z-10" />
              <span class="relative z-10">
                {{ submitState === 'success' ? 'Concluído!' : (isSubmitting ? 'Processando...' : (isPending ? 'Realizar Pagamento' : 'Renovar Posição')) }}
              </span>
            </button>
            <button
              v-if="!isFree && isExpired"
              class="w-full border border-primary/30 hover:border-primary/60 hover:text-primary text-on-surface-variant text-label-md py-2 rounded-xl flex items-center justify-center gap-2 transition-all"
              :disabled="isSubmitting"
              @click="notifyRequester"
            >
              <font-awesome-icon :icon="['fab', 'whatsapp']" class="text-[18px]" />
              <span>Notificar solicitante</span>
            </button>
            <button
              v-if="!isFree && !positionMismatch"
              class="w-full border border-primary/30 hover:border-primary/60 hover:text-primary text-on-surface-variant text-label-md py-2 rounded-xl flex items-center justify-center gap-2 transition-all"
              :disabled="isSubmitting"
              @click="makeFree"
            >
              <font-awesome-icon icon="heart" class="text-[18px]" />
              <span>Tornar Gratuita</span>
            </button>
            <template v-if="!isFree && positionMismatch">
              <button
                class="w-full border border-[#ff1717]/50 hover:border-[#ff1717] hover:text-[#ff1717] text-on-surface-variant text-label-md py-2 rounded-xl flex items-center justify-center gap-2 transition-all"
                :disabled="isSubmitting"
                @click="fixSlotPosition"
              >
                <font-awesome-icon icon="database" class="text-[18px]" />
                <span>Manter posição (atualizar slot {{ formatPrice(props.request?.value) }} → {{ formatPrice(slotPositionPrice) }})</span>
              </button>
              <button
                class="w-full border border-primary/30 hover:border-primary/60 hover:text-primary text-on-surface-variant text-label-md py-2 rounded-xl flex items-center justify-center gap-2 transition-all"
                :disabled="isSubmitting"
                @click="fixSpotifyPosition"
              >
                <font-awesome-icon icon="exchange-alt" class="text-[18px]" />
                <span>Manter slot (atualizar spotify)</span>
              </button>
            </template>
            <button
              class="w-full border border-primary/30 hover:border-primary/60 hover:text-primary text-on-surface-variant text-label-md py-2 rounded-xl flex items-center justify-center gap-2 transition-all"
              :disabled="isSubmitting"
              @click="playTrack"
            >
              <font-awesome-icon icon="play-circle" class="text-[18px]" />
              <span>Reproduzir agora</span>
            </button>
            <button
              class="w-full border border-primary/30 hover:border-primary/60 hover:text-primary text-on-surface-variant text-label-md py-2 rounded-xl flex items-center justify-center gap-2 transition-all"
              :disabled="isSubmitting"
              @click="onMoveTrack"
            >
              <font-awesome-icon icon="exchange-alt" class="text-[18px]" />
              <span>Editar Posição</span>
            </button>
            <button
              class="w-full border border-outline-variant/30 hover:border-tertiary/50 hover:text-tertiary text-on-surface-variant text-label-md py-2 rounded-xl flex items-center justify-center gap-2 transition-all"
              :disabled="isSubmitting"
              @click="onRemoveTrack"
            >
              <font-awesome-icon icon="trash" class="text-[18px]" />
              <span>Remover da Playlist</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped lang="scss">
  .modal-fade-enter-active,
  .modal-fade-leave-active {
    transition: opacity 0.25s ease;
  }
  .modal-fade-enter-from,
  .modal-fade-leave-to {
    opacity: 0;
  }
</style>
