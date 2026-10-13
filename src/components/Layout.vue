<script setup>
    import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
    import Sidebar from '@/components/Sidebar.vue'
    import TopBar from '@/components/TopBar.vue'
    import FloatPlayer from '@/components/FloatPlayer.vue'
    import SlotManagementModal from '@/components/SlotManagementModal.vue'
    import { useProfile } from '@/support/spotifyApi'
    import { useUserStore } from '@/stores/user'
    import { useNotificationsStore } from '@/stores/notifications'
    import { useWebPlayback } from '@/composables/useWebPlayback'
    import { useNowPlaying } from '@/composables/useNowPlaying'

    const { getProfile } = useProfile()
    const { boot: bootWebPlayback } = useWebPlayback()
    // Fonte compartilhada de "agora tocando". O polling de 10s que vivia aqui
    // passou para dentro dela: só roda no fallback REST, com a aba visível, e
    // para quando o dispositivo do app é o ativo.
    const { nowPlaying, start: startNowPlaying, stop: stopNowPlaying } = useNowPlaying()

    const step = ref(0)
    const menuOpen = ref(false)
    
    const removeTrackRef = ref('')
    const userStore = useUserStore()
    const notificationsStore = useNotificationsStore()

    const hasNowPlaying = computed(() => Boolean(nowPlaying.value))
    const removeTrack = computed(() => {
        return removeTrackRef.value;
    })

    const getUserProfile = async() => {
        const { data } = await getProfile()
        userStore.setUser(data)
        step.value = 0
    }

    defineProps({
        id: String,
        stepData: {
            type: Number,
            default: 0
        },
        menuOpened: {
            type: Boolean,
            default: false
        }
    });

    const onUpdateStepData = (value) => {
        step.value = value
    }

    const onUpdateMenuData = (value) => {
        menuOpen.value = value
    }

    onMounted(async () => {
        await getUserProfile()
        // Registra o app como dispositivo Spotify Connect ("MR Playlist") em
        // qualquer rota autenticada. Nunca transfere a reprodução sozinho.
        bootWebPlayback()
        startNowPlaying()
    })

    onBeforeUnmount(() => {
        stopNowPlaying()
    })
</script>

<template>
    <Sidebar 
        :open="menuOpen" 
        @close="menuOpen = false"
    />
    <TopBar 
        :step-data="step" 
        @update-step-data="onUpdateStepData"
        @open-menu="menuOpen = true"
    />
    <div class="pl-0 lg:pl-56">
        <main class="pt-20 bg-surface h-screen overflow-y-auto" :class="hasNowPlaying ? 'pb-20' : 'pb-lg'">
            <router-view 
                :step-data="step" 
                :remove-track="removeTrack"
                @update-step-data="onUpdateStepData" 
                @update-menu-data="onUpdateMenuData"
            />
        </main>
    </div>
    <FloatPlayer v-if="hasNowPlaying" />
    <SlotManagementModal
        :open="notificationsStore.slotOpened"
        :track="notificationsStore.slotTrack"
        :request="notificationsStore.slotRequest"
        :playlist-id="notificationsStore.slotPlaylistId"
        :playlist="notificationsStore.slotPlaylist"
        :select-playlist="false"
        @close="notificationsStore.closeSlot()"
        @updated="notificationsStore.runSlotUpdated()"
        @remove-track="notificationsStore.runSlotRemoveTrack"
        @replace-track="notificationsStore.runSlotReplaceTrack"
    />
</template>
