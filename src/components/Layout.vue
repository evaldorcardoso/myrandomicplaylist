<script setup>
    import { ref, computed, onMounted } from 'vue'
    import Sidebar from '@/components/Sidebar.vue'
    import TopBar from '@/components/TopBar.vue'
    import FloatPlayer from '@/components/FloatPlayer.vue'
    import { useProfile } from '@/support/spotifyApi'
    import { useUserStore } from '@/stores/user'

    const { getPlaybackState, getProfile } = useProfile()
    const floatPlayerData = ref(null)
    
    const user = ref(null)
    const step = ref(0)
    const menuOpen = ref(false)
    
    const refresh = ref(null)
    const removeTrackRef = ref('')
    const userStore = useUserStore()

    const currentData = computed(() => {
        const data = floatPlayerData.value
        return (data && typeof data === 'object') ? data : {}
    })
    const currentUser = computed(() => {
        return user.value;
    })

    const forceRefresh = computed(() => {
        return refresh.value;
    })

    const removeTrack = computed(() => {
        return removeTrackRef.value;
    })

    const getUserProfile = async() => {
        const { data } = await getProfile()
        userStore.setUser(data)
        user.value = data
        step.value = 0
    }

    const props = defineProps({
        id: String,
        stepData: {
            type: Number,
            default: 0
        },
        menuOpened: {
            type: Boolean,
            default: false
        },
        forceRefresh: {
            type: Boolean,
            default: false,
        },
        removeTrack: {
            type: String,
            default: ''
        }
    });

    const onUpdateStepData = (value) => {
        step.value = value
    }

    const onUpdateMenuData = (value) => {
        menuOpen.value = value
    }

    setInterval(async () => {
        try{
            const { data } = await getPlaybackState()
            floatPlayerData.value = data
        } catch(error) {
            console.log('error on get playback state')
        }
    }, 10000)

    
    onMounted(async () => {
        const { data } = await getPlaybackState()
        floatPlayerData.value = data
        await getUserProfile()
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
    <div class="pl-0 lg:pl-72">
        <main class="pt-20 bg-surface h-screen overflow-y-auto px-gutter md:px-lg" :class="floatPlayerData ? 'pb-36' : 'pb-lg'">
            <router-view 
                :step-data="step" 
                :remove-track="removeTrack"
                :current-data="currentData"
                @update-step-data="onUpdateStepData" 
                @update-menu-data="onUpdateMenuData"
            />
        </main>
    </div>
    <FloatPlayer v-if="floatPlayerData" 
        :current-data="currentData"
    />
</template>
