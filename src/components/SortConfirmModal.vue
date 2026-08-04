<script setup>
  const emit = defineEmits(['close', 'confirm'])

  const props = defineProps({
    open: {
      type: Boolean,
      default: false
    }
  })

  const close = () => {
    emit('close')
  }

  const confirm = () => {
    emit('confirm')
  }
</script>

<template>
  <transition name="modal-fade">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
      <div class="absolute inset-0 bg-black/70" @click="close"></div>
      <div class="relative w-full max-w-[420px] bg-surface-container-lowest border border-outline-variant/20 rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden">
        <!-- Header -->
        <div class="flex justify-between items-start p-8 pb-0">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
              <font-awesome-icon icon="sort" class="text-[22px]" />
            </div>
            <div>
              <h3 class="text-headline-sm text-on-surface">Aplicar ordenação</h3>
              <p class="text-label-sm text-on-surface-variant">Sincronizar com o Spotify.</p>
            </div>
          </div>
          <button class="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant" title="Fechar" @click="close">
            <font-awesome-icon icon="times" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-8">
          <p class="text-body-md text-on-surface-variant leading-relaxed">
            A ordem atual das músicas difere do Spotify. Deseja aplicar esta ordenação à playlist no Spotify?
          </p>
        </div>

        <!-- Actions -->
        <div class="p-8 pt-0 flex flex-col gap-3">
          <button
            class="group relative w-full bg-primary text-on-primary text-label-md font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] overflow-hidden"
            @click="confirm"
          >
            <div class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <font-awesome-icon icon="check" class="relative z-10" />
            <span class="relative z-10">Aplicar no Spotify</span>
          </button>
          <button
            class="w-full border border-outline-variant/30 hover:border-on-surface-variant hover:text-on-surface text-on-surface-variant text-label-md py-3 rounded-xl transition-colors"
            @click="close"
          >
            Cancelar
          </button>
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
