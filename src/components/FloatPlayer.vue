<script setup>
import { computed, ref } from "vue";
import { useRoute } from 'vue-router'
import { useProfile } from '@/support/spotifyApi'
import { useUserStore } from '@/stores/user'
import { useNowPlaying } from '@/composables/useNowPlaying'
import { formatDuration, formatReleaseDate, progressPercent } from '@/support/playbackFormat'
import AddToPlaylistModal from '@/components/AddToPlaylistModal.vue'
import SellSlotModal from '@/components/SellSlotModal.vue'

const { startResumePlayback, pausePlayback } = useProfile()
const { nowPlaying, rawTrack, position, refresh } = useNowPlaying()
const userStore = useUserStore()

const route = useRoute()

const addToPlaylistOpen = ref(false)
const sellSlotOpened = ref(false)
const sellSlotData = ref(null)

const isTracked = computed(() => {
    return !!userStore.getTrack(nowPlaying.value?.track?.id)
})

const releaseDate = computed(() => formatReleaseDate(nowPlaying.value?.track?.release_date))

const elapsedTime = computed(() => formatDuration(position.value))
const totalTime = computed(() => formatDuration(nowPlaying.value?.duration))
const progressPerc = computed(() => progressPercent(position.value, nowPlaying.value?.duration))

// Play/pause seguem via REST (os controles locais do SDK ficam para #71); a
// fonte compartilhada se atualiza sozinha pelo evento do SDK ou pela releitura.
const toggleUserPlayback = async () => {
    try {
        if (nowPlaying.value?.playing) {
            await pausePlayback()
        } else {
            await startResumePlayback()
        }
    } catch (error) {
        console.error('Falha ao alternar a reprodução:', error)
    } finally {
        await refresh()
    }
}

const openAddToPlaylist = () => {
    addToPlaylistOpen.value = true
}

const onCloseAddToPlaylist = () => {
    addToPlaylistOpen.value = false
}

const onSellSlot = (data) => {
    addToPlaylistOpen.value = false
    sellSlotData.value = data
    sellSlotOpened.value = true
}

const onCloseSellSlot = () => {
    sellSlotOpened.value = false
    sellSlotData.value = null
}
</script>

<template>    
    <div class="fixed bottom-0 left-0 lg:left-56 right-0 z-30" v-if="nowPlaying && route.name != 'Player'">
        <div class="relative h-20 bg-surface-container-lowest/95 backdrop-blur-2xl border-t border-outline-variant/10 px-gutter md:px-10 flex items-center justify-between gap-4">
            <div class="flex items-center gap-4 flex-1 md:w-1/3 min-w-0">
                <router-link to="/player" class="h-20 w-20 rounded bg-surface-container-highest overflow-hidden flex-shrink-0 border border-outline-variant/20">
                    <img class="w-full h-full object-cover" v-bind:src="nowPlaying.track?.image" />
                </router-link>
                <router-link to="/player" class="flex flex-col min-w-0">
                    <h3 class="text-[12px] md:text-body-md font-bold text-on-surface truncate leading-tight"><font-awesome-icon v-if="isTracked" icon="heart" style="vertical-align:middle;margin-right:5px;color: rgb(30, 215, 96);" />{{ nowPlaying.track?.name }}</h3>
                    <span class="text-[11px] md:text-label-sm text-on-surface-variant truncate leading-tight">{{ nowPlaying.track?.artists?.join(', ') }}</span>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="flex items-center gap-1 text-[9px] md:text-[10px] text-primary font-bold uppercase tracking-widest"><font-awesome-icon icon="chart-line" />{{ nowPlaying.track?.popularity }}</span>
                    </div>
                    <span class="text-[11px] md:text-label-sm text-on-surface-variant truncate leading-tight">{{ releaseDate }}</span>
                </router-link>
            </div>

            <div class="hidden md:flex items-center justify-center w-1/3">
                <div class="flex items-center gap-3 w-full">
                    <button
                        class="w-10 h-10 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0 hover:scale-105 active:scale-95 transition-all"
                        :class="nowPlaying.playing ? 'opacity-90' : 'opacity-100'"
                        @click="toggleUserPlayback()"
                    >
                        <span class="material-symbols-outlined">{{ nowPlaying.playing ? 'pause' : 'play_arrow' }}</span>
                    </button>
                    <div class="flex-1 flex items-center gap-2 min-w-0">
                        <span class="text-[10px] text-on-surface-variant tabular-nums">{{ elapsedTime }}</span>
                        <div class="flex-1 h-1 bg-surface-container-highest rounded-full overflow-hidden">
                            <div class="h-full bg-primary transition-[width] duration-100" :style="{ width: progressPerc + '%' }"></div>
                        </div>
                        <span class="text-[10px] text-on-surface-variant tabular-nums">{{ totalTime }}</span>
                    </div>
                </div>
            </div>

            <div class="flex items-center justify-end gap-2 w-1/4 md:w-1/3">
                <button class="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-container-high" @click="openAddToPlaylist">
                    <span class="material-symbols-outlined">playlist_add</span>
                    <span class="text-label-sm font-bold hidden md:inline">Add to Playlist</span>
                </button>
                <router-link to="/player" class="text-on-surface-variant hover:text-on-surface transition-colors p-2">
                    <span class="material-symbols-outlined">open_in_full</span>
                </router-link>
            </div>
        </div>
    </div>   
    <AddToPlaylistModal
        :open="addToPlaylistOpen"
        :track="rawTrack"
        @close="onCloseAddToPlaylist"
        @sell-slot="onSellSlot"
    />
    <SellSlotModal
        :open="sellSlotOpened"
        :track="sellSlotData ? { track: sellSlotData.track } : null"
        :playlist-id="sellSlotData?.playlistId ?? ''"
        :playlist="sellSlotData?.playlist ?? null"
        :position="sellSlotData?.position"
        :select-playlist="false"
        @close="onCloseSellSlot"
        @confirm="onCloseSellSlot"
    />
</template>
