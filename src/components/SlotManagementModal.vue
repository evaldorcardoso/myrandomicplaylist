<script setup>
  import { ref, computed, watch, onBeforeUnmount } from 'vue'
  import { notify } from "@kyvg/vue3-notification";
  import { TrackRequestService } from '@/services/TrackRequestService'

  const emit = defineEmits(['close', 'updated', 'remove-track'])

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

  const { updateTrackRequest, deleteTrackRequest, getOrCreateRequester } = TrackRequestService()

  const requesterName = ref('')
  const curator = ref('')
  const permanenceDays = ref(30)
  const value = ref('')
  const dueDate = ref('')
  const isSubmitting = ref(false)
  const submitState = ref('idle')
  const removeConfirmOpen = ref(false)

  const isPending = computed(() => props.request?.status === 'pending')

  const trackData = computed(() => props.track?.track ?? null)

  const duration = computed(() => {
    if (!trackData.value?.duration_ms) return '--:--'
    return new Date(trackData.value.duration_ms).toISOString().slice(14, 19)
  })

  const position = computed(() => (props.track?.id ?? 0) + 1)

  const daysLeft = computed(() => {
    if (!props.request?.due_date) return null
    const due = new Date(`${props.request.due_date}T00:00:00`).getTime()
    return Math.max(0, Math.ceil((due - Date.now()) / (24 * 60 * 60 * 1000)))
  })

  const slotExpired = computed(() => {
    if (!props.request?.due_date) return false
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return props.request.due_date < todayStr
  })

  const formatDueDate = () => {
    if (!props.request?.due_date) return '-'
    return new Date(`${props.request.due_date}T00:00:00`).toLocaleDateString('pt-BR')
  }

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

  const init = () => {
    requesterName.value = props.request?.requester_name ?? ''
    curator.value = props.request?.curator ?? ''
    permanenceDays.value = 30
    value.value = props.request?.value != null
      ? Number(props.request.value).toFixed(2).replace('.', ',')
      : ''
    dueDate.value = props.request?.due_date ?? calcDueDateISO(30)
    isSubmitting.value = false
    submitState.value = 'idle'
    removeConfirmOpen.value = false
  }

  watch(() => props.open, (opened) => {
    if (opened) {
      init()
    }
  })

  const saveRequester = async () => {
    if (isSubmitting.value || !props.request) return
    if (!requesterName.value.trim()) return
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

  const onPermanenceChange = () => {
    const due = calcDueDateISO(permanenceDays.value)
    dueDate.value = due
    saveDueDate(due)
  }

  const onDueChange = () => {
    saveDueDate(dueDate.value)
  }

  const close = () => {
    if (isSubmitting.value) return
    removeConfirmOpen.value = false
    emit('close')
  }

  const primaryAction = async () => {
    if (isSubmitting.value || !props.request) return
    isSubmitting.value = true
    submitState.value = 'idle'
    try {
      const requester = await resolveRequester()
      const parsedValue = parseValue()
      const payload = {
        requester_id: requester?.id ?? props.request.requester_id
      }
      if (Number.isFinite(parsedValue) && parsedValue > 0) {
        payload.value = parsedValue
      }

      if (isPending.value) {
        if (dueDate.value) payload.due_date = dueDate.value
        payload.status = 'paid'
        const { error } = await updateTrackRequest(props.request.id, payload)
        if (error) throw error
        submitState.value = 'success'
        emit('updated', 'paid')
      } else {
        payload.due_date = calcDueDateISO(30, props.request.due_date)
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

  const onRemoveTrack = () => {
    if (isSubmitting.value) return
    if (slotExpired.value) {
      doRemove()
      return
    }
    removeConfirmOpen.value = true
  }

  const doRemove = () => {
    removeConfirmOpen.value = false
    emit('remove-track', { request: props.request, track: props.track })
    emit('close')
  }

  onBeforeUnmount(() => {
    removeConfirmOpen.value = false
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
              <span
                class="text-label-sm px-3 py-1 rounded-full font-bold"
                :class="isPending
                  ? 'bg-tertiary-container/10 border border-tertiary-container/30 text-tertiary-container'
                  : 'bg-primary/10 border border-primary/30 text-primary'"
              >
                {{ isPending ? 'PENDENTE' : 'PAGA' }}
              </span>
              <span class="text-label-sm px-3 py-1 bg-surface-container-highest rounded-full text-on-surface-variant">{{ duration }}</span>
            </div>
          </div>
        </div>

        <!-- Right Panel: Management Form -->
        <div class="w-full md:w-7/12 p-8 md:p-10 flex flex-col gap-7">
          <div class="flex justify-between items-start">
            <div class="space-y-1">
              <h3 class="text-headline-md text-on-surface">Gestão de Posição Paga</h3>
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
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <input
                  v-model="curator"
                  type="text"
                  placeholder="Nome do curator"
                  class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
                  @blur="saveRequester"
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
                    @change="onPermanenceChange"
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
            class="p-2 rounded-xl space-y-3"
            :class="isPending
              ? 'bg-tertiary-container/5 border-l-4 border-tertiary-container'
              : 'bg-primary/5 border-l-4 border-primary'"
          >
            <div class="flex items-center gap-2" :class="isPending ? 'text-tertiary-container' : 'text-primary'">
              <font-awesome-icon :icon="isPending ? 'hourglass' : 'clock'" class="text-[20px]" />
              <span class="text-label-md font-bold uppercase tracking-tight">Status da Posição</span>
            </div>
            <p class="text-body-sm text-on-surface-variant leading-relaxed">
              <template v-if="isPending">
                Esta posição está aguardando pagamento. Realize o pagamento para confirmar sua permanência.
              </template>
              <template v-else>
                Esta posição está ativa e expira em <strong class="text-primary">{{ daysLeft != null ? `${daysLeft} dias` : 'sem prazo' }}</strong>. Renove agora para garantir a permanência na grade.
              </template>
            </p>
          </div>

          <!-- Removal Confirmation -->
          <div v-if="removeConfirmOpen" class="bg-tertiary-container/5 border border-tertiary-container/40 rounded-xl p-6 space-y-4">
            <div class="flex items-center gap-2 text-tertiary-container">
              <font-awesome-icon icon="info" class="text-[20px]" />
              <span class="text-label-md font-bold uppercase tracking-tight">Aviso</span>
            </div>
            <p class="text-body-sm text-on-surface-variant leading-relaxed">
              Este slot ainda não venceu (vence em <strong class="text-tertiary-container">{{ formatDueDate() }}</strong>). Tem certeza que deseja remover esta música da playlist e liberar a posição?
            </p>
            <div class="flex gap-3">
              <button
                class="flex-1 bg-tertiary-container text-on-tertiary-container text-label-md font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
                @click="doRemove"
              >
                Confirmar Remoção
              </button>
              <button
                class="flex-1 border border-outline-variant/30 text-on-surface-variant text-label-md py-3 rounded-xl hover:border-on-surface-variant hover:text-on-surface transition-colors"
                @click="removeConfirmOpen = false"
              >
                Cancelar
              </button>
            </div>
          </div>

          <!-- Action Buttons -->
          <div v-else class="flex flex-col gap-3">
            <button
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
              class="w-full border border-primary/30 hover:border-primary/60 hover:text-primary text-on-surface-variant text-label-md py-2 rounded-xl flex items-center justify-center gap-2 transition-all"
              :disabled="isSubmitting"
              @click="makeFree"
            >
              <font-awesome-icon icon="heart" class="text-[18px]" />
              <span>Tornar Gratuita</span>
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
