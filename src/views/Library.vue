<script setup>
  import { onMounted, computed, reactive, ref, inject } from 'vue'
  import { useRouter } from 'vue-router'
  import { useProfile } from '@/support/spotifyApi'
  import helpers from '../support/helpers'
  import { LOCALSTORAGE_KEYS } from '../support/helpers'
  import { usePlaylistStore } from '@/stores/playlist'
  import { useUserStore } from '../stores/user'
  import { PlaylistService } from '../services/PlaylistService'

  const { getPlaylists } = useProfile()
  const router = useRouter()
  const playlistStore = usePlaylistStore()
  const userStore = useUserStore()
  const { loadAllFromDatabase } = PlaylistService()
  const progress = inject("progress")

  const FILTERS = [
    { key: 'all', label: 'Todas' },
    { key: 'minhas', label: 'Minhas' },
    { key: 'public', label: 'Públicas' },
    { key: 'private', label: 'Privadas' },
    { key: 'curadoria', label: 'Curadoria' }
  ]

  const state = reactive({
    playlistsOriginal: [],
    playlists: [],
    trackedIds: []
  })

  const activeFilter = ref('all')
  const isLoading = ref(true)

  const currentUser = computed(() => {
    return userStore.getUser
  })

  const isOwnPlaylist = (playlist) => {
    return playlist.owner?.display_name === currentUser.value?.display_name
  }

  const filterPlaylists = (value = 'all') => {
    activeFilter.value = value
    helpers.setLocalStorage(LOCALSTORAGE_KEYS.filterLibrary, value)

    let list = state.playlistsOriginal
    if (value === 'minhas') {
      list = state.playlistsOriginal.filter(isOwnPlaylist)
    } else if (value === 'public') {
      list = state.playlistsOriginal.filter(playlist => playlist.public !== false)
    } else if (value === 'private') {
      list = state.playlistsOriginal.filter(playlist => playlist.public === false)
    } else if (value === 'curadoria') {
      list = state.playlistsOriginal.filter(playlist => isOwnPlaylist(playlist) && playlist.tracked)
    }
    state.playlists = list
  }

  const openPlaylist = (playlistId) => {
    router.push('/playlist/' + playlistId)
  }

  const sortPlaylists = (playlists) => {
    return playlists.sort((a, b) => {
      if (a.order === null || a.order === undefined) return 1
      if (b.order === null || b.order === undefined) return -1
      return a.order - b.order
    })
  }

  const loadLibrary = async () => {
    const dbPlaylists = await loadAllFromDatabase()
    if (!playlistStore.isLoaded) {
      playlistStore.loadAll(dbPlaylists)
    }
    state.trackedIds = dbPlaylists.map(playlist => playlist.id)
    const trackedSet = new Set(state.trackedIds)

    const spotifyPlaylists = (await getPlaylists()).filter(Boolean)
    state.playlistsOriginal = sortPlaylists(spotifyPlaylists.map(playlist => ({
      ...playlist,
      tracked: trackedSet.has(playlist.id)
    })))

    const { filterLibrary } = helpers.getLocalStorage()
    filterPlaylists(filterLibrary === null ? 'all' : filterLibrary)
  }

  onMounted(async () => {
    progress.start()
    try {
      await loadLibrary()
    } catch (error) {
      console.error(error)
      state.playlistsOriginal = sortPlaylists([...playlistStore.playlists])
      state.playlists = state.playlistsOriginal
    } finally {
      isLoading.value = false
      progress.finish()
    }
  })
</script>

<template>
  <div class="page px-gutter md:px-lg py-md space-y-lg">
    <!-- Header Section -->
    <section class="relative flex flex-col gap-md pt-2 pb-sm">
      <div class="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div class="flex flex-wrap items-center justify-between gap-4 relative">
        <div class="flex items-center gap-3">
          <h1 class="text-headline-lg md:text-display-lg text-on-surface">Biblioteca</h1>
          <span class="px-2 py-0.5 bg-surface-container-high rounded text-label-sm text-on-surface-variant">
            {{ state.playlists.length }} Playlists
          </span>
        </div>
        <nav class="flex gap-2 flex-wrap">
          <button
            v-for="filter in FILTERS"
            :key="filter.key"
            class="px-4 py-1.5 rounded-full text-label-sm transition-colors"
            :class="activeFilter === filter.key
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'hover:bg-surface-container-high text-on-surface-variant'"
            @click="filterPlaylists(filter.key)"
          >
            {{ filter.label }}
          </button>
        </nav>
      </div>
    </section>

    <!-- Playlists Grid -->
    <section>
      <div v-if="isLoading" class="flex items-center justify-center gap-3 py-20 text-on-surface-variant text-body-sm">
        <font-awesome-icon icon="spinner" spin class="text-primary" />
        <span>Carregando playlists...</span>
      </div>
      <div v-else-if="state.playlists.length === 0" class="py-20 text-center text-on-surface-variant text-body-sm">
        Nenhuma playlist nesta categoria.
      </div>
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-gutter md:gap-md">
        <article
          v-for="playlist in state.playlists"
          :key="playlist.id"
          class="bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/10 shadow-sm hover:bg-surface-container hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 transition-all cursor-pointer group"
          @click="openPlaylist(playlist.id)"
        >
          <div class="relative aspect-square overflow-hidden bg-surface-container">
            <img
              v-if="playlist.images?.length > 0 ? playlist.images[0]?.url : playlist.image"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              :src="playlist.images?.length > 0 ? playlist.images[0]?.url : playlist.image"
            />
            <div v-else class="w-full h-full bg-gradient-to-br from-primary-container to-secondary-container opacity-40"></div>
            <div
              class="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
              :class="playlist.tracked ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant/60'"
              :title="playlist.tracked ? 'Trackeada no Supabase' : 'Não trackeada'"
            >
              <font-awesome-icon :icon="playlist.tracked ? 'check-circle' : 'circle'" class="text-[16px]" />
            </div>
          </div>
          <div class="p-3 md:p-4 flex flex-col gap-1">
            <h3 class="text-body-md font-bold text-on-surface truncate">{{ playlist.name }}</h3>
            <p class="text-label-sm text-on-surface-variant truncate">by @{{ playlist.owner?.display_name }}</p>
            <div class="flex items-center justify-between pt-1">
              <span class="text-label-sm text-on-surface-variant">{{ playlist.tracks ? (playlist.tracks.total || playlist.tracks.length) : playlist.items }} músicas</span>
              <font-awesome-icon
                :icon="playlist.public === false ? 'lock' : 'unlock-alt'"
                class="text-on-surface-variant/60"
                :title="playlist.public === false ? 'Privada' : 'Pública'"
              />
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
</style>
