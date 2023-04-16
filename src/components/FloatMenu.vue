<script setup>
import { onMounted, computed, ref } from "vue";
import { useGeneral } from '@/support/spotifyApi'
import VueBasicAlert from 'vue-basic-alert'

const emit = defineEmits([
    'update-menu-opened',
    'force-refresh'
])
const { removeTracksOfPlaylist } = useGeneral()

const ALERT_OPTIONS = { 
    iconSize: 35,
    iconType: 'solid', // Icon styles: now only 2 styles 'solid' and 'regular'
    position: 'top right' // Position of the alert 'top right', 'top left', 'bottom left', 'bottom right'
  }
const alert = ref(null)

const props = defineProps({
    menuOpened: {
        type: Boolean,
        default: false,
    },
    menuData: {
        type: Object,
        default: () => { }
    }
});

const menuOpened = computed(() => {
    return props.menuOpened;
});

const menuData = computed(() => {
    return props.menuData;
})

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
                'success', // There are 4 types of alert: success, info, warning, error
                'Song removed!', // Message of the alert
                'Alright', // Header of the alert
                ALERT_OPTIONS
            )
            closeMenu()
            emit('force-refresh', true)
        }
    }catch(error){
      console.log(error)
    }
}

onMounted(async () => {    
    
})

const closeMenu = () => {
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
            <div class="menu-item" v-if="menuData.playlist.isOwner" @click="removeTrack">
                <h3 class="menu-item-option">Remove from this playlist</h3>
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
</style>
