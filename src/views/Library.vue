<script setup>
  import { onMounted, computed, reactive, ref } from 'vue'
  import { useProfile } from '@/support/spotifyApi'
  import { useRouter } from 'vue-router'

  const { getPlaylists } = useProfile()
  const router = useRouter()
  const msg = ref('Playlists de ')

  const props = defineProps({
    userData: {
        type: Object,
        default: () => { },
    },
  });

  const currentUser = computed(() => {
    return props.userData;
  });

  const state = reactive({
    playlistsOriginal:[],
    playlists: [],
    filters: ['all'],
    devices: [],
    tracks: [],
  })

  const openPlaylist = (playlistId) => {
    router.push('/playlist/' + playlistId)
  }

  const filterPLaylists = (value = 'all') => {
    state.filters = [value]

    state.filters.map(item => {
      switch (item) {
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
    })
  }

  const filterPrivatePlaylists = async (value = true) => {
    if (value) {
      state.playlists = state.playlistsOriginal.filter(
        playlist => playlist.owner.display_name == currentUser.value.display_name          
      )
      return
    }

    state.playlists = state.playlistsOriginal.filter(
      playlist => playlist.owner.display_name != currentUser.value.display_name
    )
  }

  onMounted(async () => {
    const { data } = await getPlaylists()
    state.playlistsOriginal = data.items
    filterPLaylists()
  })

</script>

<template>
  <div class="page" style="height: 88%;">
    <div >
      <img :src="currentUser.images[0]?.url" style="width: 44px; height: 44px;border-radius: 50%;" />
      <h2 style="padding-top: 15px;color:#fff">{{ msg + currentUser?.display_name }}</h2>
    </div>
    <div style="margin-top: 10px;height:30px;line-height:30px;">
      <button 
        class="button-spotify-clear-filter button-light" 
        v-if="!state.filters.includes('all')"
        @click="filterPLaylists('all')"
      >
      X
      </button>
      <button 
        class="button-spotify" 
        :class="{ 'button-dark': state.filters.includes('private'), 'button-light': !state.filters.includes('private') }"
        @click="filterPLaylists('private')"
      >
      Minhas
      </button>
      <button 
        class="button-spotify" 
        :class="{ 'button-dark': state.filters.includes('liked'), 'button-light': !state.filters.includes('liked') }" 
        @click="filterPLaylists('liked')"
      >
      Curtidas
      </button>
    </div>
    <div class="playlists">
      <ul>
        <li v-for="playlist in state.playlists" :key="playlist.id" @click="openPlaylist(playlist.id)">
            <img :src="playlist.images[0]?.url" />
            <h4>{{ playlist.name }}</h4>
            <h5>By: {{ playlist.owner.display_name }}</h5>
            <p>{{ playlist.description ? playlist.description : 'By ' + playlist.owner.display_name }}</p>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>

.button-spotify {
  border-radius: 20px;
  border: none;
  padding: 10px 25px;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 11px;
  outline: none;
  margin: 3px;
  cursor: pointer;
}
.button-spotify-clear-filter {
  border-radius: 20px;
  border: none;
  padding: 10px 13px;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 11px;
  outline: none;
  margin: 3px;
  cursor: pointer;
}
.button-dark {
  background: rgb(30, 215, 96);
  color: rgb(255, 255, 255);
  border: 1px solid rgb(30, 215, 96);
}
.button-light {
  background: none;
  color: rgb(200, 200, 200);
  border: 1px solid rgb(200, 200, 200);
}
.playlists{
    
}
.playlists ul{
    list-style-type: none;
    padding: 0;   
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, max-content));
    gap: 20px;    
}
.playlists li{
    background-color: #333;
    display: flex;
    flex-direction: column;
    border-radius: 5px;
}
.playlists img{
    max-width: 230px;
    border-top-left-radius: 5px;    
    border-top-right-radius: 5px;    
}
.playlists h4{
    color: #fff;
    margin: 5px;
    white-space: wrap;
    overflow: hidden;
    font-size: 14px;
}
.playlists h5 {
  margin: 1px 1px 1px 5px;
  color: rgb(124, 123, 123);
  font-size: 10px;
}
.playlists p{
    color: rgb(177, 177, 177);
    margin: 0 5px 5px 5px;    
    font-size: 12px;
    line-height: 1.5em;
    height: 3em;
    overflow: hidden;
}
</style>
