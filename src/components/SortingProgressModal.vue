<script setup>
  import { computed } from 'vue'

  const props = defineProps({
    open: {
      type: Boolean,
      default: false
    },
    processed: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    }
  })

  const emit = defineEmits(['close'])

  const close = () => {
    emit('close')
  }

  const progress = computed(() => {
    if (!props.total) return 0
    return Math.min(100, Math.round((props.processed / props.total) * 100))
  })
</script>

<template>
  <transition name="modal-fade">
    <div v-if="open" class="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-6">
      <div class="absolute inset-0 bg-black/70"></div>
      <div class="relative w-full max-w-[420px] bg-surface-container-lowest border border-outline-variant/20 rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden">
        <div class="p-8 flex flex-col items-center gap-5 text-center">
          <div class="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <font-awesome-icon icon="sort" class="text-[22px]" />
          </div>
          <h3 class="text-headline-sm text-on-surface">Ordenando músicas</h3>
          <p class="text-label-sm text-on-surface-variant">
            Sincronizando a ordem com o Spotify...
          </p>
          <div class="w-full flex flex-col gap-3">
            <div class="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div
                class="h-full bg-primary rounded-full transition-all duration-300"
                :style="{ width: progress + '%' }"
              ></div>
            </div>
            <span class="text-label-sm text-on-surface-variant">{{ processed }} / {{ total }}</span>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped lang="scss">
  .modal-fade-enter-active,
  .modal-fade-leave-active {
    transition: opacity 0.25s ease;
  }
  .modal-fade-enter-from,
  .modal-fade-leave-to {
    opacity: 0;
  }
</style>
