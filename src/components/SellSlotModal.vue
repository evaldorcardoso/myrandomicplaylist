<script setup>
  import { ref, computed, watch, onBeforeUnmount } from 'vue'
  import { notify } from "@kyvg/vue3-notification";
  import { TrackRequestService } from '@/services/TrackRequestService'

  const emit = defineEmits(['close', 'confirm'])

  const props = defineProps({
    open: {
      type: Boolean,
      default: false
    },
    track: {
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

  const { createTrackRequest, getRequesters, getRequesterByName, getOrCreateRequester, getPricePosition } = TrackRequestService()

  const selectedPlaylist = ref(props.playlistId)
  const permanenceDays = ref(30)
  const value = ref('')
  const requesterName = ref('')
  const curator = ref('')
  const requesters = ref([])
  const dropdownOpen = ref(false)
  const searchTimer = ref(null)
  const isSubmitting = ref(false)
  const submitState = ref('idle')
  const paid = ref(false)

  const trackData = computed(() => props.track?.track ?? null)

  const duration = computed(() => {
    if (!trackData.value?.duration_ms) return '--:--'
    return new Date(trackData.value.duration_ms).toISOString().slice(14, 19)
  })

  const position = computed(() => (props.track?.id ?? 0) + 1)

  const calcDueDateISO = (days) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const dueDateInput = ref(calcDueDateISO(30))

  const parseValue = () => {
    const raw = String(value.value ?? '').trim()
    if (raw === '') return NaN
    return parseFloat(raw.replace(/\./g, '').replace(',', '.'))
  }

  const canSubmit = computed(() => {
    if (isSubmitting.value) return false
    if (!requesterName.value.trim()) return false
    const parsed = parseValue()
    return Number.isFinite(parsed) && parsed > 0
  })

  const reset = () => {
    selectedPlaylist.value = props.playlistId
    requesterName.value = ''
    curator.value = ''
    requesters.value = []
    dropdownOpen.value = false
    permanenceDays.value = 30
    dueDateInput.value = calcDueDateISO(30)
    value.value = ''
    isSubmitting.value = false
    submitState.value = 'idle'
    paid.value = false
  }

  watch(() => props.open, async (opened) => {
    if (opened) {
      reset()
      requesterName.value = trackData.value?.artists?.[0]?.name ?? ''
      const { data: existingRequester } = await getRequesterByName(requesterName.value)
      if (existingRequester?.curator) {
        curator.value = existingRequester.curator
      }
      const { data: pricePosition } = await getPricePosition(selectedPlaylist.value || props.playlistId, position.value)
      if (pricePosition?.value != null) {
        value.value = Number(pricePosition.value).toFixed(2).replace('.', ',')
      }
    }
  })

  watch(permanenceDays, (days) => {
    dueDateInput.value = calcDueDateISO(days)
  })

  const searchRequesters = async (query) => {
    if (!query.trim()) {
      requesters.value = []
      dropdownOpen.value = false
      return
    }
    requesters.value = await getRequesters(query)
    dropdownOpen.value = true
  }

  const onRequesterInput = () => {
    if (searchTimer.value) {
      clearTimeout(searchTimer.value)
    }
    searchTimer.value = setTimeout(() => searchRequesters(requesterName.value), 300)
  }

  const onRequesterBlur = () => {
    setTimeout(() => {
      dropdownOpen.value = false
    }, 150)
  }

  const selectRequester = (requester) => {
    requesterName.value = requester.name
    curator.value = requester.curator ?? ''
    requesters.value = []
    dropdownOpen.value = false
  }

  const close = () => {
    if (isSubmitting.value) return
    emit('close')
  }

  const confirm = async () => {
    if (!canSubmit.value) return
    isSubmitting.value = true
    try {
      const { data: requester, error: requesterError } = await getOrCreateRequester({
        name: requesterName.value,
        curator: curator.value
      })
      if (requesterError) throw requesterError

      const payload = {
        playlist_id: selectedPlaylist.value || props.playlistId,
        track_id: trackData.value?.id,
        position: position.value,
        name: trackData.value?.name,
        due_date: dueDateInput.value,
        value: parseValue(),
        requester_id: requester.id,
        status: paid.value ? 'paid' : 'pending'
      }
      const { data, error } = await createTrackRequest(payload)
      if (error) throw error

      submitState.value = 'success'
      emit('confirm', { track: props.track, request: data?.[0] ?? payload })
    } catch (error) {
      console.error(error)
      submitState.value = 'idle'
      notify({
        title: 'Ops',
        text: 'Não foi possível realizar a venda da posição!',
        type: 'error'
      })
    } finally {
      isSubmitting.value = false
    }
  }

  onBeforeUnmount(() => {
    if (searchTimer.value) {
      clearTimeout(searchTimer.value)
    }
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
              <span class="text-label-sm px-3 py-1 bg-primary/10 border border-primary/30 rounded-full text-primary font-bold">FREE</span>
              <span class="text-label-sm px-3 py-1 bg-surface-container-highest rounded-full text-on-surface-variant">{{ duration }}</span>
            </div>
          </div>
        </div>

        <!-- Right Panel: Transaction Form -->
        <div class="w-full md:w-7/12 p-8 md:p-10 flex flex-col gap-7">
          <div class="flex justify-between items-start">
            <div class="space-y-1">
              <h3 class="text-headline-md text-on-surface">Converter para Posição Paga</h3>
              <p class="text-body-sm text-on-surface-variant">Defina os dados do lançamento para esta posição.</p>
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
                  v-model="selectedPlaylist"
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
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-3 relative">
                <label class="text-label-md text-primary uppercase tracking-wider">Solicitante</label>
                <input
                  v-model="requesterName"
                  type="text"
                  placeholder="Nome do solicitante"
                  class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
                  @input="onRequesterInput"
                  @blur="onRequesterBlur"
                />
                <div v-if="dropdownOpen && requesters.length" class="absolute z-20 left-0 right-0 top-full mt-2 bg-surface-container-high border border-outline-variant/30 rounded-xl overflow-hidden shadow-2xl">
                  <button
                    v-for="requester in requesters"
                    :key="requester.id"
                    type="button"
                    class="w-full text-left px-5 py-3 text-body-md text-on-surface hover:bg-surface-variant transition-colors"
                    @mousedown.prevent="selectRequester(requester)"
                  >
                    <span class="block">{{ requester.name }}</span>
                    <span v-if="requester.curator" class="block text-[11px] text-on-surface-variant">{{ requester.curator }}</span>
                  </button>
                </div>
              </div>
              <div class="space-y-3">
                <label class="text-label-md text-primary uppercase tracking-wider">Curator</label>
                <input
                  v-model="curator"
                  type="text"
                  placeholder="Nome do curator"
                  class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
                />
              </div>
            </div>

            <!-- Permanence + Value + Due date -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-3">
                <label class="text-label-md text-primary uppercase tracking-wider">Permanência</label>
                <div class="relative">
                  <select
                    v-model="permanenceDays"
                    class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface appearance-none focus:outline-none focus:border-primary transition-all cursor-pointer"
                  >
                    <option :value="30">30 Dias</option>
                    <option :value="60">60 Dias</option>
                    <option :value="90">90 Dias</option>
                  </select>
                  <font-awesome-icon icon="chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[14px]" />
                </div>
              </div>
              <div class="space-y-3">
                <label class="text-label-md text-primary uppercase tracking-wider">Valor (R$)</label>
                <input
                  v-model="value"
                  type="text"
                  inputmode="decimal"
                  placeholder="0,00"
                  class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <div class="space-y-3">
                <label class="text-label-md text-primary uppercase tracking-wider">Vencimento</label>
                <div class="relative">
                  <input
                    v-model="dueDateInput"
                    type="date"
                    class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
                  />
                  <font-awesome-icon icon="calendar-alt" class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]" />
                </div>
              </div>
            </div>
          </div>

          <!-- Logic Card -->
          <div class="bg-primary/5 border-l-4 border-primary p-6 rounded-xl space-y-3">
            <div class="flex items-center gap-2 text-primary">
              <font-awesome-icon icon="info" class="text-[20px]" />
              <span class="text-label-md font-bold uppercase tracking-tight">Lógica de Reordenamento</span>
            </div>
            <p class="text-body-sm text-on-surface-variant leading-relaxed">
              A conversão desta faixa para <strong class="text-on-surface">Posição Paga</strong> atualizará seu status no painel de gerenciamento e iniciará o cronômetro de expiração conforme o período selecionado.
            </p>
            <label class="flex items-center gap-3 cursor-pointer select-none">
              <input
                v-model="paid"
                type="checkbox"
                class="peer sr-only"
              />
              <span class="w-5 h-5 rounded-md border-2 border-primary/40 bg-surface-container-lowest flex items-center justify-center transition-colors peer-checked:bg-primary peer-checked:border-primary">
                <font-awesome-icon v-if="paid" icon="check" class="text-on-primary text-[12px]" />
              </span>
              <span class="text-body-sm text-on-surface">Já está pago</span>
            </label>
          </div>

          <!-- Action Button -->
          <button
            class="group relative w-full bg-primary hover:bg-primary-fixed text-on-primary text-headline-sm py-5 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            :disabled="!canSubmit"
            @click="confirm"
          >
            <div class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <font-awesome-icon v-if="submitState === 'success'" icon="check-circle" class="relative z-10" />
            <font-awesome-icon v-else-if="isSubmitting" icon="sync" spin class="relative z-10" />
            <font-awesome-icon v-else icon="bolt" class="relative z-10" />
            <span class="relative z-10">{{ submitState === 'success' ? 'Track Adicionado!' : (isSubmitting ? 'Processando...' : 'Confirmar Venda') }}</span>
          </button>
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
