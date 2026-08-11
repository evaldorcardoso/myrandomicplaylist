<script setup>
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useUserStore } from '@/stores/user'
  import { useNotificationsStore } from '@/stores/notifications'

  const router = useRouter()
  const userStore = useUserStore()
  const notificationsStore = useNotificationsStore()

  const dropdownOpen = ref(false)

  const toggleDropdown = () => {
    if (!notificationsStore.hasExpiredTracks) return
    dropdownOpen.value = !dropdownOpen.value
  }

  const openSlot = (expiration) => {
    notificationsStore.openSlot(expiration)
    dropdownOpen.value = false
  }

  const eventPosition = (expiration) => {
    return expiration.position ?? ((expiration.track?.id ?? 0) + 1)
  }

  const eventName = (expiration) => {
    return expiration.track?.track?.name ?? expiration.title ?? expiration.request?.name ?? 'Faixa'
  }

  const eventArtist = (expiration) => {
    const track = expiration.track?.track
    const artists = track?.artists?.map(artist => artist.name).join(', ') ?? ''
    const curator = expiration.request?.curator?.trim() ?? ''
    return curator ? `${artists} by ${curator}` : artists
  }

  let refreshInterval = null

  onMounted(() => {
    notificationsStore.loadExpiredTracks()
    refreshInterval = setInterval(() => {
      notificationsStore.loadExpiredTracks()
    }, 60000)
  })

  onUnmounted(() => {
    if (refreshInterval) clearInterval(refreshInterval)
  })

  const props = defineProps({
    stepData: {
      type: Number,
      default: 0
    }
  })

  const emit = defineEmits(['update-step-data', 'open-menu'])

  const currentUser = computed(() => userStore.getUser)

  const currentStep = computed(() => props.stepData)

  const displayName = computed(() => currentUser.value?.display_name ?? '')

  const userAvatar = computed(() => currentUser.value?.images?.[0]?.url ?? '')

  const increaseStep = () => {
    emit('update-step-data', currentStep.value + 1)
  }

  const decreaseStep = () => {
    if (currentStep.value == 1) {
      emit('update-step-data', 0)
      router.push('/')
      return
    }

    if (currentStep.value == 99) {
      emit('update-step-data', 3)
      return
    }

    emit('update-step-data', currentStep.value - 1)
  }
</script>

<template>
  <header
    class="fixed top-0 left-0 lg:left-56 right-0 h-20 bg-surface/60 backdrop-blur-2xl z-40 flex items-center justify-between px-gutter md:px-lg border-b border-outline-variant/10"
  >
    <div class="flex items-center gap-1 flex-1 min-w-0">
      <button
        class="lg:hidden p-2 text-on-surface-variant hover:text-on-surface transition-colors"
        @click="emit('open-menu')"
      >
        <span class="material-symbols-outlined">menu</span>
      </button>

      <template v-if="currentStep > 0">
        <button
          class="p-2 text-on-surface-variant hover:text-on-surface transition-colors"
          @click="decreaseStep()"
        >
          <span class="material-symbols-outlined">chevron_left</span>
        </button>
        <button
          v-if="currentStep < 99"
          class="p-2 text-on-surface-variant hover:text-on-surface transition-colors"
          @click="increaseStep()"
        >
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
      </template>

      <div class="flex-1"></div>
    </div>

    <div class="flex items-center gap-3 md:gap-6 flex-shrink-0">
      <div class="relative">
        <button
          class="relative text-on-surface-variant hover:text-on-surface transition-colors"
          :class="notificationsStore.hasExpiredTracks ? 'text-on-surface' : ''"
          @click="toggleDropdown"
        >
          <span class="material-symbols-outlined">notifications</span>
          <span
            v-if="notificationsStore.hasExpiredTracks"
            class="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full border-2 border-surface"
          ></span>
        </button>

        <transition name="dropdown-fade">
          <div
            v-if="dropdownOpen"
            class="absolute right-0 top-full mt-2 w-80 bg-surface-container-low border border-outline-variant/20 rounded-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)] overflow-hidden z-50"
          >
            <div class="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
              <span class="text-label-sm text-on-surface-variant uppercase tracking-widest">Tracks Expiradas</span>
              <span class="px-2 py-0.5 bg-error/10 text-error rounded-full text-label-sm font-bold">{{ notificationsStore.expiredTracks.length }}</span>
            </div>
            <div class="max-h-72 overflow-y-auto py-1">
              <button
                v-for="expiration in notificationsStore.expiredTracks"
                :key="expiration.id"
                class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-container-high transition-colors"
                @click="openSlot(expiration)"
              >
                <span class="min-w-9 h-9 px-1.5 rounded-lg bg-error/10 text-error font-mono font-bold text-label-sm flex-shrink-0 inline-flex items-center justify-center">
                  #{{ String(eventPosition(expiration)).padStart(2, '0') }}
                </span>
                <span class="flex flex-col min-w-0">
                  <span class="text-body-sm font-bold text-on-surface truncate">{{ eventName(expiration) }}</span>
                  <span class="text-label-sm text-on-surface-variant truncate">{{ eventArtist(expiration) }}</span>
                </span>
              </button>
            </div>
          </div>
        </transition>
      </div>

      <div class="flex items-center gap-3 bg-surface-container-high/50 p-1.5 pr-4 rounded-full border border-outline-variant/20 hover:bg-surface-container-high transition-all cursor-pointer">
        <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center overflow-hidden flex-shrink-0">
          <img v-if="userAvatar" :src="userAvatar" class="w-full h-full object-cover" alt="user-picture" />
          <span v-else class="material-symbols-outlined text-on-primary text-[18px]">person</span>
        </div>
        <div class="hidden sm:flex sm:flex-col">
          <span class="text-label-sm font-bold text-on-surface">{{ displayName }}</span>
          <span class="text-[10px] text-on-surface-variant leading-none">Premium Account</span>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
  .dropdown-fade-enter-active,
  .dropdown-fade-leave-active {
    transition: opacity 0.25s ease;
  }
  .dropdown-fade-enter-from,
  .dropdown-fade-leave-to {
    opacity: 0;
  }
</style>
