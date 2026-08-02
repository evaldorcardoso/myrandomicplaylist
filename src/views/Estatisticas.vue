<script setup>
  import { onMounted, computed, ref, inject } from 'vue'
  import { useRouter } from 'vue-router'
  import { Line } from 'vue-chartjs'
  import Notification from '@/components/Notification.vue'
  import { usePlaylistData } from '@/composables/usePlaylistData'

  const router = useRouter()
  const progress = inject('progress')

  const callbacks = {}
  const pd = usePlaylistData(callbacks)

  const {
    state,
    playlistId,
    notificationOpened,
    notificationData,
    onNotificationAction,
    init,
    executeUserPlaylist,
    avgPopularity,
    topArtists,
    genres,
    hasTodayStatistics,
    saveLikesStatistics
  } = pd

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
      type: Object,
      default: () => { }
    }
  })

  const currentPlaying = computed(() => props.currentData)
  const likesRange = ref('90D')

  const formatNumber = (value) => {
    if (value == null) return '0'
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  const rangeDays = computed(() => {
    const map = { '90D': 90, '30D': 30, '7D': 7 }
    return map[likesRange.value] ?? 90
  })

  const rangeChartData = computed(() => {
    const now = new Date()
    const cutoff = new Date(now.getTime() - rangeDays.value * 86400000)
    const filtered = state.dataLikes.filter(row => new Date(row.created_at) >= cutoff)
    const labels = filtered.map(row => new Date(row.created_at).toLocaleDateString())
    const values = filtered.map(row => row.likes_count)
    return {
      labels,
      datasets: [
        {
          label: 'Likes',
          backgroundColor: 'rgba(83, 224, 118, 0.15)',
          borderColor: '#53e076',
          borderWidth: 2,
          pointRadius: 5,
          pointBackgroundColor: '#53e076',
          pointBorderColor: '#131313',
          pointBorderWidth: 2,
          fill: true,
          tension: 0.4,
          data: values
        }
      ]
    }
  })

  const followersTrend = computed(() => {
    const now = new Date()
    const cutoff = new Date(now.getTime() - rangeDays.value * 86400000)
    const rows = state.dataLikes.filter(row => new Date(row.created_at) >= cutoff)
    if (rows.length < 2) return 0
    const first = rows[0]?.likes_count ?? 0
    const last = rows[rows.length - 1]?.likes_count ?? 0
    return Number(last) - Number(first)
  })

  const chartOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#bccbb9', maxTicksLimit: 6 }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#bccbb9' }
      }
    }
  }))

  const genreMix = computed(() => {
    const total = genres.value.reduce((sum, g) => sum + (g.count ?? 0), 0)
    if (!total) return []
    return genres.value.slice(0, 5).map(g => ({
      name: g.genre,
      pct: Math.round(((g.count ?? 0) / total) * 100)
    }))
  })

  const artistAvatar = (artist) => {
    if (artist?.images?.length) {
      return artist.images[1]?.url ?? artist.images[0]?.url
    }
    return null
  }

  const backToPlaylist = () => {
    router.push(`/playlist/${playlistId.value}`)
  }

  const onExternalAnalytics = () => {
    window.open(`https://www.chosic.com/spotify-playlist-analyzer/?plid=${playlistId.value}`)
  }

  onMounted(async () => {
    progress.start()
    await init({ topArtistsLimit: 10 })
    progress.finish()
  })
</script>

<template>
  <Notification
    :open="notificationOpened"
    :data="notificationData"
    @notification-action="onNotificationAction"
  />
  <div v-if="!state.playlist" class="px-gutter md:px-lg py-md">
    <div class="animate-pulse h-8 w-48 rounded bg-surface-container-high"></div>
  </div>
  <div v-else class="page px-gutter md:px-lg py-md space-y-lg">
    <button class="flex items-center gap-2 text-on-surface-variant text-label-sm hover:text-on-surface transition-colors" @click="backToPlaylist">
      <font-awesome-icon icon="chevron-left" />
      Voltar para a playlist
    </button>

    <!-- Header Hero Section -->
    <section class="relative overflow-hidden rounded-xl bg-surface-container-low p-xl border border-outline-variant/10">
      <div class="absolute top-0 right-0 -mt-16 -mr-16 w-96 h-96 bg-primary/10 blur-[120px] rounded-full"></div>
      <div class="relative flex flex-col md:flex-row gap-xl items-start">
        <div class="relative group shrink-0">
          <div class="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"></div>
          <img
            class="relative w-40 h-40 md:w-64 md:h-64 object-cover rounded-xl shadow-2xl border border-outline-variant/20"
            :src="state.playlist?.images ? state.playlist?.images[0]?.url : state.playlist?.image"
          />
          <button
            class="absolute -bottom-6 -right-6 w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform active:scale-95"
            @click="executeUserPlaylist(currentPlaying)"
          >
            <font-awesome-icon :icon="currentPlaying?.is_playing ? 'pause' : 'play'" class="text-on-primary text-[24px]" />
          </button>
        </div>

        <div class="flex-1 flex flex-col pt-4">
          <div class="flex flex-wrap items-center gap-3 mb-2">
            <span class="text-on-surface-variant text-label-sm">
              • {{ state.playlist?.public ? 'Public Visibility' : 'Private Visibility' }}
            </span>
          </div>
          <h1 class="text-headline-lg md:text-display-lg text-on-surface mb-6 leading-none">{{ state.playlist?.name }}</h1>

          <div class="flex flex-wrap items-center gap-4 mb-8">
            <div class="flex -space-x-4">
              <template v-for="artist in topArtists.slice(0, 3)" :key="artist.id">
                <img
                  v-if="artistAvatar(artist)"
                  class="w-14 h-14 rounded-full border-4 border-surface-container-low object-cover"
                  :src="artistAvatar(artist)"
                />
                <div v-else class="w-14 h-14 rounded-full border-4 border-surface-container-low bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                  <font-awesome-icon icon="user" />
                </div>
              </template>
              <div
                v-if="topArtists.length > 3"
                class="w-14 h-14 rounded-full border-4 border-surface-container-low bg-surface-container-high flex items-center justify-center text-primary font-bold"
              >
                +{{ topArtists.length - 3 }}
              </div>
            </div>
            <div class="ml-2 flex-1 min-w-[240px]">
              <p class="text-body-sm text-on-surface-variant">
                {{ state.playlist?.description }}
              </p>
              <p v-if="topArtists.length" class="text-body-sm text-on-surface-variant mt-2">
                Top artists:
                <span class="text-on-surface font-semibold">{{ topArtists.slice(0, 3).map(a => a.name).join(', ') }}</span>
              </p>
            </div>
          </div>

          <div class="flex flex-wrap gap-8 py-6 border-t border-outline-variant/10">
            <div class="flex flex-col">
              <span class="text-label-sm text-on-surface-variant uppercase tracking-tighter">Total Reach</span>
              <span class="text-headline-lg text-primary">
                {{ formatNumber(state.playlist?.followers?.total) }}
                <span v-if="followersTrend !== 0" class="text-headline-sm" :class="followersTrend > 0 ? 'text-primary-fixed-dim/60' : 'text-tertiary'">
                  {{ followersTrend > 0 ? '↑' : '↓' }}{{ formatNumber(Math.abs(followersTrend)) }}
                </span>
              </span>
            </div>
            <div class="flex flex-col">
              <span class="text-label-sm text-on-surface-variant uppercase tracking-tighter">Items</span>
              <span class="text-headline-lg text-on-surface">
                {{ state.tracks.length }}
                <span class="text-headline-sm text-on-surface-variant/40">Tracks</span>
              </span>
            </div>
            <div class="flex flex-col">
              <span class="text-label-sm text-on-surface-variant uppercase tracking-tighter">Popularity Score</span>
              <span class="text-headline-lg text-on-surface">
                {{ avgPopularity }}
                <span class="text-headline-sm text-on-surface-variant/40">%</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Content Grid -->
    <div class="grid grid-cols-12 gap-lg">
      <!-- Left Column: Analytics -->
      <div class="col-span-12 lg:col-span-8 flex flex-col gap-lg">
        <!-- Likes Growth Chart -->
        <div class="bg-surface-container p-lg rounded-xl flex flex-col gap-md">
          <div class="flex flex-wrap justify-between items-center gap-4">
            <div class="flex flex-col">
              <h3 class="text-headline-sm text-on-surface">Likes Statistics</h3>
              <p class="text-body-sm text-on-surface-variant">Growth performance over the last 90 days</p>
            </div>
            <div class="flex gap-2 bg-surface-container-lowest p-1 rounded-lg">
              <button
                v-for="range in ['90D', '30D', '7D']"
                :key="range"
                class="px-4 py-2 rounded-md text-label-sm transition-colors"
                :class="likesRange === range ? 'bg-surface-container-high text-on-surface' : 'hover:bg-surface-container-high text-on-surface-variant'"
                @click="likesRange = range"
              >
                {{ range }}
              </button>
            </div>
          </div>
          <div class="h-80 w-full mt-4 relative">
            <Line
              v-if="rangeChartData.datasets[0]?.data?.length"
              :data="rangeChartData"
              :options="chartOptions"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-on-surface-variant text-body-sm">
              Sem dados suficientes para este período.
            </div>
          </div>
        </div>

        <!-- Top 5 Artistas -->
        <div id="top-artists" class="bg-surface-container p-lg rounded-xl flex flex-col gap-md mt-lg">
          <div class="flex flex-col mb-4">
              <h3 class="text-headline-sm text-on-surface">Top 5 Artistas</h3>
            <p class="text-body-sm text-on-surface-variant">Artistas mais frequentes nesta playlist</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="(artist, i) in topArtists"
              :key="artist.id"
              class="flex items-center gap-4 p-3 rounded-lg bg-surface-container-low border border-outline-variant/10 hover:bg-surface-container-high transition-colors"
            >
              <span class="text-label-md text-primary w-6">#{{ i + 1 }}</span>
              <div class="w-10 h-10 rounded-full bg-surface-container-highest overflow-hidden shrink-0 flex items-center justify-center">
                <img v-if="artistAvatar(artist)" :src="artistAvatar(artist)" class="w-full h-full object-cover" />
                <font-awesome-icon v-else icon="user" class="text-on-surface-variant" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="text-body-md font-semibold text-on-surface truncate">{{ artist.name }}</span>
                <span class="text-label-sm text-on-surface-variant">{{ artist.count }} músicas</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Right Column: Actions & Widgets -->
      <div class="col-span-12 lg:col-span-4 flex flex-col gap-lg">
        <!-- Management Panel -->
        <div class="bg-surface-container-high p-lg rounded-xl border border-primary/10 shadow-xl">
          <div class="flex items-center gap-3 mb-8">
            <font-awesome-icon icon="cog" class="text-primary" />
            <h3 class="text-headline-sm text-on-surface">Management</h3>
          </div>
          <div class="flex flex-col gap-3">
            <button class="w-full group bg-primary text-on-primary px-6 py-4 rounded-xl flex items-center justify-between hover:brightness-110 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100" :disabled="hasTodayStatistics" @click="saveLikesStatistics">
              <div class="flex items-center gap-4">
                <font-awesome-icon icon="save" class="group-hover:rotate-180 transition-transform duration-500" />
                <span class="text-body-md">{{ hasTodayStatistics ? 'Estatística salva hoje' : 'Salvar estatística de likes' }}</span>
              </div>
              <font-awesome-icon icon="chevron-right" />
            </button>
            <div class="my-4 border-t border-outline-variant/10"></div>
            <button class="w-full group bg-secondary-container/20 text-secondary border border-secondary/20 px-6 py-4 rounded-xl flex items-center justify-between hover:bg-secondary-container/30 transition-all" @click="onExternalAnalytics">
              <div class="flex items-center gap-4">
                <font-awesome-icon icon="chart-line" />
                <span class="text-body-md">External Analytics</span>
              </div>
              <font-awesome-icon icon="external-link-alt" class="text-sm" />
            </button>
          </div>
        </div>

        <!-- Top Genre Mix -->
        <div class="bg-surface-container p-lg rounded-xl flex flex-col">
          <h3 class="text-headline-sm text-on-surface mb-6">Top Genre Mix</h3>
          <div class="flex flex-col gap-4">
            <div v-for="genre in genreMix" :key="genre.name" class="space-y-1">
              <div class="flex justify-between text-label-sm">
                <span class="text-on-surface">{{ genre.name }}</span>
                <span class="text-primary">{{ genre.pct }}%</span>
              </div>
              <div class="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                <div class="bg-primary h-full rounded-full" :style="{ width: genre.pct + '%' }"></div>
              </div>
            </div>
            <p v-if="genreMix.length === 0" class="text-body-sm text-on-surface-variant">
              Nenhum gênero disponível ainda.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
