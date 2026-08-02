<script setup>
  import { onMounted, onUnmounted, reactive } from 'vue'
  import { useRouter } from 'vue-router'
  import { DashboardService } from '@/services/DashboardService'
  import { usePlaylistStore } from '@/stores/playlist'
  import { useUserStore } from '@/stores/user'
  import { PlaylistService } from '@/services/PlaylistService'

  const { getDashboardData, loadOccupancy, loadEarnings, loadExpirations, loadUpcomingExpirations, loadRecentOrders } = DashboardService()
  const { loadAllFromDatabase } = PlaylistService()
  const playlistStore = usePlaylistStore()
  const userStore = useUserStore()
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

  const formatExpiration = (secondsLeft) => {
    if (secondsLeft > 86400) {
      return { value: Math.ceil(secondsLeft / 86400), label: 'Dias Restantes' }
    }
    return { value: formatCountdown(secondsLeft), label: 'Restantes' }
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
    state.data = await getDashboardData(playlistStore.playlists, await loadOccupancy(), await loadEarnings(), await loadExpirations(), await loadUpcomingExpirations(), await loadRecentOrders())
    countdownInterval = setInterval(() => {
      const now = Date.now()
      state.data.expirations.forEach(expiration => {
        expiration.secondsLeft = Math.max(0, Math.floor((expiration.dueTs - now) / 1000))
        expiration.urgent = expiration.secondsLeft <= 86400
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
    <div class="max-w-[1400px] mx-auto p-gutter md:p-lg">
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

        <div class="bg-surface-container-low p-lg rounded-xl flex flex-col gap-xs shadow-sm hover:bg-surface-container transition-colors">
          <div class="flex items-center justify-between">
            <span class="text-label-sm text-on-surface-variant uppercase tracking-widest">Likes no Perfil</span>
            <span class="material-symbols-outlined text-tertiary text-headline-sm">favorite</span>
          </div>
          <div class="flex flex-col">
            <span class="text-display-lg font-display text-on-surface">{{ userStore.getUser?.followers?.total ?? 0 }}</span>
            <div class="flex items-center gap-1 text-on-surface-variant">
              <span class="text-label-sm">Seguidores no Spotify</span>
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

        </div>

        <!-- Right Column: Alerts & Side Widgets (4 Cols) -->
        <div class="col-span-12 lg:col-span-4 flex flex-col gap-lg">
          <!-- Expiration Widget -->
          <div v-if="state.data.expirations.length > 0" class="bg-surface-container-low rounded-xl p-lg flex flex-col gap-md border border-outline-variant/10 relative overflow-hidden shadow-xl">
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
                    >{{ formatExpiration(expiration.secondsLeft).value }}</span>
                    <span class="text-[10px] text-on-surface-variant uppercase">{{ formatExpiration(expiration.secondsLeft).label }}</span>
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

          <!-- Upcoming Expirations Widget -->
          <div v-if="state.data.upcomingExpirations.length > 0" class="bg-surface-container-low rounded-xl p-lg flex flex-col gap-md border border-outline-variant/10 relative overflow-hidden shadow-xl">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-secondary">event_upcoming</span>
              <h3 class="text-headline-sm font-display text-on-surface">Próximas Expirações</h3>
            </div>
            <div class="flex flex-col gap-4">
              <div
                v-for="expiration in state.data.upcomingExpirations"
                :key="expiration.id"
                class="p-4 bg-surface-container rounded-xl flex flex-col gap-3 transition-all hover:bg-surface-container-high border border-outline-variant/10"
              >
                <div class="flex justify-between items-start gap-3">
                  <div class="flex gap-3 min-w-0">
                    <div
                      class="w-10 h-10 rounded flex items-center justify-center flex-shrink-0 bg-on-surface-variant/10 text-on-surface-variant"
                    >
                      <span class="material-symbols-outlined font-bold">{{ expiration.icon }}</span>
                    </div>
                    <div class="flex flex-col min-w-0">
                      <span class="text-body-md font-bold text-on-surface truncate">{{ expiration.title }}</span>
                      <span class="text-label-sm text-on-surface-variant truncate">{{ expiration.subtitle }}</span>
                    </div>
                  </div>
                  <div class="flex flex-col items-end flex-shrink-0">
                    <span class="text-label-sm font-mono tracking-tighter text-on-surface">{{ formatExpiration(expiration.secondsLeft).value }}</span>
                    <span class="text-[10px] text-on-surface-variant uppercase">{{ formatExpiration(expiration.secondsLeft).label }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent Orders Widget -->
          <div class="bg-surface-container-low rounded-xl p-lg border border-outline-variant/10 flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <span class="text-label-sm text-on-surface-variant uppercase tracking-widest">Pedidos Recentes</span>
            </div>
            <div class="flex flex-col gap-3">
              <div
                v-for="order in state.data.recentOrders"
                :key="order.id"
                class="flex items-center justify-between gap-3 p-3 bg-surface-container rounded-xl border border-outline-variant/10 hover:border-primary/30 transition-all"
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
                <div class="flex flex-col items-end flex-shrink-0">
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
      </div>
    </div>
  </div>
</template>
