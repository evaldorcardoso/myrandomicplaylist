<script setup>
import { onMounted, onBeforeUnmount, computed, reactive, watch } from "vue";
import { useRoute } from 'vue-router'
import { useProfile } from '@/support/spotifyApi'

const { startResumePlayback, pausePlayback } = useProfile()
var intervalProgress;

const route = useRoute()

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

onMounted(async () => {    
    progress()
})

onBeforeUnmount(() => {
    clearInterval(intervalProgress)
})
</script>

<template>    
    <div class="fixed bottom-0 left-0 lg:left-72 right-0 z-30" v-if="currentPlaying && route.name != 'Player'">
        <div class="relative h-24 bg-primary border-t border-on-primary/10 px-gutter md:px-lg flex items-center gap-3">
            <router-link to="/player" class="flex-shrink-0 h-full -ml-gutter md:-ml-lg">
                <img class="h-full w-24 object-cover" v-bind:src="currentPlaying.item?.album.images[0].url" />
            </router-link>
            <router-link to="/player" class="flex flex-col min-w-0 flex-1 gap-0.5">
                <h3 class="text-body-md font-bold text-on-primary truncate leading-tight">{{ currentPlaying.item?.name }}</h3>
                <span class="text-label-sm text-on-primary/70 truncate leading-tight">{{ currentPlaying.item?.artists.map(artist => artist.name).join(', ') }}</span>
                <span class="text-label-sm text-on-primary/70 truncate leading-tight">Popularidade: {{ currentPlaying.item?.popularity }}</span>
                <span class="text-label-sm text-on-primary/70 truncate leading-tight">Reproduzindo em: {{ currentPlaying.device?.name }}</span>
            </router-link>
            <button
                class="flex-shrink-0 w-11 h-11 rounded-full bg-surface-variant text-on-surface flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                :class="currentPlaying.is_playing ? 'opacity-90' : 'opacity-100'"
                @click="currentPlaying.is_playing ? pauseUserPlayback() : resumeUserPlayback()"
            >
                <span class="material-symbols-outlined">{{ currentPlaying.is_playing ? 'pause' : 'play_arrow' }}</span>
            </button>
            <div class="absolute bottom-0 left-0 right-0 h-1.5 bg-on-primary/20 overflow-hidden">
                <div class="h-full bg-surface-variant transition-[width] duration-100" :style="{ width: state.progPerc + '%' }"></div>
            </div>
        </div>
    </div>   
</template>
