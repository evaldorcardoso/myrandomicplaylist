<script setup>
  import { onMounted, onUnmounted, reactive } from 'vue'
  import { useRouter } from 'vue-router'
  import { DashboardService } from '@/services/DashboardService'
  import { usePlaylistStore } from '@/stores/playlist'
  import { PlaylistService } from '@/services/PlaylistService'

  const { getDashboardData } = DashboardService()
  const { loadAllFromDatabase } = PlaylistService()
  const playlistStore = usePlaylistStore()
  const router = useRouter()
  const state = reactive({
    data: null
  })

  let countdownInterval = null

  const pad = (value) => String(value).padStart(2, '0')

  const formatCountdown = (secondsLeft) => {
    const total = Math.max(0, secondsLeft)
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = total % 60
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }

  const occupancyPercent = (playlist) => {
    return Math.round((playlist.filledPositions / playlist.totalPositions) * 100)
  }

  const openPlaylist = (playlistId) => {
    router.push('/playlist/' + playlistId)
  }

  onMounted(async () => {
    if (!playlistStore.isLoaded) {
      const playlists = await loadAllFromDatabase()
      playlistStore.loadAll(playlists)
    }
    state.data = await getDashboardData(playlistStore.playlists)
    countdownInterval = setInterval(() => {
      state.data.expirations.forEach(expiration => {
        expiration.secondsLeft = Math.max(0, expiration.secondsLeft - 1)
      })
    }, 1000)
  })

  onUnmounted(() => {
    if (countdownInterval) {
      clearInterval(countdownInterval)
    }
  })
</script>

<template>
  <div v-if="state.data" class="h-full overflow-y-auto bg-surface text-on-surface">
    <div class="max-w-[1400px] mx-auto p-gutter md:p-lg pb-28">
      <!-- Top Stats Row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-gutter">
        <div class="bg-surface-container-low p-lg rounded-xl flex flex-col gap-xs shadow-sm hover:bg-surface-container transition-colors">
          <div class="flex items-center justify-between">
            <span class="text-label-sm text-on-surface-variant uppercase tracking-widest">Ganhos Mensais</span>
            <span class="material-symbols-outlined text-primary text-headline-sm">payments</span>
          </div>
          <div class="flex flex-col">
            <span class="text-display-lg font-display text-on-surface">{{ state.data.stats.monthlyEarnings }}</span>
            <div class="flex items-center gap-1 text-primary">
              <span class="material-symbols-outlined text-[16px]">trending_up</span>
              <span class="text-label-sm">{{ state.data.stats.earningsDelta }} {{ state.data.stats.earningsDeltaLabel }}</span>
            </div>
          </div>
        </div>

        <div class="bg-surface-container-low p-lg rounded-xl flex flex-col gap-xs shadow-sm hover:bg-surface-container transition-colors">
          <div class="flex items-center justify-between">
            <span class="text-label-sm text-on-surface-variant uppercase tracking-widest">Posições Ativas</span>
            <span class="material-symbols-outlined text-secondary text-headline-sm">equalizer</span>
          </div>
          <div class="flex flex-col">
            <span class="text-display-lg font-display text-on-surface">{{ state.data.stats.activePositions }}</span>
            <div class="flex items-center gap-1 text-on-surface-variant">
              <span class="text-label-sm">{{ state.data.stats.occupancyLabel }}</span>
            </div>
          </div>
        </div>

        <div class="bg-surface-container-low p-lg rounded-xl flex flex-col gap-xs shadow-sm hover:bg-surface-container transition-colors relative overflow-hidden">
          <div class="flex items-center justify-between relative z-10">
            <span class="text-label-sm text-on-surface-variant uppercase tracking-widest">Expirações &lt; 24h</span>
            <span class="material-symbols-outlined text-error text-headline-sm animate-pulse">timer</span>
          </div>
          <div class="flex flex-col relative z-10">
            <span class="text-display-lg font-display text-on-surface">{{ state.data.stats.expiringSoon }}</span>
            <div class="flex items-center gap-1 text-error">
              <span class="text-label-sm">{{ state.data.stats.expiringLabel }}</span>
            </div>
          </div>
          <div class="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
            <span class="material-symbols-outlined text-[120px]">warning</span>
          </div>
        </div>

        <div class="bg-primary-container p-lg rounded-xl flex flex-col justify-between shadow-lg shadow-primary/10 group cursor-pointer hover:scale-[1.02] transition-transform">
          <div class="flex flex-col">
            <span class="text-on-primary-container font-headline-sm font-display">Nova Playlist</span>
            <p class="text-on-primary-container/80 text-body-sm mt-1">Criar uma nova playlist</p>
          </div>
          <div class="flex justify-end">
            <div class="w-10 h-10 bg-on-primary-container rounded-full flex items-center justify-center text-primary">
              <span class="material-symbols-outlined">add</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Grid Content -->
      <div class="grid grid-cols-12 gap-lg items-start mt-lg">
        <!-- Left Column: Playlist Management (8 Cols) -->
        <div class="col-span-12 lg:col-span-8 flex flex-col gap-md">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-3">
              <h2 class="text-headline-md font-display text-on-surface">Gestão de Playlists</h2>
              <span class="px-2 py-0.5 bg-surface-container-high rounded text-label-sm text-on-surface-variant">{{ state.data.playlists.length }} Playlists</span>
            </div>
            <div class="flex gap-2">
              <button class="p-2 text-on-surface-variant hover:text-primary transition-colors">
                <span class="material-symbols-outlined">filter_list</span>
              </button>
              <button class="p-2 text-on-surface-variant hover:text-primary transition-colors">
                <span class="material-symbols-outlined">download</span>
              </button>
            </div>
          </div>

          <div class="bg-surface-container-low rounded-xl overflow-hidden shadow-sm border border-outline-variant/10">
            <div class="overflow-x-auto">
              <table class="w-full table-fixed text-left border-collapse min-w-[480px]">
                <thead>
                  <tr class="bg-surface-container text-label-sm text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
                    <th class="px-4 py-4">Playlist</th>
                    <th class="w-[90px] px-4 py-4 text-center">Total Posições</th>
                    <th class="w-[150px] px-4 py-4">Ocupação</th>
                    <th class="w-[110px] px-4 py-4 text-right">Valor Médio</th>
                    <th class="w-[44px] px-4 py-4"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-outline-variant/5">
                  <tr
                    v-for="playlist in state.data.playlists"
                    :key="playlist.id"
                    class="hover:bg-surface-container-high/50 transition-colors"
                  >
                    <td class="px-4 py-4 min-w-0">
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded bg-surface-container-highest flex-shrink-0 overflow-hidden">
                          <img
                            v-if="playlist.image"
                            class="w-full h-full object-cover"
                            :src="playlist.image"
                            :alt="playlist.name"
                          />
                          <div v-else class="w-full h-full bg-gradient-to-br from-primary-container to-secondary-container opacity-40"></div>
                        </div>
                        <div class="flex flex-col min-w-0">
                          <span class="text-body-md font-bold text-on-surface truncate">{{ playlist.name }}</span>
                          <span
                            class="text-label-sm truncate"
                            :class="playlist.tagTone === 'secondary' ? 'text-secondary' : 'text-primary'"
                          >{{ playlist.tag }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-4 text-center">
                      <span class="font-mono text-body-md text-on-surface">{{ playlist.totalPositions }}</span>
                    </td>
                    <td class="px-4 py-4">
                      <div class="flex flex-col gap-1.5">
                        <div class="flex justify-between text-label-sm">
                          <span class="text-on-surface">{{ playlist.filledPositions }}/{{ playlist.totalPositions }}</span>
                          <span v-if="playlist.filledPositions === playlist.totalPositions" class="text-primary font-bold">FULL</span>
                          <span v-else class="text-on-surface-variant">{{ occupancyPercent(playlist) }}%</span>
                        </div>
                        <div class="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                          <div
                            class="h-full"
                            :class="playlist.filledPositions === playlist.totalPositions ? 'bg-secondary' : 'bg-primary'"
                            :style="{ width: occupancyPercent(playlist) + '%' }"
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-4 text-right">
                      <span class="font-mono text-body-md text-on-surface">{{ playlist.avgValue }}</span>
                    </td>
                    <td class="px-4 py-4 text-right">
                      <button class="text-on-surface-variant hover:text-primary transition-colors" @click="openPlaylist(playlist.id)">
                        <span class="material-symbols-outlined">chevron_right</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Recent Orders Section -->
          <div class="flex flex-col gap-4 mt-4">
            <h3 class="text-headline-sm font-display text-on-surface">Pedidos Recentes</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="order in state.data.recentOrders"
                :key="order.id"
                class="bg-surface-container-low p-4 rounded-xl flex items-center justify-between border border-outline-variant/10 hover:border-primary/30 transition-all cursor-pointer"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <div
                    class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    :class="order.tone === 'primary' ? 'bg-primary/10 text-primary' : 'bg-tertiary-container/10 text-tertiary'"
                  >
                    <span class="material-symbols-outlined">{{ order.icon }}</span>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-body-md font-bold text-on-surface line-clamp-1">{{ order.title }}</span>
                    <span class="text-label-sm text-on-surface-variant line-clamp-1">{{ order.subtitle }}</span>
                  </div>
                </div>
                <div class="flex flex-col items-end flex-shrink-0 ml-3">
                  <span
                    class="text-label-sm px-2 py-0.5 rounded-full"
                    :class="order.tone === 'primary' ? 'text-primary bg-primary/10' : 'text-on-tertiary-container bg-tertiary-container/10'"
                  >{{ order.status }}</span>
                  <span class="text-[10px] text-on-surface-variant mt-1">{{ order.time }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Alerts & Side Widgets (4 Cols) -->
        <div class="col-span-12 lg:col-span-4 flex flex-col gap-lg">
          <!-- Expiration Widget -->
          <div class="bg-surface-container-low rounded-xl p-lg flex flex-col gap-md border border-outline-variant/10 relative overflow-hidden shadow-xl">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-error">notification_important</span>
              <h3 class="text-headline-sm font-display text-on-surface">Alerta de Expiração</h3>
            </div>
            <div class="flex flex-col gap-4">
              <div
                v-for="expiration in state.data.expirations"
                :key="expiration.id"
                class="p-4 bg-surface-container rounded-xl flex flex-col gap-3 transition-all hover:bg-surface-container-high"
                :class="expiration.urgent ? 'border border-error/20' : 'border border-outline-variant/10'"
              >
                <div class="flex justify-between items-start">
                  <div class="flex gap-3 min-w-0">
                    <div
                      class="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
                      :class="expiration.urgent ? 'bg-error/10 text-error' : 'bg-on-surface-variant/10 text-on-surface-variant'"
                    >
                      <span class="material-symbols-outlined font-bold">{{ expiration.icon }}</span>
                    </div>
                    <div class="flex flex-col min-w-0">
                      <span class="text-body-md font-bold text-on-surface truncate">{{ expiration.title }}</span>
                      <span class="text-label-sm text-on-surface-variant truncate">{{ expiration.subtitle }}</span>
                    </div>
                  </div>
                  <div class="flex flex-col items-end flex-shrink-0 ml-2">
                    <span
                      class="text-label-sm font-mono tracking-tighter"
                      :class="expiration.urgent ? 'text-error' : 'text-on-surface'"
                    >{{ formatCountdown(expiration.secondsLeft) }}</span>
                    <span class="text-[10px] text-on-surface-variant uppercase">Restantes</span>
                  </div>
                </div>
                <div class="flex gap-2 pt-2">
                  <button
                    v-if="expiration.urgent"
                    class="flex-1 bg-primary text-on-primary py-2 rounded-lg text-label-sm font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  >
                    <span class="material-symbols-outlined text-[18px]">refresh</span>
                    RENOVAR
                  </button>
                  <button
                    v-if="expiration.urgent"
                    class="px-3 bg-surface-container-highest text-on-surface-variant rounded-lg hover:text-on-surface transition-colors flex items-center justify-center"
                  >
                    <span class="material-symbols-outlined text-[18px]">notifications_active</span>
                  </button>
                  <button
                    v-else
                    class="flex-1 bg-surface-container-highest text-on-surface py-2 rounded-lg text-label-sm font-bold border border-outline-variant/20 hover:bg-surface-container transition-all"
                  >
                    NOTIFICAR CLIENTE
                  </button>
                </div>
              </div>
            </div>
            <a class="text-center text-label-sm text-primary hover:underline mt-2" href="#">Ver todas as {{ state.data.stats.expiringSoon }} expirações</a>
          </div>

          <!-- Visualization: Earnings Curve -->
          <div class="bg-surface-container-low rounded-xl p-lg border border-outline-variant/10 flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <span class="text-label-sm text-on-surface-variant uppercase tracking-widest">Performance Semanal</span>
              <div class="flex gap-1">
                <span class="w-2 h-2 rounded-full bg-primary"></span>
                <span class="w-2 h-2 rounded-full bg-surface-container-highest"></span>
              </div>
            </div>
            <div class="h-32 w-full mt-2">
              <svg class="w-full h-full text-primary drop-shadow-[0_0_8px_rgba(83,224,118,0.3)]" fill="none" preserveAspectRatio="none" viewBox="0 0 400 100">
                <path d="M0 80 Q 50 20 100 60 T 200 40 T 300 10 T 400 30" stroke="currentColor" stroke-linecap="round" stroke-width="3"></path>
                <path d="M0 80 Q 50 20 100 60 T 200 40 T 300 10 T 400 30 L 400 100 L 0 100 Z" fill="url(#gradient-primary)" opacity="0.1"></path>
                <defs>
                  <linearGradient id="gradient-primary" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="currentColor"></stop>
                    <stop offset="100%" stop-color="transparent"></stop>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div class="flex justify-between text-[10px] text-on-surface-variant font-mono">
              <span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SÁB</span><span>DOM</span>
            </div>
          </div>

          <!-- Marketplace Activity Micro-widget -->
          <div class="bg-secondary-container/5 rounded-xl p-lg border border-secondary/10 flex flex-col gap-3">
            <div class="flex items-center gap-2 text-secondary">
              <span class="material-symbols-outlined text-[20px]">bolt</span>
              <span class="text-label-sm font-bold uppercase tracking-widest">Sonic Insights</span>
            </div>
            <p class="text-body-sm text-on-surface/80 leading-relaxed">
              Sua playlist <span class="text-secondary font-bold">BRAZILIAN BASS</span> está com demanda <span class="text-primary font-bold">alta</span>. Considere aumentar o valor médio da posição em 15%.
            </p>
            <button class="text-label-sm text-secondary hover:underline self-start">Ajustar Preços</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
