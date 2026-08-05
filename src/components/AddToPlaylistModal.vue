<script setup>
  import { ref, computed, watch, markRaw } from 'vue'
  import { useGeneral } from '@/support/spotifyApi'
  import { usePlaylistStore } from '@/stores/playlist'
  import { useUserStore } from '@/stores/user'
  import { PlaylistService } from '@/services/PlaylistService'
  import { TrackRequestService } from '@/services/TrackRequestService'
  import { getCompatiblePlaylists } from '@/support/playlistCompatibility'
  import { supabase } from '@/support/supabaseClient'

  const emit = defineEmits(['close', 'added', 'sell-slot'])

  const props = defineProps({
    open: {
      type: Boolean,
      default: false
    },
    track: {
      type: Object,
      default: null
    }
  })

  const { addTracksToPlaylist, getTracks, updateTracksOfPlaylist } = useGeneral()
  const playlistStore = usePlaylistStore()
  const userStore = useUserStore()
  const { loadAllFromDatabase, getGenres, updatePlaylistTotalTracks } = PlaylistService()
  const { getTrackRequests, getPricePositions } = TrackRequestService()

  const mode = ref('organic')
  const playlists = ref([])
  const selectedPlaylistId = ref('')
  const position = ref('')
  const playlistTracks = ref([])
  const trackGenres = ref([])
  const pendingRelocation = ref(null)
  const isLoading = ref(false)
  const isSubmitting = ref(false)
  const submitState = ref('idle')
  const errorMessage = ref('')
  const soldPositions = ref(new Set())
  const pricePositions = ref([])
  const priceRangeValues = computed(() => [...pricePositions.value].sort((a, b) => a.min_position - b.min_position))

  const getPriceByPosition = (position) => {
    for (const range of priceRangeValues.value) {
      if (position >= range.min_position && position <= range.max_position) {
        return range.value
      }
    }
    return null
  }

  const duration = computed(() => {
    if (!trackData.value?.duration_ms) return '--:--'
    return new Date(trackData.value.duration_ms).toISOString().slice(14, 19)
  })

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

  const isTracked = computed(() => {
    return !!userStore.getTrack(trackData.value?.id)
  })

  const selectedPlaylist = computed(() => {
    return playlists.value.find(playlist => playlist.id === selectedPlaylistId.value) ?? null
  })

  const positions = computed(() => {
    const total = playlistTracks.value.length
    return Array.from({ length: total }, (_, index) => {
      const pos = index + 1
      let label = `#${String(pos).padStart(2, '0')}`
      if (soldPositions.value.has(pos)) {
        label += ' (Vendida)'
      } else {
        const price = getPriceByPosition(pos)
        label += price != null ? ` (Disponível por ${formatCurrency(price)})` : ' (Disponível)'
      }
      return { pos, label }
    })
  })

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const occupiedTrack = computed(() => {
    if (!position.value) return null
    const index = parseInt(position.value) - 1
    const track = playlistTracks.value[index]
    if (!track) return null
    return {
      name: track.track?.name ?? track.name,
      artist: track.track?.artists?.map(a => a.name).join(', ') ?? track.artists?.map(a => a.name).join(', '),
      image: track.track?.album?.images[0]?.url ?? track.album?.images[0]?.url,
      uri: track.track?.uri ?? track.uri,
      position: parseInt(position.value)
    }
  })

  const reset = () => {
    mode.value = 'organic'
    playlists.value = []
    selectedPlaylistId.value = ''
    position.value = ''
    playlistTracks.value = []
    trackGenres.value = []
    pendingRelocation.value = null
    isSubmitting.value = false
    submitState.value = 'idle'
    errorMessage.value = ''
    soldPositions.value = new Set()
    pricePositions.value = new Map()
  }

  const loadPlaylistTracks = async (playlistId) => {
    let tracks = await playlistStore.getTracks(playlistId)
    if (tracks.length === 0) {
      playlistStore.loadTracks(playlistId, await getTracks(playlistId))
      tracks = await playlistStore.getTracks(playlistId)
    }
    return tracks.map(track => markRaw(track))
  }

  const loadSlotStatus = async (playlistId) => {
    const requests = await getTrackRequests(playlistId)
    soldPositions.value = new Set(
      requests.map(request => request.position).filter(position => position != null)
    )
    const { data: priceRows } = await getPricePositions(playlistId)
    pricePositions.value = priceRows ?? []
  }

  const selectPlaylist = async (playlistId) => {
    selectedPlaylistId.value = playlistId
    position.value = ''
    pendingRelocation.value = null
    errorMessage.value = ''
    const [tracks] = await Promise.all([
      loadPlaylistTracks(playlistId),
      loadSlotStatus(playlistId)
    ])
    playlistTracks.value = tracks
  }

  watch(() => props.open, async (opened) => {
    if (!opened) return
    reset()
    isLoading.value = true
    try {
      if (!playlistStore.isLoaded) {
        const playlists = await loadAllFromDatabase()
        playlistStore.loadAll(playlists)
      }

      const topGenres = await getGenres(trackData.value?.artists ?? []).catch(() => [])
      trackGenres.value = topGenres

      playlists.value = getCompatiblePlaylists({
        playlists: playlistStore.playlists,
        currentUser: userStore.getUser,
        excludePlaylistId: null,
        trackGenres: topGenres.reduce((map, genre) => {
          map[genre.genre] = genre.count
          return map
        }, {}),
        track: trackData.value
      })

      if (playlists.value.length > 0) {
        await selectPlaylist(playlists.value[0].id)
      }
    } catch (error) {
      console.error(error)
    } finally {
      isLoading.value = false
    }
  })

  const verifyDuplicateTrackInPlaylist = async (playlistId, trackUri) => {
    const tracks = await loadPlaylistTracks(playlistId)
    return tracks.find(element => (element.track?.uri ?? element.uri) === trackUri) === undefined
  }

  const saveTracksStatistics = async (playlistId, trackId, trackPopularity) => {
    const playlist = playlists.value.find(playlist => playlist.id === playlistId)
    if (!playlist || !playlist?.tracked) return

    const trackToSave = {
      track_id: trackId,
      popularity: trackPopularity,
      playlist_id: playlistId
    }

    const { data: databaseTrack } = await supabase
      .from(import.meta.env.VITE_SUPABASE_TRACKS_TABLE)
      .select("*")
      .eq('track_id', trackId)

    if (databaseTrack.length > 0) {
      trackToSave.id = databaseTrack[0].id
      const { error: trackUpdatedError } = await supabase
        .from(import.meta.env.VITE_SUPABASE_TRACKS_TABLE)
        .upsert(trackToSave)
        .select()

      if (trackUpdatedError) {
        console.error(trackUpdatedError.message)
        return
      }
      userStore.loadTrack(databaseTrack[0])
      return
    }

    const { error: trackInsertedError, data: databaseTrackInserted } = await supabase
      .from(import.meta.env.VITE_SUPABASE_TRACKS_TABLE)
      .insert(trackToSave)
      .select('*')

    if (trackInsertedError) {
      console.error(trackInsertedError.message)
      return
    }
    userStore.loadTrack(databaseTrackInserted[0])
  }

  const refreshPlaylist = async (playlistId) => {
    const tracks = await getTracks(playlistId)
    playlistStore.loadTracks(playlistId, tracks)
    updatePlaylistTotalTracks(playlistId, tracks.length)
    playlistTracks.value = tracks.map(track => markRaw(track))
  }

  const finishSuccess = () => {
    submitState.value = 'success'
    isSubmitting.value = false
    setTimeout(() => {
      emit('added')
      emit('close')
    }, 1200)
  }

  const addTrackAtEnd = async (playlistId) => {
    const formData = {
      'uris': [trackData.value.uri]
    }
    const { status } = await addTracksToPlaylist(playlistId, formData)
    if ((status === 200) || (status === 201)) {
      await saveTracksStatistics(playlistId, trackData.value.id, trackData.value.popularity)
      await refreshPlaylist(playlistId)
      finishSuccess()
      return
    }
    throw new Error('Status: ' + status + ' not expected!')
  }

  const addTrackAtPosition = async (playlistId) => {
    const formData = {
      'uris': [trackData.value.uri],
      'position': parseInt(position.value) - 1
    }
    const { status } = await addTracksToPlaylist(playlistId, formData)
    if ((status === 200) || (status === 201)) {
      await saveTracksStatistics(playlistId, trackData.value.id, trackData.value.popularity)
      await refreshPlaylist(playlistId)
      finishSuccess()
      return
    }
    throw new Error('Status: ' + status + ' not expected!')
  }

  const confirmRelocation = async () => {
    const playlistId = pendingRelocation.value.playlistId
    const target = pendingRelocation.value
    isSubmitting.value = true
    errorMessage.value = ''
    try {
      const formData = {
        'uris': [trackData.value.uri],
        'position': target.position - 1
      }
      const { status } = await addTracksToPlaylist(playlistId, formData)
      if ((status === 200) || (status === 201)) {
        await saveTracksStatistics(playlistId, trackData.value.id, trackData.value.popularity)

        const tracks = await getTracks(playlistId)
        const newTotal = tracks.length
        const trackToMoveIndex = tracks.findIndex(t => (t.track?.uri ?? t.uri) === target.uri)

        if (trackToMoveIndex !== -1 && trackToMoveIndex !== newTotal - 1) {
          const moveFormData = {
            'range_start': trackToMoveIndex,
            'insert_before': newTotal
          }
          await updateTracksOfPlaylist(playlistId, moveFormData)
        }

        playlistStore.loadTracks(playlistId, await getTracks(playlistId))
        updatePlaylistTotalTracks(playlistId, newTotal)
        playlistTracks.value = await loadPlaylistTracks(playlistId)

        finishSuccess()
        return
      }
      throw new Error('Status: ' + status + ' not expected!')
    } catch (error) {
      console.error(error)
      errorMessage.value = 'An error occurred while adding the track!'
      isSubmitting.value = false
    }
  }

  const confirm = async () => {
    if (isSubmitting.value) return
    errorMessage.value = ''
    if (!selectedPlaylistId.value) {
      errorMessage.value = 'Selecione uma playlist!'
      return
    }

    if (pendingRelocation.value) {
      await confirmRelocation()
      return
    }

    const isDuplicate = await verifyDuplicateTrackInPlaylist(selectedPlaylistId.value, trackData.value.uri)
    if (!isDuplicate) {
      errorMessage.value = 'Esta faixa já está nesta playlist!'
      return
    }

    if (mode.value === 'paid') {
      isSubmitting.value = true
      emit('sell-slot', {
        track: props.track,
        playlistId: selectedPlaylistId.value,
        playlist: selectedPlaylist.value,
        position: position.value ? parseInt(position.value) : null
      })
      return
    }

    isSubmitting.value = true
    try {
      if (position.value && occupiedTrack.value) {
        pendingRelocation.value = {
          playlistId: selectedPlaylistId.value,
          position: parseInt(position.value),
          ...occupiedTrack.value
        }
        isSubmitting.value = false
        return
      }
      if (position.value) {
        await addTrackAtPosition(selectedPlaylistId.value)
      } else {
        await addTrackAtEnd(selectedPlaylistId.value)
      }
    } catch (error) {
      console.error(error)
      errorMessage.value = 'An error occurred while adding the track!'
      isSubmitting.value = false
    }
  }

  const close = () => {
    if (isSubmitting.value) return
    emit('close')
  }
</script>

<template>
  <transition name="modal-fade">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
      <div class="absolute inset-0 bg-black/70" @click="close"></div>
      <div class="relative w-full max-w-5xl bg-surface-container-high shadow-2xl rounded-xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] overflow-y-auto md:overflow-y-visible">
        <!-- Left Panel: Track Preview -->
        <div class="w-full md:w-[40%] bg-surface-container-highest p-lg md:p-xl flex flex-col items-center justify-center gap-lg relative overflow-hidden border-b md:border-b-0 md:border-r border-outline-variant/30">
          <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>

          <div v-if="isLoading" class="w-full max-w-[320px] space-y-md">
            <div class="aspect-square rounded-lg animate-pulse bg-surface-container-high"></div>
            <div class="space-y-2">
              <div class="h-6 w-3/4 rounded animate-pulse bg-surface-container-high"></div>
              <div class="h-4 w-1/2 rounded animate-pulse bg-surface-container-high"></div>
            </div>
          </div>

          <div v-else class="w-full max-w-[320px] group">
            <div class="relative aspect-square rounded-lg overflow-hidden shadow-2xl mb-md">
              <img class="w-full h-full object-cover" :src="trackData?.album?.images?.[0]?.url" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
              <div class="absolute top-4 right-4 bg-surface-container/80 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-2">
                <font-awesome-icon icon="chart-line" class="text-[14px] text-primary" />
                <span class="text-label-sm text-on-surface uppercase tracking-widest">{{ trackData?.popularity }}</span>
              </div>
              <div class="absolute bottom-4 right-4">
                <span class="text-label-sm text-on-surface bg-surface-dim/60 backdrop-blur-sm px-2 py-1 rounded">{{ duration }}</span>
              </div>
            </div>
            <div class="space-y-1 text-center md:text-left">
              <h3 class="text-headline-md text-on-surface tracking-tight"><font-awesome-icon v-if="isTracked" icon="heart" style="vertical-align:middle;margin-right:5px;color: rgb(30, 215, 96);" />{{ trackData?.name }}</h3>
              <p class="text-body-md text-primary font-semibold uppercase tracking-wider">{{ trackData?.artists?.map(artist => artist.name).join(', ') }}</p>
              <p class="text-label-sm text-on-surface-variant">{{ releaseDate }}</p>
              <div class="flex items-center gap-2 mt-2">
                <font-awesome-icon icon="chart-line" class="text-primary text-sm" />
                <span class="text-label-sm text-primary uppercase tracking-widest">Popularidade: {{ trackData?.popularity }}/100</span>
              </div>
              <div v-if="trackGenres.length" class="flex items-center justify-center md:justify-start gap-4 mt-4 opacity-60">
                <div class="flex items-center gap-1">
                  <font-awesome-icon icon="music" class="text-sm" />
                  <span class="text-label-sm">{{ trackGenres.slice(0, 3).map(genre => genre.genre).join(', ') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Panel: Selection & Configuration -->
        <div class="flex-1 p-lg md:p-xl flex flex-col bg-surface-container">
          <div class="mb-lg">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-[2px] bg-primary"></div>
              <span class="text-label-sm text-primary uppercase tracking-[0.2em]">Curadoria Profissional</span>
            </div>
            <h2 class="text-headline-lg text-on-surface mb-2">Adicionar à Playlist</h2>
            <p class="text-body-md text-on-surface-variant">Escolha como deseja inserir esta track na sua grade.</p>
          </div>

          <!-- Mode Selection Toggle -->
          <div class="grid grid-cols-2 gap-md mb-lg">
            <button
              type="button"
              class="relative p-md rounded-lg border-2 transition-all duration-300 text-left"
              :class="mode === 'organic' ? 'border-primary bg-primary/5' : 'border-outline-variant bg-surface-container-high hover:border-primary'"
              @click="mode = 'organic'"
            >
              <div class="flex justify-between items-start mb-2">
                <font-awesome-icon icon="magic" class="text-primary" />
                <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center" :class="mode === 'organic' ? 'border-primary' : 'border-outline-variant'">
                  <div v-if="mode === 'organic'" class="w-2 h-2 bg-primary rounded-full"></div>
                </div>
              </div>
              <p class="text-headline-sm text-on-surface text-sm mb-1">Adição Orgânica</p>
              <p class="text-label-sm text-on-surface-variant leading-tight">Inclusão direta sem custos operacionais.</p>
            </button>
            <button
              type="button"
              class="relative p-md rounded-lg border-2 transition-all duration-300 text-left"
              :class="mode === 'paid' ? 'border-secondary bg-secondary/5' : 'border-outline-variant bg-surface-container-high hover:border-secondary'"
              @click="mode = 'paid'"
            >
              <div class="flex justify-between items-start mb-2">
                <font-awesome-icon icon="dollar-sign" :class="mode === 'paid' ? 'text-secondary' : 'text-on-surface-variant'" />
                <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center" :class="mode === 'paid' ? 'border-secondary' : 'border-outline-variant'">
                  <div v-if="mode === 'paid'" class="w-2 h-2 bg-secondary rounded-full"></div>
                </div>
              </div>
              <p class="text-headline-sm text-on-surface text-sm mb-1">Venda de Slot</p>
              <p class="text-label-sm text-on-surface-variant leading-tight">Posição patrocinada com analytics.</p>
            </button>
          </div>

          <!-- Configuration Fields -->
          <div class="space-y-md flex-1">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
              <div class="flex flex-col gap-2">
                <label class="text-label-sm text-on-surface-variant uppercase tracking-wider">Playlist Alvo</label>
                <div v-if="isLoading" class="animate-pulse h-12 w-full rounded-lg bg-surface-container-high"></div>
                <div v-else-if="playlists.length === 0" class="h-12 w-full flex items-center px-md rounded-lg bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface-variant">
                  Nenhuma playlist encontrada
                </div>
                <div v-else class="relative">
                  <select
                    v-model="selectedPlaylistId"
                    class="w-full bg-surface-container-lowest border-none rounded-lg p-md text-body-md text-on-surface appearance-none focus:ring-2 focus:ring-primary/50 outline-none cursor-pointer"
                    @change="selectPlaylist(selectedPlaylistId)"
                  >
                    <option v-for="playlist in playlists" :key="playlist.id" :value="playlist.id">{{ playlist.name }}</option>
                  </select>
                  <font-awesome-icon icon="chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant opacity-50 text-[14px]" />
                </div>
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-label-sm text-on-surface-variant uppercase tracking-wider">Posição na Grade</label>
                <div class="relative">
                  <select
                    v-model="position"
                    class="w-full bg-surface-container-lowest border-none rounded-lg p-md text-body-md text-on-surface appearance-none focus:ring-2 focus:ring-primary/50 outline-none cursor-pointer"
                    :disabled="playlists.length === 0"
                  >
                    <option value="">Final da playlist</option>
                    <option v-for="option in positions" :key="option.pos" :value="String(option.pos)">{{ option.label }}</option>
                  </select>
                  <font-awesome-icon icon="chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant opacity-50 text-[14px]" />
                </div>
              </div>
            </div>

            <!-- Relocation Confirmation -->
            <div v-if="pendingRelocation" class="bg-surface-container-low rounded-lg p-md space-y-md">
              <p class="text-body-sm text-on-surface-variant">A posição <strong class="text-on-surface">#{{ String(pendingRelocation.position).padStart(2, '0') }}</strong> está ocupada por:</p>
              <div class="flex items-center gap-3 bg-surface-container-high rounded-lg p-sm">
                <img :src="pendingRelocation.image" class="w-12 h-12 rounded-lg object-cover" />
                <div class="min-w-0">
                  <p class="text-body-md text-on-surface font-semibold truncate">{{ pendingRelocation.name }}</p>
                  <p class="text-label-sm text-on-surface-variant truncate">{{ pendingRelocation.artist }}</p>
                </div>
              </div>
              <p class="text-body-sm text-on-surface-variant">Esta track será movida para o final da playlist.</p>
              <div class="flex justify-end gap-md">
                <button type="button" class="px-lg py-3 text-label-md text-on-surface-variant hover:text-on-surface transition-colors" @click="pendingRelocation = null">Cancelar</button>
                <button
                  type="button"
                  class="px-xl py-3 bg-primary hover:bg-primary-container text-on-primary text-headline-sm text-sm rounded-full transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="isSubmitting"
                  @click="confirm"
                >
                  <font-awesome-icon v-if="isSubmitting" icon="spinner" spin class="text-[18px]" />
                  <span v-else>Confirmar Realocação</span>
                </button>
              </div>
            </div>

            <!-- Error Message -->
            <div v-if="errorMessage" class="bg-error/10 p-md rounded-lg flex items-start gap-3 border-l-4 border-error">
              <font-awesome-icon icon="times" class="text-error shrink-0" />
              <p class="text-body-sm text-on-surface opacity-90">{{ errorMessage }}</p>
            </div>

            <!-- Info Box -->
            <div class="bg-primary/10 p-md rounded-lg flex items-start gap-3 border-l-4 border-primary">
              <font-awesome-icon icon="info" class="text-primary shrink-0" />
              <p class="text-body-sm text-on-surface opacity-90">
                <strong class="text-primary">Aviso de Reordenamento:</strong> Se uma música já existir na posição escolhida, ela será movida automaticamente para o final da playlist para preservar a integridade da grade.
              </p>
            </div>
          </div>

          <!-- Footer Action -->
          <div class="mt-lg pt-lg border-t border-outline-variant/30 flex items-center justify-end gap-md">
            <button type="button" class="px-lg py-3 text-label-md text-on-surface-variant hover:text-on-surface transition-colors" @click="close">Cancelar</button>
            <button
              type="button"
              class="px-xl py-3 bg-primary hover:bg-primary-container text-on-primary text-headline-sm text-sm rounded-full transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isSubmitting || playlists.length === 0"
              @click="confirm"
            >
              <font-awesome-icon v-if="submitState === 'success'" icon="check-circle" class="text-[18px]" />
              <font-awesome-icon v-else-if="isSubmitting" icon="spinner" spin class="text-[18px]" />
              <span v-else>Confirmar Adição</span>
              <font-awesome-icon v-if="submitState !== 'success' && !isSubmitting" icon="check" class="text-[18px]" />
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
