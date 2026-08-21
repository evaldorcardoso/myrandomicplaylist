<script setup>
  import { reactive, ref, computed, onMounted } from 'vue'
  import { useSettingsStore } from '@/stores/settings'
  import { usePlaylistStore } from '@/stores/playlist'
  import { PlaylistService } from '@/services/PlaylistService'
  import { TrackRequestService } from '@/services/TrackRequestService'
  import { notify } from "@kyvg/vue3-notification";
  import { hexToRgba } from '@/support/helpers.js';
  import { usePushNotifications } from '@/composables/usePushNotifications'

  const settingsStore = useSettingsStore()
  const playlistStore = usePlaylistStore()
  const { loadAllFromDatabase } = PlaylistService()
  const { getAllPricePositions, createPricePosition, updatePricePosition, deletePricePosition } = TrackRequestService()

  const push = usePushNotifications()

  const activeTab = ref('settings')

const SETTINGS_FIELDS = [
    {
      key: 'playlistPageSize',
      label: 'Playlists por página',
      description: 'Quantidade de playlists carregadas por requisição ao Spotify (máximo 50).',
      min: 10,
      max: 50
    },
    {
      key: 'tracksPageSize',
      label: 'Músicas por página',
      description: 'Quantidade de músicas carregadas por requisição ao abrir uma playlist (máximo 100).',
      min: 10,
      max: 100
    },
    {
      key: 'artistsBatchSize',
      label: 'Artistas por lote',
      description: 'Quantidade de artistas consultados por requisição ao calcular os gêneros (máximo 50).',
      min: 1,
      max: 50
    },
    {
      key: 'topGenresCount',
      label: 'Gêneros principais',
      description: 'Quantidade de gêneros principais exibidos.',
      min: 1,
      max: 50
    },
    {
      key: 'dashboardExpirationsDisplay',
      label: 'Expirações no dashboard',
      description: 'Quantidade de expirações exibidas inicialmente no painel antes de "Ver todas".',
      min: 1,
      max: 20
    }
  ]

  const form = reactive({ ...settingsStore.settings })

  const save = () => {
    settingsStore.setSettings({ ...form })
    notify({ title: 'Salvo', text: 'Configurações atualizadas!', type: 'success' })
  }

  const resetDefaults = () => {
    if (!confirm('Restaurar todos os valores padrão?')) return
    settingsStore.resetSettings()
    Object.assign(form, settingsStore.settings)
    notify({ title: 'Restaurado', text: 'Valores padrão restaurados!', type: 'info' })
  }

  // === Price Positions CRUD ===

  const pricePositions = ref([])
  const priceLoading = ref(false)
  const priceModalOpen = ref(false)
  const editingPrice = ref(null)
  const priceForm = reactive({
    playlist_id: '',
    min_position: '',
    max_position: '',
    value: '',
    color: ''
  })
  const priceSubmitting = ref(false)

  const playlists = computed(() => playlistStore.playlists)
  const groupedByPlaylist = computed(() => {
    const map = {}
    for (const item of pricePositions.value) {
      const key = item.playlist_id
      if (!map[key]) {
        map[key] = []
      }
      map[key].push(item)
    }
    return Object.keys(map).sort((a, b) => {
      const na = playlistName({ playlist_id: a })
      const nb = playlistName({ playlist_id: b })
      return na.localeCompare(nb)
    })
  })

  const formatCurrency = (value) => {
    if (value == null) return '--'
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const formatDate = (date) => {
    if (!date) return '--'
    return new Date(date).toLocaleDateString('pt-BR')
  }

  const playlistName = (item) => {
    return item.playlist_name ?? playlists.value.find(p => p.id === item.playlist_id)?.name ?? item.playlist_id
  }

  const loadPricePositions = async () => {
    priceLoading.value = true
    try {
      const { data, error } = await getAllPricePositions()
      if (error) throw error
      pricePositions.value = data ?? []
    } catch (e) {
      console.error(e)
      notify({ title: 'Ops', text: 'Erro ao carregar posições!', type: 'error' })
    } finally {
      priceLoading.value = false
    }
  }

  const ensurePlaylists = async () => {
    if (!playlistStore.isLoaded) {
      const all = await loadAllFromDatabase()
      playlistStore.loadAll(all)
    }
  }

  const parsePriceValue = () => {
    const raw = String(priceForm.value ?? '').trim().replace(/\./g, '').replace(',', '.')
    if (raw === '') return NaN
    return parseFloat(raw)
  }

  const canSavePrice = computed(() => {
    if (priceSubmitting.value) return false
    if (!priceForm.playlist_id) return false
    const minPos = parseInt(priceForm.min_position, 10)
    const maxPos = parseInt(priceForm.max_position, 10)
    if (!Number.isFinite(minPos) || minPos < 1) return false
    if (!Number.isFinite(maxPos) || maxPos < minPos) return false
    const val = parsePriceValue()
    return Number.isFinite(val) && val > 0
  })

  const openCreatePrice = () => {
    editingPrice.value = null
    priceForm.playlist_id = ''
    priceForm.min_position = ''
    priceForm.max_position = ''
    priceForm.value = ''
    priceForm.color = ''
    priceModalOpen.value = true
  }

  const openEditPrice = (item) => {
    editingPrice.value = item
    priceForm.playlist_id = item.playlist_id ?? ''
    priceForm.min_position = item.min_position ?? ''
    priceForm.max_position = item.max_position ?? ''
    priceForm.value = item.value != null ? Number(item.value).toFixed(2).replace('.', ',') : ''
    priceForm.color = item.color ?? ''
    priceModalOpen.value = true
  }

  const closePriceModal = () => {
    if (priceSubmitting.value) return
    priceModalOpen.value = false
    editingPrice.value = null
  }

  const savePricePosition = async () => {
    if (!canSavePrice.value) return
    priceSubmitting.value = true
    const payload = {
      playlist_id: priceForm.playlist_id,
      min_position: parseInt(priceForm.min_position, 10),
      max_position: parseInt(priceForm.max_position, 10),
      value: parsePriceValue(),
      color: priceForm.color || null
    }
    try {
      if (editingPrice.value) {
        const { error } = await updatePricePosition(editingPrice.value.id, payload)
        if (error) throw error
        notify({ title: 'Alright', text: 'Faixa atualizada!', type: 'success' })
      } else {
        const { error } = await createPricePosition(payload)
        if (error) throw error
        notify({ title: 'Alright', text: 'Faixa criada!', type: 'success' })
      }
      priceModalOpen.value = false
      editingPrice.value = null
      await loadPricePositions()
    } catch (e) {
      console.error(e)
      notify({ title: 'Ops', text: 'Erro ao salvar faixa!', type: 'error' })
    } finally {
      priceSubmitting.value = false
    }
  }

  const removePricePosition = async (item) => {
    const rangeLabel = item.min_position === item.max_position
      ? `posição ${item.min_position}`
      : `posições ${item.min_position} a ${item.max_position}`
    if (!confirm(`Remover ${rangeLabel} de "${playlistName(item)}"?`)) return
    try {
      const { error } = await deletePricePosition(item.id)
      if (error) throw error
      notify({ title: 'Alright', text: 'Faixa removida!', type: 'success' })
      await loadPricePositions()
    } catch (e) {
      console.error(e)
      notify({ title: 'Ops', text: 'Erro ao remover faixa!', type: 'error' })
    }
  }

  onMounted(async () => {
    await ensurePlaylists()
    await loadPricePositions()
    await push.init()
  })
</script>

<template>
  <div class="h-full overflow-y-auto bg-surface text-on-surface">
    <div class="w-full max-w-7xl mx-auto p-gutter md:p-lg flex flex-col gap-lg">
      <!-- Header -->
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0">
          <span class="material-symbols-outlined text-primary">settings</span>
        </div>
        <div>
          <h1 class="text-headline-lg font-display text-on-surface">Configurações</h1>
          <p class="text-body-sm text-on-surface-variant">Ajuste o desempenho e a exibição do aplicativo.</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 bg-surface-container-low rounded-xl p-1 border border-outline-variant/10">
        <button
          class="flex-1 px-4 py-2.5 rounded-lg text-label-md font-bold transition-all flex items-center justify-center gap-2"
          :class="activeTab === 'settings'
            ? 'bg-primary text-on-primary shadow-sm'
            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'"
          @click="activeTab = 'settings'"
        >
          <span class="material-symbols-outlined text-[18px]">tune</span>
          Avançado
        </button>
        <button
          class="flex-1 px-4 py-2.5 rounded-lg text-label-md font-bold transition-all flex items-center justify-center gap-2"
          :class="activeTab === 'price'
            ? 'bg-primary text-on-primary shadow-sm'
            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'"
          @click="activeTab = 'price'"
        >
          <span class="material-symbols-outlined text-[18px]">payments</span>
          Preço por Posição
        </button>
      </div>

      <!-- Tab: Settings -->
      <template v-if="activeTab === 'settings'">
        <section class="bg-surface-container-low rounded-xl border border-outline-variant/10 p-lg flex flex-col gap-md">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-secondary">speed</span>
            <h2 class="text-headline-sm font-display text-on-surface">Avançado</h2>
          </div>

          <div class="flex flex-col divide-y divide-outline-variant/10">
            <div
              v-for="field in SETTINGS_FIELDS"
              :key="field.key"
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-md"
            >
              <div class="flex flex-col min-w-0 pr-4">
                <span class="text-body-md font-bold text-on-surface">{{ field.label }}</span>
                <span class="text-label-sm text-on-surface-variant">{{ field.description }}</span>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <input
                  v-model.number="form[field.key]"
                  type="number"
                  :min="field.min"
                  :max="field.max"
                  class="w-24 bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-body-md font-mono text-on-surface text-center focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <!-- UI Settings -->
          <div class="pt-md border-t border-outline-variant/10">
            <section class="bg-surface-container-low rounded-xl border border-outline-variant/10 p-lg flex flex-col gap-md">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-secondary">settings</span>
                <h2 class="text-headline-sm font-display text-on-surface">Configurações de UI</h2>
              </div>

              <div class="flex flex-col divide-y divide-outline-variant/10">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-md">
                  <div class="flex flex-col min-w-0 pr-4">
                    <span class="text-body-md font-bold text-on-surface">Músicas por página na playlist</span>
                    <span class="text-label-sm text-on-surface-variant">Quantidade de músicas exibidas por página na listagem da playlist.</span>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <input
                      v-model.number="form.playlistUiPageSize"
                      type="number"
                      :min="60"
                      :max="100"
                      class="w-24 bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-body-md font-mono text-on-surface text-center focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- Notificações Push -->
          <div class="pt-md border-t border-outline-variant/10">
            <div class="flex items-center gap-3 mb-2">
              <span class="material-symbols-outlined text-secondary">notifications_active</span>
              <h3 class="text-headline-sm font-display text-on-surface">Notificações Push</h3>
            </div>
            <p class="text-label-sm text-on-surface-variant mb-4">
              Receba aviso às 9h quando músicas expirarem hoje.
            </p>
            <div v-if="!push.isSupported" class="flex items-center gap-2 text-on-surface-variant text-label-md">
              <span class="material-symbols-outlined text-error">block</span>
              <span>Seu navegador não suporta notificações push.</span>
            </div>
            <div v-else class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex flex-col min-w-0">
                <span class="text-body-md font-bold text-on-surface">
                  {{ push.activeSubscription ? 'Ativas' : 'Desativadas' }}
                </span>
                <span class="text-label-sm text-on-surface-variant">
                  {{ push.permission === 'granted' ? 'Permissão concedida' : (push.permission === 'denied' ? 'Permissão negada nas configurações do navegador' : 'Aguardando permissão') }}
                </span>
              </div>
              <button
                :disabled="push.loading"
                :class="[
                  'px-4 py-2.5 rounded-xl text-label-md font-bold transition-all flex items-center gap-2',
                  push.activeSubscription
                    ? 'bg-error/10 text-error hover:bg-error/20'
                    : 'bg-primary text-on-primary hover:brightness-110'
                ]"
                @click="push.activeSubscription ? push.unsubscribe() : push.subscribe()"
              >
                <span class="material-symbols-outlined text-[18px]">
                  {{ push.loading ? 'hourglass_empty' : (push.activeSubscription ? 'notifications_off' : 'notifications_active') }}
                </span>
                {{ push.loading ? 'Processando...' : (push.activeSubscription ? 'Desativar' : 'Ativar') }}
              </button>
            </div>
            <p v-if="push.errorMessage" class="mt-2 text-caption text-error">
              {{ push.errorMessage }}
            </p>
          </div>
        </section>

        <div class="flex items-center justify-end gap-3">
          <button
            class="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface-variant text-label-md font-bold border border-outline-variant/20 hover:text-on-surface hover:bg-surface-container transition-all flex items-center gap-2"
            @click="resetDefaults"
          >
            <span class="material-symbols-outlined text-[18px]">restart_alt</span>
            Restaurar padrões
          </button>
          <button
            class="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-label-md font-bold hover:brightness-110 transition-all flex items-center gap-2"
            @click="save"
          >
            <span class="material-symbols-outlined text-[18px]">save</span>
            Salvar
          </button>
        </div>
      </template>

      <!-- Tab: Price Positions CRUD -->
      <template v-if="activeTab === 'price'">
        <section class="bg-surface-container-low rounded-xl border border-outline-variant/10 flex flex-col gap-md overflow-hidden">
          <div class="flex items-center justify-between p-lg pb-0">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-secondary">payments</span>
              <div>
                <h2 class="text-headline-sm font-display text-on-surface">Preço por Posição</h2>
                <p class="text-label-sm text-on-surface-variant">Define o valor padrão de cada posição nas playlists.</p>
              </div>
            </div>
            <button
              class="px-4 py-2 rounded-xl bg-primary text-on-primary text-label-md font-bold hover:brightness-110 transition-all flex items-center gap-2 flex-shrink-0"
              @click="openCreatePrice"
            >
              <span class="material-symbols-outlined text-[18px]">add</span>
              Novo
            </button>
          </div>

          <!-- Accordion groups by playlist -->
          <div v-if="priceLoading" class="px-4 py-8 text-center text-on-surface-variant">
            <span class="material-symbols-outlined animate-spin text-primary align-middle">progress_activity</span>
            Carregando...
          </div>
          <template v-else-if="pricePositions.length === 0">
            <div class="px-4 py-8 text-center text-on-surface-variant">
              Nenhuma posição cadastrada.
            </div>
          </template>
          <div v-else class="flex flex-col gap-2 p-lg pt-0">
            <details
              v-for="playlistId in groupedByPlaylist"
              :key="playlistId"
              class="group bg-surface-container rounded-xl border border-outline-variant/10 overflow-hidden"
            >
              <summary class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-container-high transition-colors list-none select-none">
                <div class="w-9 h-9 rounded-lg bg-surface-container-highest flex-shrink-0 overflow-hidden">
                  <img
                    v-if="pricePositions.find(p => p.playlist_id === playlistId)?.playlist_image"
                    class="w-full h-full object-cover"
                    :src="pricePositions.find(p => p.playlist_id === playlistId).playlist_image"
                    :alt="playlistName({ playlist_id: playlistId })"
                  />
                  <div v-else class="w-full h-full bg-gradient-to-br from-primary-container to-secondary-container opacity-40 flex items-center justify-center">
                    <span class="material-symbols-outlined text-on-surface-variant text-[18px]">music_note</span>
                  </div>
                </div>
                <span class="flex-1 text-body-md font-bold text-on-surface truncate">{{ playlistName({ playlist_id: playlistId }) }}</span>
                <span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-label-sm font-bold">{{ pricePositions.filter(p => p.playlist_id === playlistId).length }}</span>
                <span class="material-symbols-outlined text-on-surface-variant group-open:rotate-180 transition-transform text-[18px]">expand_more</span>
              </summary>
              <div class="border-t border-outline-variant/5">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="text-label-xs text-on-surface-variant uppercase tracking-widest">
                       <th class="w-[120px] px-4 py-2">Posição</th>
                       <th class="w-[120px] px-4 py-2 text-right">Valor</th>
                       <th class="w-[100px] px-4 py-2 text-right">Criado em</th>
                       <th class="w-[88px] px-4 py-2 text-right">Ações</th>
                     </tr>
                  </thead>
                  <tbody class="divide-y divide-outline-variant/5">
                    <tr
                      v-for="item in pricePositions.filter(p => p.playlist_id === playlistId)"
                      :key="item.id"
                      class="hover:bg-surface-container-high/50 transition-colors"
                    >
                      <td class="px-4 py-2.5 text-center">
                        <span
                          class="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full text-label-md font-bold whitespace-nowrap"
                          :class="item.color ? '' : 'bg-primary/10 text-primary'"
                          :style="item.color ? { backgroundColor: hexToRgba(item.color, 0.15), color: item.color } : null"
                        >{{ item.min_position === item.max_position ? item.min_position : `${item.min_position}-${item.max_position}` }}</span>
                      </td>
                      <td class="px-4 py-2.5 text-right">
                        <span class="font-mono text-body-md text-on-surface">{{ formatCurrency(item.value) }}</span>
                      </td>
                      <td class="px-4 py-2.5 text-right">
                        <span class="text-label-sm text-on-surface-variant">{{ formatDate(item.created_at) }}</span>
                      </td>
                      <td class="px-4 py-2.5">
                        <div class="flex items-center justify-end gap-1">
                          <button
                            class="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
                            title="Editar"
                            @click="openEditPrice(item)"
                          >
                            <span class="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            class="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-surface-container-high transition-colors"
                            title="Remover"
                            @click="removePricePosition(item)"
                          >
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </section>
      </template>
    </div>

    <!-- Price Position Modal -->
    <transition name="modal-fade">
      <div v-if="priceModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
        <div class="absolute inset-0 bg-black/70" @click="closePriceModal"></div>
        <div class="relative w-full max-w-[480px] bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-start p-lg border-b border-outline-variant/10">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <span class="material-symbols-outlined text-primary">{{ editingPrice ? 'edit' : 'add' }}</span>
              </div>
              <div>
                <h3 class="text-headline-sm font-display text-on-surface">{{ editingPrice ? 'Editar Faixa de Preço' : 'Nova Faixa de Preço' }}</h3>
                <p class="text-label-sm text-on-surface-variant">Defina uma faixa de posições e seu valor na playlist.</p>
              </div>
            </div>
            <button
              class="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant"
              title="Fechar"
              @click="closePriceModal"
            >
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div class="p-lg flex flex-col gap-md">
            <div class="flex flex-col gap-2">
              <label class="text-label-md text-primary uppercase tracking-wider font-bold">Playlist</label>
              <div class="relative">
                <select
                  v-model="priceForm.playlist_id"
                  class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-4 py-2.5 text-body-md text-on-surface appearance-none focus:outline-none focus:border-primary transition-all cursor-pointer pr-10"
                >
                  <option value="" disabled>Selecione uma playlist</option>
                  <option v-for="p in playlists" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
                <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[18px]">expand_more</span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-2">
                <label class="text-label-md text-primary uppercase tracking-wider font-bold">Posição de</label>
                <input
                  v-model="priceForm.min_position"
                  type="number"
                  min="1"
                  placeholder="Ex: 3"
                  class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-4 py-2.5 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-label-md text-primary uppercase tracking-wider font-bold">Posição até</label>
                <input
                  v-model="priceForm.max_position"
                  type="number"
                  min="1"
                  placeholder="Ex: 10"
                  class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-4 py-2.5 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
                />
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-label-md text-primary uppercase tracking-wider font-bold">Valor (R$)</label>
              <input
                v-model="priceForm.value"
                type="text"
                inputmode="decimal"
                placeholder="0,00"
                class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-4 py-2.5 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
              />
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-label-md text-primary uppercase tracking-wider font-bold">Cor do grupo</label>
              <div class="flex items-center gap-3">
                <input
                  v-model="priceForm.color"
                  type="color"
                  class="w-10 h-10 rounded-xl border border-outline-variant/30 bg-surface-container-high cursor-pointer p-1"
                />
                <span class="text-body-sm font-mono text-on-surface-variant">{{ priceForm.color || 'Sem cor' }}</span>
                <button
                  v-if="priceForm.color"
                  class="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-surface-container-high transition-colors"
                  title="Limpar cor"
                  @click="priceForm.color = ''"
                >
                  <span class="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <p class="text-label-xs text-on-surface-variant">Aplicada ao badge de posição na listagem e na coluna "Pos" da playlist.</p>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 p-lg border-t border-outline-variant/10">
            <button
              class="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface-variant text-label-md font-bold border border-outline-variant/20 hover:text-on-surface hover:bg-surface-container transition-all"
              @click="closePriceModal"
            >
              Cancelar
            </button>
            <button
              class="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-label-md font-bold hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!canSavePrice"
              @click="savePricePosition"
            >
              <span class="material-symbols-outlined text-[18px]">{{ editingPrice ? 'save' : 'add' }}</span>
              {{ editingPrice ? 'Salvar' : 'Criar' }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
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
