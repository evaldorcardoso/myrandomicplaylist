<script setup>
  import ReloadPWA from "@/components/ReloadPWA.vue"
  import { useUserStore } from '@/stores/user'
  import { inject, onMounted } from "vue";
  import { supabase } from '@/support/supabaseClient'

  const userStore = useUserStore()
  const progress = inject("progress");
  document.title = 'MR Playlist'

  onMounted(async () => {
    if(! userStore.isTracksLoaded) {
      progress.start()
      const { data: databaseTracks, error } = await supabase
        .from(import.meta.env.VITE_SUPABASE_TRACKS_TABLE)
        .select("*")
      userStore.loadAllTracks(databaseTracks)
      console.log('Tracks statistics loaded!')
      progress.finish()
    }
  })
</script>
<template>
  <header>
    <div class="wrapper">
      <ReloadPWA />
    </div>
  </header>
  <div id="main">    
    <notifications position="top center" width="100%"/>
    <Vue3ProgressBar></Vue3ProgressBar>
    <router-view />
  </div>
</template>

<style>
#main{
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  font-family: sans-serif;
  /*background gradiente*/
  background-color: #131313;
  height: 100vh;
  font-size: 14px;
  overflow: hidden;
}
.page{
  background-color: #131313;
  height: auto;
  padding: 0;
  overflow: visible;
}
</style>