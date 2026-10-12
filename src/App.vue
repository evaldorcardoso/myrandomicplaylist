<script setup>
  import ReloadPWA from "@/components/ReloadPWA.vue"
  import { useUserStore } from '@/stores/user'
  import { useNotificationsStore } from '@/stores/notifications'
  import { inject, onBeforeUnmount, onMounted, watch } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import { supabase } from '@/support/supabaseClient'
  import { track, EVENTS } from '@/support/telemetry'

  const userStore = useUserStore()
  const notificationsStore = useNotificationsStore()
  const route = useRoute()
  const router = useRouter()
  const progress = inject("progress");
  document.title = 'MR Playlist'

  const handleNotifyParam = async (notifyId) => {
    if (!notifyId) return
    const opened = await notificationsStore.openSlotFromId(notifyId)
    if (opened) {
      router.replace({ query: { ...route.query, notify: undefined } })
    }
  }

  const reportError = (scope, error) => {
    track(EVENTS.ERROR, {
      scope,
      message: error?.message ?? String(error ?? '')
    })
  }

  const onWindowError = (event) => reportError('window.error', event?.error ?? event?.message)
  const onUnhandledRejection = (event) => reportError('window.unhandledrejection', event?.reason)

  onMounted(async () => {
    window.addEventListener('error', onWindowError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    if(! userStore.isTracksLoaded) {
      progress.start()
      const { data: databaseTracks } = await supabase
        .from(import.meta.env.VITE_SUPABASE_TRACKS_TABLE)
        .select("*")
      userStore.loadAllTracks(databaseTracks)
      progress.finish()
    }
    if (route.query.notify) {
      handleNotifyParam(route.query.notify)
    }
  })

  watch(() => route.query.notify, (newVal) => {
    if (newVal) handleNotifyParam(newVal)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('error', onWindowError)
    window.removeEventListener('unhandledrejection', onUnhandledRejection)
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