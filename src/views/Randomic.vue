<script setup>
import { onMounted, computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useProfile, useGeneral } from '@/support/spotifyApi'
import { useUserStore } from '@/stores/user'
import { usePlaylistStore } from '@/stores/playlist'
import { NOTIFICATIONS_TYPE } from '../support/helpers'
import { notify } from "@kyvg/vue3-notification"

const { getPlaylists, executePlaylist, getPlaybackState, getDevices, transferPlayback, skipToNext, startResumePlayback, addTrackToQueue, getTopItens } = useProfile()
const { getTracks, addTracksToPlaylist, savePlaylist } = useGeneral()

const userStore = useUserStore()
const playlistStore = usePlaylistStore()
const router = useRouter()

const state = reactive({
  isProcessing: false,
  processingStart: 0,
  processingEnd: 0,
  isPlaying: false,
  randomPlaylist: null,
  playlistName: 'Random Playlist',
  playlistsOriginal: [],
  playlists: [],
  tracks: [],
  devices: [],
  numberTracks: 50,
  user: null,
  message: '',
  filters: ['all'],
  pickMode: 'random',
  orderMode: 'top'
})

const step = ref(1) // 1 = Configura, 2 = Resultado

const emit = defineEmits(['update-step-data'])

const props = defineProps({
  stepData: {
    type: Number,
    default: 1
  }
})

// Watch internal step and emit to parent (for TopBar breadcrumb)
watch(step, (newVal) => {
  emit('update-step-data', newVal)
})

const getUserPlaylists = async () => {
  state.isProcessing = true
  if (!playlistStore.isLoaded) {
    const playlists = await getPlaylists()
    playlistStore.loadAll(playlists)
  }
  state.playlistsOriginal = playlistStore.playlists
  state.playlistsOriginal.forEach(item => item.checked = false)
  filterPlaylists()
  state.isProcessing = false
}

const getRandomInt = (min, max) => {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min)) + min
}

const pickTracksRandom = async (allTracks) => {
  const tracksToPick = state.numberTracks
  const tracks = []
  const maxPicks = Math.min(tracksToPick, allTracks.length)
  while (tracks.length < maxPicks) {
    const random = getRandomInt(0, allTracks.length)
    const track = allTracks[random]
    if (track && !tracks.some(t => t.id === track.id)) {
      tracks.push(track)
    }
  }
  state.tracks = tracks
}

const getPlaylistTracks = async (playlistId) => {
  let tracks = await playlistStore.getTracks(playlistId)
  if (tracks.length === 0) {
    tracks = await getTracks(playlistId)
    playlistStore.loadTracks(playlistId, tracks)
    tracks = await playlistStore.getTracks(playlistId)
  }
  tracks.forEach(item => {
    if (item.track) {
      item.track.checked = true
      state.tracks.push(item.track)
    }
  })
}

const getUserTopItems = async () => {
  const { data } = await getTopItens(state.numberTracks)
  data.items.forEach(item => {
    item.checked = true
    state.tracks.push(item)
  })
  if (state.orderMode === 'bottom') {
    state.tracks.reverse()
  }
}

const filterPopTracks = () => {
  if (state.orderMode === 'top') {
    state.tracks.sort((a, b) => b.popularity - a.popularity)
    state.tracks = state.tracks.slice(0, state.numberTracks)
    return
  }
  state.tracks.sort((a, b) => a.popularity - b.popularity)
  state.tracks = state.tracks.slice(0, state.numberTracks)
  state.tracks.reverse()
}

const filterPlaylists = (value = 'all') => {
  state.filters = [value]
  switch (value) {
    case 'all':
      state.playlists = state.playlistsOriginal
      break
    case 'liked':
      filterPrivatePlaylists(false)
      break
    case 'private':
      filterPrivatePlaylists(true)
      break
    default:
      break
  }
}

const filterPrivatePlaylists = (value = true) => {
  state.playlists.forEach(item => item.checked = false)
  if (value) {
    state.playlists = state.playlistsOriginal.filter(
      playlist => playlist.owner.display_name === state.user.display_name
    )
    return
  }
  state.playlists = state.playlistsOriginal.filter(
    playlist => playlist.owner.display_name !== state.user.display_name
  )
}

const selectAllPlaylists = () => {
  const selected = state.playlists.filter(item => item.checked)
  const check = selected.length < state.playlists.length
  state.playlists.forEach(item => item.checked = check)
}

const generatePlaylist = async () => {
  const selectedCount = state.playlists.filter(p => p.checked).length
  if (selectedCount < 1) {
    notify({ title: 'Ops', text: 'Selecione ao menos uma origem', type: NOTIFICATIONS_TYPE.danger })
    return
  }
  if (state.numberTracks < 1) {
    notify({ title: 'Ops', text: 'Defina a quantidade', type: NOTIFICATIONS_TYPE.danger })
    return
  }

  state.isProcessing = true
  state.tracks = []
  state.message = 'Gerando playlist...'

  // gather tracks from selected playlists
  const selectedPlaylists = state.playlists.filter(p => p.checked)
  const promises = selectedPlaylists.map(p => getPlaylistTracks(p.id))
  await Promise.all(promises)

  // Apply pick mode
  if (state.pickMode === 'random') {
    await pickTracksRandom(state.tracks)
  } else if (state.pickMode === 'popularity') {
    filterPopTracks()
  } else if (state.pickMode === 'usertopitems') {
    state.tracks = [] // reset, will be filled by getUserTopItems
    await getUserTopItems()
  }

  notify({ title: 'Alright', text: `${state.tracks.length} músicas selecionadas`, type: 'success' })
  state.isProcessing = false
  step.value = 2
}

const saveUserPlaylist = async () => {
  state.isProcessing = true
  try {
    const res = await fetch('https://random-word-api.vercel.app/api?words=1&type=capitalized')
    const data = await res.json()
    state.playlistName = data[0]
  } catch (e) {
    console.log(e)
  }
  const description = 'Playlist created by MyRandomicPlaylist App from @evaldorcardoso'
  const formData = {
    name: state.playlistName,
    description,
    public: false
  }
  const userId = state.user.id
  const { data } = await savePlaylist(userId, formData)
  state.randomPlaylist = data
  playlistStore.load(data)
  const message = 'Playlist created successfully!'
  notify({ title: 'Awesome', text: message, type: 'success' })
  // add tracks
  const tracksToAdd = state.tracks.filter(t => t.checked).map(t => t.uri)
  const separar = (items, max) => items.reduce((acc, item, i) => {
    const g = Math.floor(i / max)
    acc[g] = [...(acc[g] || []), item]
    return acc
  }, [])
  const groups = separar(tracksToAdd, 100)
  for (const group of groups) {
    await addTracksToPlaylist(data.id, { uris: group })
  }
  state.isProcessing = false
  router.push('/playlist/' + data.id)
}

const executeUserPlaylist = async () => {
  state.isProcessing = true
  if (!state.randomPlaylist) {
    // fallback: add to queue
    const tracks = state.tracks.filter(t => t.checked).map(t => t.uri)
    for (let i = 0; i < tracks.length; i++) {
      state.processingStart = i + 1
      await new Promise(r => setTimeout(r, 200))
      await addTrackToQueue(tracks[i])
    }
    state.isProcessing = false
    return
  }
  try {
    await executePlaylist({
      context_uri: 'spotify:playlist:' + state.randomPlaylist.id,
      offset: { position: 0 },
      position_ms: 0
    })
    state.isProcessing = false
  } catch (error) {
    console.log(error)
    state.isProcessing = false
    notify({ title: 'Ops', text: error.response, type: NOTIFICATIONS_TYPE.danger })
  }
}

// Computed
const selectedCount = computed(() => state.playlists.filter(p => p.checked).length)
const includedCount = computed(() => state.tracks.filter(t => t.checked).length)

// Pagination
const pageSize = 20
const currentPage = ref(1)
const totalPages = computed(() => Math.ceil(state.tracks.length / pageSize))
const pagedTracks = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return state.tracks.slice(start, start + pageSize)
})

const popularityClass = (pop) => {
  if (pop < 40) return 'text-error'
  if (pop < 70) return 'text-tertiary'
  return 'text-primary'
}

onMounted(async () => {
  state.user = userStore.user
  await getUserPlaylists()
  step.value = 1
  emit('update-step-data', 1)
})
</script>

<template>
  <div class="page">
    <!-- Step 1: Configura -->
    <section v-if="step === 1" class="max-w-[680px] mx-auto px-md py-lg space-y-xl">
      <!-- Header -->
      <header class="sticky top-0 z-10 bg-surface/80 backdrop-blur-sm py-sm border-b border-outline-variant/10">
        <h1 class="text-headline-sm text-on-surface">Mixar Playlist</h1>
        <p class="text-body-sm text-on-surface-variant mt-1">Configure a origem, quantidade e modo de geração</p>
      </header>

      <!-- Origens rápidas -->
      <section>
        <h2 class="text-label-lg text-on-surface mb-md">Origens rápidas</h2>
        <div class="grid grid-cols-2 gap-3">
          <article @click="() => { state.filters = ['liked']; filterPlaylists('liked'); }"
                   class="rounded-xl bg-surface-container-low overflow-hidden border border-outline-variant/10 hover:border-primary/40 transition p-md flex flex-col gap-sm cursor-pointer">
            <span class="material-symbols-outlined text-primary text-4xl">favorite</span>
            <div>
              <h3 class="text-body-md text-on-surface">Liked Songs</h3>
              <p class="text-body-sm text-on-surface-variant">Suas músicas curtidas</p>
            </div>
          </article>
          <article @click="() => { state.pickMode = 'usertopitems'; }"
                   class="rounded-xl bg-surface-container-low overflow-hidden border border-outline-variant/10 hover:border-primary/40 transition p-md flex flex-col gap-sm cursor-pointer">
            <span class="material-symbols-outlined text-primary text-4xl">trending_up</span>
            <div>
              <h3 class="text-body-md text-on-surface">Top Items</h3>
              <p class="text-body-sm text-on-surface-variant">Suas músicas e artistas top</p>
            </div>
          </article>
        </div>
      </section>

      <!-- Suas playlists -->
      <section>
        <h2 class="text-label-lg text-on-surface mb-md">Suas playlists</h2>
        <!-- Filter chips -->
        <div class="flex flex-wrap gap-2 mb-md">
          <button @click="filterPlaylists('all')" class="rounded-full bg-surface-container-high px-md py-1 text-label-md hover:bg-primary/15 transition" :class="{ 'bg-primary text-on-primary': state.filters[0] === 'all' }">All</button>
          <button @click="filterPlaylists('private')" class="rounded-full bg-surface-container-high px-md py-1 text-label-md hover:bg-primary/15 transition" :class="{ 'bg-primary text-on-primary': state.filters[0] === 'private' }">My</button>
          <button @click="filterPlaylists('liked')" class="rounded-full bg-surface-container-high px-md py-1 text-label-md hover:bg-primary/15 transition" :class="{ 'bg-primary text-on-primary': state.filters[0] === 'liked' }">Liked</button>
          <button @click="selectAllPlaylists" class="rounded-full bg-surface-container-high px-md py-1 text-label-md hover:bg-primary/15 transition">Select all</button>
        </div>
        <!-- Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <article v-for="playlist in state.playlists" :key="playlist.id"
                   @click="playlist.checked = !playlist.checked"
                   class="rounded-xl bg-surface-container-low overflow-hidden border border-outline-variant/10 hover:border-primary/40 transition cursor-pointer relative"
                   :class="{ 'ring-2 ring-primary bg-primary/10': playlist.checked }">
            <img :src="playlist.images?.length > 0 ? playlist.images[0].url : 'https://via.placeholder.com/150'" class="aspect-square w-full bg-surface-container-high object-cover" />
            <div class="p-sm">
              <h4 class="text-label-md text-on-surface truncate">{{ playlist.name }}</h4>
              <p class="text-label-sm text-on-surface-variant truncate">{{ playlist.tracks?.total || playlist.tracks?.length || playlist.items || 0 }} songs</p>
            </div>
            <div v-if="playlist.checked" class="absolute inset-0 bg-primary/10 flex items-center justify-center">
              <span class="material-symbols-outlined text-primary">check_circle</span>
            </div>
          </article>
        </div>
      </section>

      <!-- Quantidade -->
      <section>
        <h2 class="text-label-lg text-on-surface mb-md">Quantidade</h2>
        <div class="flex items-center gap-md mb-md">
          <input type="range" v-model="state.numberTracks" min="1" max="200" class="flex-1 accent-primary" />
          <span class="text-display-sm text-on-surface tabular-nums w-16 text-right">{{ state.numberTracks }}</span>
        </div>
        <div class="grid grid-cols-5 gap-2">
          <button v-for="n in [10,20,30,50,100]" :key="n" @click="state.numberTracks = n"
                  class="rounded-full bg-surface-container-high px-md py-1 text-label-md hover:bg-primary/15 transition"
                  :class="{ 'bg-primary text-on-primary': state.numberTracks === n }">{{ n }}</button>
        </div>
      </section>

      <!-- Modo de geração -->
      <section>
        <h2 class="text-label-lg text-on-surface mb-md">Como as músicas serão escolhidas?</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <article @click="state.pickMode = 'random'" class="rounded-xl p-md border border-outline-variant/10 flex flex-col gap-sm cursor-pointer transition" :class="{ 'border-primary bg-primary/5': state.pickMode === 'random' }">
            <span class="material-symbols-outlined text-3xl" :class="state.pickMode === 'random' ? 'text-primary' : 'text-on-surface-variant'">shuffle</span>
            <span class="text-body-md text-on-surface text-center">Random</span>
          </article>
          <article @click="state.pickMode = 'popularity'" class="rounded-xl p-md border border-outline-variant/10 flex flex-col gap-sm cursor-pointer transition" :class="{ 'border-primary bg-primary/5': state.pickMode === 'popularity' }">
            <span class="material-symbols-outlined text-3xl" :class="state.pickMode === 'popularity' ? 'text-primary' : 'text-on-surface-variant'">trending_up</span>
            <span class="text-body-md text-on-surface text-center">By popularity</span>
          </article>
          <article @click="state.pickMode = 'usertopitems'" class="rounded-xl p-md border border-outline-variant/10 flex flex-col gap-sm cursor-pointer transition" :class="{ 'border-primary bg-primary/5': state.pickMode === 'usertopitems' }">
            <span class="material-symbols-outlined text-3xl" :class="state.pickMode === 'usertopitems' ? 'text-primary' : 'text-on-surface-variant'">mood</span>
            <span class="text-body-md text-on-surface text-center">User top items</span>
          </article>
        </div>
      </section>

      <!-- Modo de ordenação (conditional) -->
      <section v-if="state.pickMode === 'popularity' || state.pickMode === 'usertopitems'">
        <h2 class="text-label-lg text-on-surface mb-md">Como as músicas serão ordenadas?</h2>
        <div class="grid grid-cols-2 gap-3">
          <article @click="state.orderMode = 'top'" class="rounded-xl p-md border border-outline-variant/10 flex flex-col gap-sm cursor-pointer transition" :class="{ 'border-primary bg-primary/5': state.orderMode === 'top' }">
            <span class="material-symbols-outlined text-3xl" :class="state.orderMode === 'top' ? 'text-primary' : 'text-on-surface-variant'">vertical_align_top</span>
            <span class="text-body-md text-on-surface text-center">Top first</span>
          </article>
          <article @click="state.orderMode = 'bottom'" class="rounded-xl p-md border border-outline-variant/10 flex flex-col gap-sm cursor-pointer transition" :class="{ 'border-primary bg-primary/5': state.orderMode === 'bottom' }">
            <span class="material-symbols-outlined text-3xl" :class="state.orderMode === 'bottom' ? 'text-primary' : 'text-on-surface-variant'">vertical_align_bottom</span>
            <span class="text-body-md text-on-surface text-center">Top last</span>
          </article>
        </div>
      </section>

      <!-- Nome da playlist -->
      <section>
        <h2 class="text-label-lg text-on-surface mb-md">Nome da playlist</h2>
        <input type="text" v-model="state.playlistName"
               class="w-full rounded-xl bg-surface-container-low px-md py-2 text-body-md text-on-surface border border-outline-variant/10 focus:border-primary focus:outline-none"
               placeholder="Random Playlist" />
      </section>

      <!-- Bottom bar (Step 1) -->
      <div class="fixed bottom-20 lg:bottom-16 left-0 right-0 mx-xl rounded-2xl bg-surface-container-low/95 backdrop-blur-md border border-outline-variant/10 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.4)] p-md flex items-center justify-between">
        <div class="text-label-md text-on-surface-variant">
          {{ selectedCount }} origens · {{ state.numberTracks }} músicas · {{ state.pickMode === 'random' ? 'Random' : state.pickMode === 'popularity' ? 'Popularity' : 'Top items' }}
        </div>
        <button @click="generatePlaylist"
                :disabled="selectedCount < 1 || state.numberTracks < 1"
                class="flex items-center gap-2 px-lg py-sm rounded-xl font-medium transition"
                :class="selectedCount < 1 || state.numberTracks < 1
                  ? 'bg-surface-container-high text-on-surface-variant/40 cursor-not-allowed'
                  : 'bg-primary text-on-primary hover:bg-primary/90'">
          <span class="material-symbols-outlined">auto_awesome</span>
          Generate
        </button>
      </div>
      <p v-if="(selectedCount < 1 || state.numberTracks < 1)" class="text-label-sm text-on-surface-variant px-md fixed bottom-12 lg:bottom-8 left-0 right-0 mx-xl text-center">
        {{ selectedCount < 1 ? 'Selecione ao menos uma origem' : 'Defina a quantidade' }}
      </p>

    </section>

    <!-- Step 2: Resultado -->
    <section v-else class="max-w-[680px] mx-auto px-md py-lg space-y-lg">
      <!-- Header -->
      <header class="h-14 rounded-2xl bg-surface-container-low border border-outline-variant/10 flex items-center justify-between px-md sticky top-0 z-10">
        <button @click="() => { state.tracks = []; step.value = 1; }" class="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition" title="Regenerar">
          <span class="material-symbols-outlined">restart_alt</span>
        </button>
        <div class="text-body-md text-on-surface">{{ includedCount }} de {{ state.tracks.length }} tracks</div>
        <button @click="executeUserPlaylist" class="p-2 rounded-lg text-primary hover:text-primary/80 hover:bg-primary/10 transition" title="Executar">
          <span class="material-symbols-outlined">play_circle</span>
        </button>
      </header>

      <!-- Loading skeleton -->
      <div v-if="state.isProcessing" class="space-y-3">
        <template v-for="n in 10" :key="n">
          <div class="animate-pulse flex items-center gap-3 p-3 bg-surface-container-high rounded-lg">
            <div class="w-10 h-10 rounded-lg bg-surface-container-highest"></div>
            <div class="flex-1 space-y-1">
              <div class="h-4 w-3/4 bg-surface-container-highest rounded"></div>
              <div class="h-3 w-1/2 bg-surface-container-highest rounded"></div>
            </div>
            <div class="w-16 h-4 bg-surface-container-highest rounded"></div>
          </div>
        </template>
      </div>

      <!-- Track table -->
      <div v-else-if="state.tracks.length > 0">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr class="bg-surface-container-low/50">
                <th class="px-4 py-3 text-label-sm text-on-surface-variant uppercase tracking-wider w-12">
                  <span class="material-symbols-outlined">check_box</span>
                </th>
                <th class="px-4 py-3 text-label-sm text-on-surface-variant uppercase tracking-wider w-12">#</th>
                <th class="px-4 py-3 text-label-sm text-on-surface-variant uppercase tracking-wider">Título / Artista</th>
                <th class="px-4 py-3 text-label-sm text-on-surface-variant uppercase tracking-wider text-center">Popularidade</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/10">
              <tr v-for="(track, idx) in pagedTracks" :key="track.id ?? idx"
                  class="hover:bg-surface-container-high/30 transition-colors">
                <td class="px-4 py-3">
                  <input type="checkbox" v-model="track.checked" class="w-5 h-5 accent-primary" />
                </td>
                <td class="px-4 py-3 text-body-sm text-on-surface-variant">{{ (currentPage - 1) * pageSize + idx + 1 }}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <img :src="track.album?.images?.[0]?.url || 'https://via.placeholder.com/40'" class="w-10 h-10 rounded-md object-cover" />
                    <div class="min-w-0">
                      <span class="block truncate text-body-md text-on-surface">{{ track.name }}</span>
                      <span class="block truncate text-body-sm text-on-surface-variant">{{ track.artists?.[0]?.name }}</span>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <span class="material-symbols-outlined" :class="popularityClass(track.popularity)">trending_up</span>
                    <span class="text-label-sm text-on-surface-variant">{{ track.popularity }}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="flex items-center justify-center gap-4 mt-4">
          <button @click="currentPage--" :disabled="currentPage <= 1" class="p-2 rounded-lg bg-surface-container-highest text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition">
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <span class="text-label-md text-on-surface-variant">Página {{ currentPage }} de {{ totalPages }}</span>
          <button @click="currentPage++" :disabled="currentPage >= totalPages" class="p-2 rounded-lg bg-surface-container-highest text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition">
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="flex flex-col items-center justify-center py-20 px-md text-center">
        <span class="material-symbols-outlined text-on-surface-variant/40 text-6xl mb-4">queue_music</span>
        <h3 class="text-headline-sm text-on-surface mb-2">Nenhuma origem disponível</h3>
        <p class="text-body-sm text-on-surface-variant mb-4">Não conseguimos carregar playlists, Liked Songs ou Top Items.</p>
        <button @click="getUserPlaylists" class="bg-primary text-on-primary px-lg py-sm rounded-xl">Refresh</button>
      </div>

      <!-- Bottom bar (Step 2) -->
      <div class="fixed bottom-20 lg:bottom-16 left-0 right-0 mx-xl rounded-2xl bg-surface-container-low/95 backdrop-blur-md border border-outline-variant/10 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.4)] p-md flex items-center justify-between">
        <div class="text-label-md text-on-surface-variant">{{ includedCount }} tracks incluídas</div>
        <button @click="saveUserPlaylist" :disabled="state.isProcessing"
                class="px-lg py-sm rounded-xl font-medium bg-primary text-on-primary hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed">
          Save
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* No scoped styles needed; all styling via Tailwind utility classes */
</style>
