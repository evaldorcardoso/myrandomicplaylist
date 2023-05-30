<script setup>
import { onMounted, computed, reactive, ref } from "vue";
import { useGeneral, useProfile } from '@/support/spotifyApi'
import VueBasicAlert from 'vue-basic-alert'

const emit = defineEmits([
    'update-menu-opened',
    'force-refresh',
    'remove-track'
])
const { addTracksToPlaylist, removeTracksOfPlaylist } = useGeneral()
const { getPlaylists, executePlaylist } = useProfile()

const ALERT_OPTIONS = { 
    iconSize: 35,
    iconType: 'solid',
    position: 'top right'
  }
const alert = ref(null)

const state = reactive({
    playlistsOriginal:[],
    playlists: [],
  })

const props = defineProps({
    menuOpened: {
        type: Boolean,
        default: false,
    },
    menuData: {
        type: Object,
        default: () => { }
    },
    userData: {
        type: Object,
        default: () => { },
    },
});

const menuOpened = computed(() => {
    return props.menuOpened;
});

const menuData = computed(() => {
    return props.menuData;
});

const currentUser = computed(() => {
    return props.userData;
});

const selectPlaylist = async(playlistId) => {
    try {
        const formData = {
            'uris': [
                menuData.value.track.uri
            ]
        }
        const { status } = await addTracksToPlaylist(playlistId, formData)
        if (status === 201) {
            alert.value.showAlert(
                'success',
                'Song added!',
                'Alright',
                ALERT_OPTIONS
            )
            closeMenu()
        }
    }catch(error){
      console.log(error)
    }
}

const executeTrack = async(track) => {
    try{
      const formData = {
        "uris": [ track.uri ]
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
                { 'uri': menuData.value.track.uri }
            ]
        }
        const { status } = await removeTracksOfPlaylist(menuData.value.playlist.id, formData)
        if (status === 200) {
            alert.value.showAlert(
                'success',
                'Song removed!',
                'Alright',
                ALERT_OPTIONS
            )
            emit('remove-track', menuData.value.track.uri)
            closeMenu()
        }
    }catch(error){
      console.log(error)
    }
}

const listPlaylists = async() => {
    const { data } = await getPlaylists()
    state.playlistsOriginal = data.items
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
    <div class="menu" v-if="menuOpened">
        <div class="menu-content">
            <hr class="menu-bar" @click="closeMenu">
            <div class="menu-item-track" v-if="menuData">
                <img :src="menuData.track.album.images[0].url" class="music-cover"/>
                <div class="menu-item-track-content">                
                  <div class="menu-item-track-title">
                    {{menuData.track.name}}
                  </div>
                  <div class="menu-item-track-subtitle">{{menuData.track.artists[0].name}}</div>
                </div>
            </div>
            <div class="menu-item-track-details">
                Added: {{ new Date(menuData.added_at).toLocaleDateString() }} <br>
                Released: {{ new Date(menuData.track.album.release_date).toLocaleDateString() }} <br>
                Duration: {{ new Date(menuData.track.duration_ms).toISOString().slice(14, 19) }} <br>
                Popularity: {{ menuData.track.popularity }}<br>
            </div>
            <hr class="style-one">
            <div class="menu-item" @click="executeTrack(menuData.track)">
                <font-awesome-icon icon="play" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" />
                <h3 class="menu-item-option">Play</h3>
            </div>
            <div class="menu-item" @click="listPlaylists">
                <font-awesome-icon icon="music" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" />
                <h3 class="menu-item-option">Add to another playlist</h3>
            </div>
            <div class="menu-item" v-if="menuData.playlist.isOwner" @click="removeTrack">
                <font-awesome-icon icon="trash" style="vertical-align:middle;margin-right:10px;color: #b3b3b3;" />
                <h3 class="menu-item-option">Remove from this playlist</h3>
            </div>
            <div class="playlists" v-if="state.playlists">
                <div v-for="playlist in state.playlists" :key="playlist.id" class="menu-item-playlist" @click="selectPlaylist(playlist.id)" v-if="menuData">
                    <img :src="playlist.images[0]?.url" class="playlist-cover"/>
                    <div class="menu-item-track-content">                
                      <div class="menu-item-track-title">
                        {{playlist.name}}
                      </div>
                    </div>
                </div>
            </div>
        </div>
    </div>   
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
    }
    .playlists {
        overflow: scroll;
        max-height: 500px;
    }
</style>
