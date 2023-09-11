<script setup>
import { onMounted, computed, reactive, ref } from "vue";
import { useGeneral, useProfile } from '@/support/spotifyApi'
import VueBasicAlert from 'vue-basic-alert'
import { usePlaylistStore } from '@/stores/playlist'
import { notify } from "@kyvg/vue3-notification";

const emit = defineEmits([
    'update-menu-opened',
    'remove-track',
    'refresh-playlist',
    'add-queue',
    'open-statistics'
])
const { addTracksToPlaylist, removeTracksOfPlaylist, getTracks } = useGeneral()
const { executePlaylist } = useProfile()
const playlistStore = usePlaylistStore()

const ALERT_OPTIONS = { 
    iconSize: 35,
    iconType: 'solid',
    position: 'top right'
  }
const alert = ref(null)

const state = reactive({
    playlistsOriginal:[],
    playlists: [],
    likesAVG: 0
  })

const props = defineProps({
    menuOpened: {
        type: Boolean,
        default: false
    },
    menuData: {
        type: Object,
        default: () => { }
    },
    userData: {
        type: Object,
        default: () => { }
    },
});

const menuOpened = computed(() => {
    return props.menuOpened;
});

const menuData = computed(() => {
    let menuData = {};
    menuData.type = props.menuData.type
    if (menuData.type == 'playlist') {
        menuData.id = props.menuData.playlist.id
        menuData.image = props.menuData.playlist.images[0].url
        menuData.title = props.menuData.playlist.name
        menuData.subtitle = props.menuData.playlist.description
        menuData.followers = props.menuData.playlist.followers.total
        menuData.owner = props.menuData.playlist.owner.display_name
        menuData.isOwner = props.menuData.playlist.owner.display_name == currentUser.value.display_name
        menuData.visibility = props.menuData.playlist.public ? 'Public' : 'Private'
        menuData.popularity = props.menuData.playlist.popularity
        menuData.likesStats = props.menuData.playlist.likesStats
        calcLikesStats()
        return menuData
    }
    if (menuData.type == 'track') {
        menuData.id = props.menuData.track.track.uri
        menuData.image = props.menuData.track.track.album.images[0].url
        menuData.title = props.menuData.track.track.name
        menuData.subtitle = props.menuData.track.track.artists.map(artist => artist.name).join(' ,')
        menuData.addedAt = new Date(props.menuData.track.added_at).toLocaleDateString()
        menuData.releasedAt = new Date(props.menuData.track.track.album.release_date).toLocaleDateString()
        menuData.duration = new Date(props.menuData.track.track.duration_ms).toISOString().slice(14, 19)
        menuData.popularity = props.menuData.track.track.popularity
        menuData.isOwner = props.menuData.track.playlist.owner == currentUser.value.display_name
        menuData.playlist = props.menuData.track.playlist.id
        return menuData
    }
});

const currentUser = computed(() => {
    return props.userData;
});

const calcLikesStats = () => {
    const likesStats = props.menuData.playlist.likesStats
    if (likesStats && likesStats.length > 2) {
        let beforeLast = likesStats[likesStats.length - 3].likes_count
        let last = likesStats[likesStats.length - 2].likes_count
        state.likesAVG = parseInt(last - beforeLast)
        state.likesAVG = state.likesAVG >= 0 ? '+' : '-'
        state.likesAVG = state.likesAVG + String((last - beforeLast))
        return
    }
    if (likesStats && likesStats.length > 1) {
        let last = likesStats[likesStats.length - 2].likes_count
        state.likesAVG = parseInt(last)
        state.likesAVG = state.likesAVG >= 0 ? '+' : '-'
        state.likesAVG = state.likesAVG + String(last)
    }
    
}

const selectPlaylist = async(playlistId) => {
    if (! await verifyDuplicateTrackInPlaylist(playlistId, menuData.value.id)) {
        notify({
            title: 'Ops',
            text: 'This track is already on this playlist!',
            type: 'warn'
        })
        return
    }

    try {
        const formData = {
            'uris': [
                menuData.value.id
            ]
        }
        const { status } = await addTracksToPlaylist(playlistId, formData)
        if (status === 201) {
            notify({
                title: 'Alright',
                text: 'Song added!',
                type: 'success'
            })
            playlistStore.loadTracks(playlistId, await getTracks(playlistId))
            closeMenu()
        }
    }catch(error){
      console.log(error)
    }
}

const verifyDuplicateTrackInPlaylist = async(playlistId, trackUri) => {
    var tracks = await playlistStore.getTracks(playlistId)
    if (tracks.length === 0) {
      playlistStore.loadTracks(playlistId, await getTracks(playlistId))
      tracks = await playlistStore.getTracks(playlistId)
    }

    return tracks.find(element => element.track.uri === trackUri) === undefined
}

const executeTrack = async(track) => {
    try{
      const formData = {
        "uris": [ track ]
      }
      const { status } = await executePlaylist(formData)
      if (status != 204){
        alert.value.showAlert(
            'error',
            error.response.data.error.message,
            'Ops',
            ALERT_OPTIONS
        )
        return
      }
      state.isPlaying = true  
    }catch(error){
      console.log(error.response)
      alert.value.showAlert(
        'error',
        error.response.data.error.message,
        'Ops',
        ALERT_OPTIONS
      )
    }
  }

const removeTrack = async() => {
    try {
        const formData = {
            'tracks': [
                { 'uri': menuData.value.id }
            ]
        }
        const { status } = await removeTracksOfPlaylist(menuData.value.playlist, formData)
        if (status === 200) {
            notify({
                title: 'Alright',
                text: 'Song removed!',
                type: 'success'
            })
            emit('remove-track', menuData.value.id)
            closeMenu()
        }
    }catch(error){
      console.log(error)
    }
}

const doRefresh = () => {
    emit('refresh-playlist')
    closeMenu()
}

const openStatistics = () => {
    emit('open-statistics')
    closeMenu()
}

const openExternalAnalysis = () => {
    console.log(menuData)
    window.open('https://www.chosic.com/spotify-playlist-analyzer/?plid=' + menuData.value.id)
}

const doQueue = (track) => {
    emit('add-queue', track)
    closeMenu()
}

const listPlaylists = async() => {
    state.playlistsOriginal = playlistStore.playlists
    state.playlists = state.playlistsOriginal.filter(
        playlist => playlist.owner.display_name == currentUser.value.display_name          
    )
}

onMounted(async () => {    
    
})

const closeMenu = () => {
    state.playlists = null
    emit('update-menu-opened', false)
}
</script>

<template>
    <vue-basic-alert :duration="300" :closeIn="3000" ref="alert" />
    <div id="backdrop" :class="{'displayed' : menuOpened, 'hidden' : !menuOpened}" @touchstart="closeMenu"></div>
    <transition name="slide-fade" mode="in-out">
        <div class="menu" v-if="menuOpened">
            <div class="menu-content">
                <hr class="menu-bar" @click="closeMenu">
                <div>
                    <div class="menu-item-track">
                        <img :src="menuData.image" class="music-cover"/>
                        <div class="menu-item-track-content">                
                        <div class="menu-item-track-title">
                            {{menuData.title}}
                        </div>
                        <div class="menu-item-track-subtitle">{{menuData.subtitle}}</div>
                        </div>
                    </div>
                    <div class="menu-item-track-details" v-if="menuData.type == 'track'">
                        Added: {{ menuData.addedAt }} <br>
                        Released: {{ menuData.releasedAt }} <br>
                        Duration: {{ menuData.duration }} <br>
                        Popularity: {{ menuData.popularity }}<br>
                    </div>
                    <div class="menu-item-track-details" v-if="menuData.type == 'playlist'">
                        <div style="display: flex;justify-content:space-around">
                            <div style="display: flex;flex-direction:column;text-align: center;font-size:24px;color:#3498db">
                                <font-awesome-icon icon="heart" style="vertical-align:middle;" />
                                <p class="playlist-subtitle" style="margin-top:10px">{{ menuData.followers }}</p>
                            </div>
                            <div style="display: flex;flex-direction:column;text-align: center;font-size:24px;color:#3498db">
                                <font-awesome-icon v-if="menuData.visibility == 'Public'" icon="unlock-alt" style="vertical-align:middle;" />
                                <font-awesome-icon v-else icon="lock" style="vertical-align:middle;" />
                                <p class="playlist-subtitle" style="margin-top:18px;font-size:12px">{{ menuData.visibility }}</p>
                            </div>
                            <div style="display: flex;flex-direction:column;text-align: center;font-size:24px;" 
                                :class="{
                                    'icon-popularity-bad' : (menuData.popularity <= 40),
                                    'icon-popularity-medium' : (menuData.popularity > 40 && menuData.popularity <= 70),
                                    'icon-popularity-good' : (menuData.popularity > 70)
                                }">
                                <font-awesome-icon icon="chart-line" />
                                <p class="playlist-subtitle" style="margin-top:10px">{{menuData.popularity}}%</p>
                            </div>
                            <div style="display: flex;flex-direction:column;text-align: center;font-size:24px;"
                            :class="{
                                'icon-popularity-bad' : (state.likesAVG < 0),
                                'icon-popularity-medium' : (state.likesAVG == 0),
                                'icon-popularity-good' : (state.likesAVG > 0)
                            }">
                                <font-awesome-icon v-if="(state.likesAVG < 0)" icon="sad-tear"/>
                                <font-awesome-icon v-else-if="(state.likesAVG == 0)" icon="meh"/>
                                <font-awesome-icon v-else-if="(state.likesAVG > 0)" icon="smile"/>
                                <p class="playlist-subtitle" style="margin-top:10px">{{ state.likesAVG }}</p>
                            </div>
                        </div>
                        Created by: {{ menuData.owner }}
                    </div>
                    <hr class="style-one">
                    <div v-if="menuData.type == 'track'">
                        <div class="menu-item" @click="executeTrack(menuData.id)">
                            <font-awesome-icon icon="play" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" />
                            <h3 class="menu-item-option">Play</h3>
                        </div>
                        <div class="menu-item" @click="doQueue(menuData.id)">
                            <font-awesome-icon icon="play" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" />
                            <h3 class="menu-item-option">Add to queue</h3>
                        </div>
                        <div class="menu-item" @click="listPlaylists">
                            <font-awesome-icon icon="music" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" />
                            <h3 class="menu-item-option">Add to another playlist</h3>
                        </div>
                        <div class="menu-item" v-if="menuData.isOwner" @click="removeTrack">
                            <font-awesome-icon icon="trash" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" />
                            <h3 class="menu-item-option">Remove from this playlist</h3>
                        </div>
                        <div class="playlists" v-if="state.playlists">
                            <div v-for="playlist in state.playlists" :key="playlist.id" class="menu-item-playlist" @click="selectPlaylist(playlist.id)">
                                <img :src="playlist.images[0]?.url" class="playlist-cover"/>
                                <div class="menu-item-track-content">                
                                <div class="menu-item-track-title">
                                    {{playlist.name}}
                                </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-if="menuData.type == 'playlist'">
                        <div class="menu-item" @click="doRefresh">
                            <font-awesome-icon icon="sync" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" />
                            <h3 class="menu-item-option">Refresh</h3>
                        </div>
                        <div class="menu-item" @click="openStatistics">
                            <font-awesome-icon icon="chart-pie" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" />
                            <h3 class="menu-item-option">Show statistics</h3>
                        </div>
                        <div class="menu-item" @click="openExternalAnalysis">
                            <font-awesome-icon icon="chart-line" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" />
                            <h3 class="menu-item-option">Open External Analytics</h3>
                        </div>
                    </div>
                </div>            
            </div>
        </div>
    </transition> 
</template>

<style lang="scss" scoped>
    #backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        background: rgba(0, 0, 0, 0.8);
        color: #fff;
    }
    .hidden {
        display: none;
        height: 0%;
    }
    .displayed {
        display: block;
        height: 100%;
    }
    .menu {
        bottom: 0;
        position: absolute;
        width: 100%;
        z-index: 9999;
    }
    .menu-bar {
        width: 50px;
        height: 3px;
        background-color: #b3b3b3;
        margin: 10px auto 10px auto;
        border-radius: 10px;
        cursor: pointer;
    }
    .menu-content{
        display: flex;
        flex-direction: column;
        border-radius: 26px 26px 0px 0px;
        gap: 0 8px;
        height: auto;
        padding: 8px;
        position: relative;
        z-index: 1;
        background-color: #282828;        
        justify-content: center;
        padding-bottom: 20px;
    }
    .menu-item{
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: baseline;
        height: 45px;
        margin-left: 10px;
        cursor: pointer;
    }
    hr.style-one {
        width: 100%;
        border: 0;
        height: 0px;
        border-top: 1% solid #b3b3b3;
        border-bottom: 1px solid #b3b3b3;
    }
    .menu-item-option{
        margin: 0;
        white-space: nowrap;
        color: #b3b3b3;
        height: 20px;
    }
    .music-cover {
        width: 60px;
        height: 60px;
        margin: 10px 10px 20px 10px;
    }
    .playlist-cover {
        width: 40px;
        height: 40px;
        border-radius: 30px;
        margin: 0px 10px 0px 10px;
    }
    .menu-item-track-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        margin: auto;
        flex: 90%;
    }
    .menu-item-track-title {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        color: #fff;
        width: 100%;
    }
    .menu-item-track-subtitle {
        display: flex;
        flex-direction: column;
        align-items: baseline;
        justify-content: flex-start;
        color: #999;
        font-size: 11px;
        text-align: left;
        width: 100%;
    }
    .menu-item-track-details {
        color: #999;
        font-size: 12px;
        text-align: center;
        margin-bottom: 20px;
    }
    .menu-item-track {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        margin: auto;
        width: 100%;
        height: 50px;
        margin-bottom: 20px;
    }
    .menu-item-playlist {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        margin: auto;
        width: 100%;
        height: 40px;
        margin-bottom: 10px;
        cursor: pointer;
    }
    .playlists {
        overflow: scroll;
        max-height: 500px;
    }
    .icon-popularity-bad{
        color: rgb(255, 23, 23);
    }
    .icon-popularity-medium{
        color: rgb(255, 240, 30);
    }
    .icon-popularity-good{
        color: rgb(117, 255, 24);
    }

    .slide-fade-enter-active {
        transition: all .28s cubic-bezier(1.0, 2.5, 0.8, 1.0);
    }
    .slide-fade-leave-active {
        transition: all .8s cubic-bezier(1.0, 2.5, 0.8, 1.0);
    }
    .slide-fade-enter, .slide-fade-leave-to
    /* .slide-fade-leave-active below version 2.1.8 */ {
        transform: translateY(100px);
        opacity: 0;
    }
</style>
