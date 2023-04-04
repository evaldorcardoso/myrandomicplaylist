<script setup>
    import { ref, computed, onMounted } from 'vue'
    import Navbar from '@/components/Navbar.vue'
    import FloatPlayer from '@/components/FloatPlayer.vue'
    import { useProfile } from '@/support/spotifyApi'

    const { getPlaybackState, getProfile } = useProfile()
    const floatPlayerData = ref(null);
    const user = ref(null);
    const step = ref(null)

    const currentData = computed(() => {
        return floatPlayerData.value;
    })
    const currentUser = computed(() => {
        return user.value;
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
        }
    });

    const onUpdateStepData = (value) => {
        step.value = value
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
    <Navbar :user-data="user" :step-data="step" @update-step-data="onUpdateStepData"/>
    <FloatPlayer v-if="floatPlayerData" :current-data="currentData"/>
    <router-view :user-data="user" :step-data="step" @update-step-data="onUpdateStepData"/>
</template>
