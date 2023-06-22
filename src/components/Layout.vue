<script setup>
    import { ref, computed, onMounted } from 'vue'
    import Navbar from '@/components/Navbar.vue'
    import FloatPlayer from '@/components/FloatPlayer.vue'
    import { useProfile } from '@/support/spotifyApi'
    import { useUserStore } from '@/stores/user'

    const { getPlaybackState, getProfile } = useProfile()
    const floatPlayerData = ref(null)
    
    const user = ref(null)
    const step = ref(null)
    
    const refresh = ref(null)
    const removeTrackRef = ref(null)
    const userStore = useUserStore()

    const currentData = computed(() => {
        return floatPlayerData.value;
    })
    const currentUser = computed(() => {
        console.log(user.value)
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
        menuData.value = value
    }

    // const onForceRefresh = (value) => {
    //     refresh.value = value
    // }

    // const onRemoveTrack = (value) => {
    //     removeTrackRef.value = value
    // }

    // setInterval(async () => {
    //     try{
    //         const { data } = await getPlaybackState()
    //         floatPlayerData.value = data
    //     } catch(error) {
    //         console.log('error on get playback state')
    //     }
    // }, 30000)

    onMounted(async () => {
        const { data } = await getPlaybackState()
        floatPlayerData.value = data
        await getUserProfile()
    })
</script>

<template>
    <Navbar 
        :user-data="user" 
        :step-data="step" 
        @update-step-data="onUpdateStepData"
    />
    <FloatPlayer v-if="floatPlayerData" 
        :current-data="currentData"
    />
    <!-- <FloatMenu 
        :menu-opened="menuOpened"
        :menu-data="menuData"
        :user-data="user"
        @update-menu-opened="onUpdateMenuOpened" 
        @force-refresh="onForceRefresh"
        @remove-track="onRemoveTrack"
    /> -->
    <router-view 
        :user-data="user" 
        :step-data="step" 
        :remove-track="removeTrack"
        @update-step-data="onUpdateStepData" 
        @update-menu-data="onUpdateMenuData"
    />
</template>
