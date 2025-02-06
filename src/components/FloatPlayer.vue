<script setup>
import { onMounted, computed, reactive } from "vue";
import { useRouter } from 'vue-router'
import { useProfile } from '@/support/spotifyApi'

const { startResumePlayback, pausePlayback } = useProfile()
var intervalProgress;

const router = useRouter()

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
    const interval = 10000
    intervalProgress = setInterval(function() {
        if (!currentPlaying){
            return
        }
        state.prog = state.prog + interval
        if (state.prog >= currentPlaying.value.item.time_total) {
            state.prog = 0
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
</script>

<template>    
    <div class="player" v-if="currentPlaying && $router.currentRoute.value.name != 'Player'">
        <div class="player-content">
            <router-link to="/player" style="text-decoration:none">
                <img v-bind:src="currentPlaying.item?.album.images[0].url" />
            </router-link>            
            <div class="content">
                <router-link to="/player" style="text-decoration:none">
                <h3 class="track-name">{{ currentPlaying.item?.name }}</h3>
                <span class="device-name">{{ currentPlaying.device?.name }}</span>
                </router-link>
            </div>
            <div class="bar-progress">
                <div id="progress-bar" class="bar-progress-fill" :style="{ width: (state.progPerc) + '%'}"></div>
            </div>
            <div class="player-controls">
                <button v-if="!currentPlaying.is_playing" class="btn-play" @click="resumeUserPlayback()"><font-awesome-icon icon="play"/></button>
                <button v-if="currentPlaying.is_playing" class="btn-play" @click="pauseUserPlayback()"><font-awesome-icon icon="pause"/></button>
            </div>
        </div>
    </div>   
</template>

<style lang="scss" scoped>
    .player{
        bottom: 0;
        position: fixed;
        left: 0;
        width: 100%;
    }
    .player-content{
        display: flex;
        border-radius: 6px 6px 0px 0px;
        gap: 0 8px;
        height: 56px;
        padding: 8px;
        position: relative;
        z-index: 1;
        background-image: linear-gradient(60deg, #e0eb98, #62faf5);
        justify-content: space-between;
        padding-bottom: 20px;
    }
    .player img{
        border-radius: 4px;
        grid-area: image;
        height: 60px;
        margin-inline-end: 4px;
        width: 60px;
    }
    .player .content{
        overflow: hidden;
        display: flex;
        flex-direction: column;
        align-items: baseline;
        justify-content: space-evenly;
    }
    .player .bar-progress{
        background-color: hsla(0,0%,100%,.3);
        border-radius: 2px;
        bottom: 10px;
        grid-area: progress;
        height: 2px;
        left: 0;
        overflow: hidden;
        position: absolute;
        right: 0;
    }
    .player .bar-progress-fill{
        background-color: #000;
        height: 2px;
        transition: width 0.1s;
    }
    .player .player-controls{
        justify-content: end;
        width: 50px;
    }
    .player .content .track-name{
        margin: 0;
        white-space: nowrap;
        color: #000;
    }
    .player .content .device-name{
        color: #797a79;
    }
    .btn-play{
        font-size: 25px;
        height: 40px;
        width: 40px;
        border-radius: 50%;
        background-color: transparent;
        border: none;
        outline: none;
        margin: 10px auto auto auto;
        cursor: pointer;
        color: #000;
        text-align: center;
    }
    .device-name h4{
        margin: 0;
        white-space: nowrap;
        max-width: 300px;
        overflow: hidden;
    }
</style>
