<script setup>
  import { computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { useUserStore } from '@/stores/user'

  const router = useRouter()
  const userStore = useUserStore()

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
    class="fixed top-0 left-0 lg:left-72 right-0 h-20 bg-surface/60 backdrop-blur-2xl z-40 flex items-center justify-between px-gutter md:px-lg border-b border-outline-variant/10"
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
      <button class="relative text-on-surface-variant hover:text-on-surface transition-colors">
        <span class="material-symbols-outlined">notifications</span>
        <span class="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full border-2 border-surface"></span>
      </button>

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
