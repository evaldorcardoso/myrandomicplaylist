<script setup>
  import ReloadPWA from "@/components/ReloadPWA.vue"
  import { useUserStore } from '@/stores/user'
  import { inject, onMounted } from "vue";
  import { supabase } from '@/support/supabaseClient'

  const userStore = useUserStore()
  const progress = inject("progress");
  document.title = 'My Randomic Playlist'

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
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
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
  /*background gradiente*/
  font-family: sans-serif;
  /*background: linear-gradient(to bottom, #1db954 0%, #0c8d39 100%);*/
  background-color: #1c1c1c;
  height: 100vh;
  font-size: 14px;
}
.page{
  background-color: #1c1c1c;
  height: 90%;
  padding-bottom: 65px;
  overflow-y: scroll;
  overflow-x: hidden;
  padding: 5px;
}
</style>