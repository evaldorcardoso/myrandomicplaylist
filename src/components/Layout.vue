<script setup>
    import { ref, computed, onMounted } from 'vue'
    import Navbar from '@/components/Navbar.vue'
    import FloatPlayer from '@/components/FloatPlayer.vue'
    import FloatMenu from '@/components/FloatMenu.vue'
    import { useProfile } from '@/support/spotifyApi'

    const { getPlaybackState, getProfile } = useProfile()
    const floatPlayerData = ref(null)
    const isMenuOpened = ref(null)
    const user = ref(null)
    const step = ref(null)
    const menuData = ref(null)
    const refresh = ref(null)
    const removeTrackRef = ref(null)

    const currentData = computed(() => {
        return floatPlayerData.value;
    })
    const currentUser = computed(() => {
        return user.value;
    })

    const menuOpened = computed(() => {
        return isMenuOpened.value;
    })

    const forceRefresh = computed(() => {
        return refresh.value;
    })

    const removeTrack = computed(() => {
        return removeTrackRef.value;
    })

    const getUserProfile = async() => {
        const { data } = await getProfile()
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

    const onUpdateMenuOpened = (value) => {
        isMenuOpened.value = value
    }

    const onUpdateMenuData = (value) => {
        menuData.value = value
    }

    const onForceRefresh = (value) => {
        refresh.value = value
    }

    const onRemoveTrack = (value) => {
        removeTrackRef.value = value
    }

    setInterval(async () => {
        try{
            const { data } = await getPlaybackState()
            floatPlayerData.value = data
        } catch(error) {
            console.log('error on get playback state')
        }
    }, 30000)

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
    <FloatMenu 
        :menu-opened="menuOpened"
        :menu-data="menuData"
        :user-data="user"
        @update-menu-opened="onUpdateMenuOpened" 
        @force-refresh="onForceRefresh"
        @remove-track="onRemoveTrack"
    />
    <router-view 
        :user-data="user" 
        :step-data="step" 
        :menu-opened="menuOpened" 
        :force-refresh="forceRefresh"
        :remove-track="removeTrack"
        @update-step-data="onUpdateStepData" 
        @update-menu-opened="onUpdateMenuOpened" 
        @update-menu-data="onUpdateMenuData" 
        @force-refresh="onForceRefresh"
        @remove-track="onRemoveTrack"
    />
</template>
