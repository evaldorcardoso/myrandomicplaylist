<script setup>
  import { computed } from 'vue'

  const emit = defineEmits(['close', 'confirm'])

  const props = defineProps({
    open: {
      type: Boolean,
      default: false
    },
    playlist: {
      type: Object,
      default: null
    },
    isSubmitting: {
      type: Boolean,
      default: false
    }
  })

  const playlistImage = computed(() => {
    const playlist = props.playlist ?? {}
    if (Array.isArray(playlist.images) && playlist.images.length > 0) {
      return playlist.images[0].url
    }
    return playlist.image || ''
  })

  const close = () => {
    if (props.isSubmitting) return
    emit('close')
  }

  const confirm = () => {
    if (props.isSubmitting) return
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
            <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-error/10 text-error">
              <font-awesome-icon icon="exclamation-triangle" class="text-[22px]" />
            </div>
            <div>
              <h3 class="text-headline-sm text-on-surface">Remover da gestão</h3>
              <p class="text-label-sm text-on-surface-variant">Esta ação não pode ser desfeita.</p>
            </div>
          </div>
          <button class="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant" title="Fechar" @click="close">
            <font-awesome-icon icon="times" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-8">
          <div class="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl border border-outline-variant/20">
            <div class="w-16 h-16 rounded-lg overflow-hidden bg-surface-container-highest flex-shrink-0">
              <img v-if="playlistImage" class="w-full h-full object-cover" :src="playlistImage" :alt="playlist?.name" />
              <div v-else class="w-full h-full bg-gradient-to-br from-primary-container to-secondary-container opacity-40"></div>
            </div>
            <div class="min-w-0">
              <span class="block text-body-lg font-bold text-on-surface truncate">{{ playlist?.name }}</span>
              <span class="block text-label-sm text-on-surface-variant truncate">@{{ playlist?.owner?.display_name }}</span>
            </div>
          </div>

          <div class="mt-6 bg-error/5 border border-error/30 rounded-xl p-5 space-y-3">
            <div class="flex items-center gap-2 text-error">
              <font-awesome-icon icon="trash" class="text-[18px]" />
              <span class="text-label-md font-bold uppercase tracking-tight">Atenção</span>
            </div>
            <p class="text-body-sm text-on-surface-variant leading-relaxed">
              Remover esta playlist apaga permanentemente do banco: pedidos e vendas
              (<strong class="text-on-surface">track_requests</strong>), preços por posição
              (<strong class="text-on-surface">price_positions</strong>), estatísticas de músicas e de likes
              (<strong class="text-on-surface">track_popularity</strong>, <strong class="text-on-surface">playlists_statistics</strong>)
              e o registro da playlist. Ela deixará de aparecer na sua gestão.
            </p>
          </div>
        </div>

        <!-- Actions -->
        <div class="p-8 pt-0 flex flex-col gap-3">
          <button
            class="group relative w-full bg-error text-on-error text-label-md font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            :disabled="isSubmitting"
            @click="confirm"
          >
            <div class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <font-awesome-icon v-if="isSubmitting" icon="sync" spin class="relative z-10" />
            <font-awesome-icon v-else icon="trash" class="relative z-10" />
            <span class="relative z-10">{{ isSubmitting ? 'Removendo...' : 'Sim, remover da gestão' }}</span>
          </button>
          <button
            class="w-full border border-outline-variant/30 hover:border-on-surface-variant hover:text-on-surface text-on-surface-variant text-label-md py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isSubmitting"
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
