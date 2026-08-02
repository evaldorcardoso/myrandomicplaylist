<script setup>
import { onMounted, onBeforeUnmount, computed, reactive, watch, ref } from "vue";
import { useRoute } from 'vue-router'
import { useProfile } from '@/support/spotifyApi'
import { useUserStore } from '@/stores/user'
import AddToPlaylistModal from '@/components/AddToPlaylistModal.vue'
import SellSlotModal from '@/components/SellSlotModal.vue'

const { startResumePlayback, pausePlayback } = useProfile()
const userStore = useUserStore()
var intervalProgress;

const route = useRoute()

const addToPlaylistOpen = ref(false)
const sellSlotOpened = ref(false)
const sellSlotData = ref(null)

const state = reactive({
    progPerc: 0,
    prog: 0,
    progOrig: 0
})

const props = defineProps({
    currentData: {
        type: Object,
        default: () => { },
    },
});

const currentPlaying = computed(() => {
    return props.currentData;
});

const isTracked = computed(() => {
    return !!userStore.getTrack(currentPlaying.value?.item?.id)
})

const releaseDate = computed(() => {
    const date = currentPlaying.value?.item?.album?.release_date
    if (!date) return '—'
    const [year, month, day] = date.split('-')
    const parts = []
    if (day) parts.push(day)
    if (month) parts.push(month)
    parts.push(year)
    return parts.join('/')
})

const formatTime = (ms) => {
    if (!ms || ms < 0) return '0:00'
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return minutes + ':' + String(seconds).padStart(2, '0')
}

const elapsedTime = computed(() => formatTime(state.prog))
const totalTime = computed(() => formatTime(currentPlaying.value?.item?.duration_ms))

watch(() => props.currentData?.is_playing, (isPlaying) => {
    if (isPlaying) {
        progress()
    } else {
        if (intervalProgress) {
            clearInterval(intervalProgress)
        }
        state.prog = 0
        state.progPerc = 0
    }
})

const resumeUserPlayback = async() => {
    const { status } = await startResumePlayback()
    if (status == 204){
        props.currentData.is_playing = !props.currentData.is_playing
        progress()
    }
}

const pauseUserPlayback = async() => {
    const { status } = await pausePlayback()
    if (status == 204){
        props.currentData.is_playing = !props.currentData.is_playing
        clearInterval(intervalProgress);
    }
}

const progress = async() => {
    const interval = 500
    if (intervalProgress) {
        clearInterval(intervalProgress)
    }
    intervalProgress = setInterval(function() {
        if (!currentPlaying.value?.item || !currentPlaying.value?.is_playing) {
            clearInterval(intervalProgress)
            state.prog = 0
            state.progPerc = 0
            return
        }
        state.prog = state.prog + interval
        if (state.prog >= currentPlaying.value.item.time_total) {
            clearInterval(intervalProgress)
            state.prog = 0
            state.progPerc = 0
            return
        }
        if (state.progOrig != currentPlaying.value.progress_ms) {
            state.progOrig = currentPlaying.value.progress_ms
            state.prog = currentPlaying.value.progress_ms
        }
        state.progPerc = (state.prog / currentPlaying.value.item.duration_ms) * 100
    }, interval)
};

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

onMounted(async () => {    
    progress()
})

onBeforeUnmount(() => {
    clearInterval(intervalProgress)
})
</script>

<template>    
    <div class="fixed bottom-0 left-0 lg:left-72 right-0 z-30" v-if="currentPlaying && route.name != 'Player'">
        <div class="relative h-20 bg-surface-container-lowest/95 backdrop-blur-2xl border-t border-outline-variant/10 px-gutter md:px-10 flex items-center justify-between gap-4">
            <div class="flex items-center gap-4 w-1/3 min-w-0">
                <router-link to="/player" class="h-20 w-20 rounded bg-surface-container-highest overflow-hidden flex-shrink-0 border border-outline-variant/20">
                    <img class="w-full h-full object-cover" v-bind:src="currentPlaying.item?.album.images[0].url" />
                </router-link>
                <router-link to="/player" class="flex flex-col min-w-0">
                    <h3 class="text-body-md font-bold text-on-surface truncate leading-tight"><font-awesome-icon v-if="isTracked" icon="heart" style="vertical-align:middle;margin-right:5px;color: rgb(30, 215, 96);" />{{ currentPlaying.item?.name }}</h3>
                    <span class="text-label-sm text-on-surface-variant truncate leading-tight">{{ currentPlaying.item?.artists.map(artist => artist.name).join(', ') }}</span>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="flex items-center gap-1 text-[10px] text-primary font-bold uppercase tracking-widest"><font-awesome-icon icon="chart-line" />{{ currentPlaying.item?.popularity }}</span>
                    </div>
                    <span class="text-label-sm text-on-surface-variant truncate leading-tight">{{ releaseDate }}</span>
                </router-link>
            </div>

            <div class="flex items-center justify-center w-1/3">
                <div class="flex items-center gap-3 w-full">
                    <button
                        class="w-10 h-10 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0 hover:scale-105 active:scale-95 transition-all"
                        :class="currentPlaying.is_playing ? 'opacity-90' : 'opacity-100'"
                        @click="currentPlaying.is_playing ? pauseUserPlayback() : resumeUserPlayback()"
                    >
                        <span class="material-symbols-outlined">{{ currentPlaying.is_playing ? 'pause' : 'play_arrow' }}</span>
                    </button>
                    <div class="flex-1 flex items-center gap-2 min-w-0">
                        <span class="text-[10px] text-on-surface-variant tabular-nums">{{ elapsedTime }}</span>
                        <div class="flex-1 h-1 bg-surface-container-highest rounded-full overflow-hidden">
                            <div class="h-full bg-primary transition-[width] duration-100" :style="{ width: state.progPerc + '%' }"></div>
                        </div>
                        <span class="text-[10px] text-on-surface-variant tabular-nums">{{ totalTime }}</span>
                    </div>
                </div>
            </div>

            <div class="flex items-center justify-end gap-2 w-1/3">
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
        :track="currentPlaying?.item"
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
    />
</template>
