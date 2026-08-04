<script setup>
  import { ref, watch, computed } from 'vue'

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

  const form = ref({
    name: '',
    description: '',
    isPublic: true,
    includeTopArtists: false,
    imageBase64: null,
    imagePreview: null
  })

  watch(() => props.open, (opened) => {
    if (opened && props.playlist) {
      form.value.name = props.playlist.name || ''
      form.value.description = props.playlist.description || ''
      form.value.isPublic = props.playlist.public !== false
      form.value.includeTopArtists = false
      form.value.imageBase64 = null
      form.value.imagePreview = null
    }
  })

  const displayedImage = computed(() => {
    if (form.value.imagePreview) return form.value.imagePreview
    return playlistImage.value
  })

  const close = () => {
    if (props.isSubmitting) return
    emit('close')
  }

  const onFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target.result
      const base64 = result.split(',')[1]
      form.value.imageBase64 = base64
      form.value.imagePreview = result
    }
    reader.readAsDataURL(file)
  }

  const confirm = () => {
    if (props.isSubmitting) return
    let description = form.value.description || ''
    if (form.value.includeTopArtists && Array.isArray(props.playlist?.topArtists)) {
      const topArtists = props.playlist.topArtists.slice(0, 3).map(a => a.name).join(', ')
      if (topArtists) {
        description = `${description} Top artistas: ${topArtists}`
      }
    }
    emit('confirm', {
      name: form.value.name,
      description,
      isPublic: form.value.isPublic,
      imageBase64: form.value.imageBase64
    })
  }
</script>

<template>
  <transition name="modal-fade">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
      <div class="absolute inset-0 bg-black/70" @click="close"></div>
      <div class="relative w-full max-w-[560px] max-h-[90vh] overflow-y-auto bg-surface-container-lowest border border-outline-variant/20 rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden">
        <!-- Header -->
        <div class="flex justify-between items-start p-8 pb-0">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
              <font-awesome-icon icon="edit" class="text-[22px]" />
            </div>
            <div>
              <h3 class="text-headline-sm text-on-surface">Editar Playlist</h3>
              <p class="text-label-sm text-on-surface-variant">Atualize as informações no Spotify.</p>
            </div>
          </div>
          <button class="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant" title="Fechar" @click="close">
            <font-awesome-icon icon="times" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-8 space-y-6">
          <!-- Cover Image -->
          <div class="flex flex-col items-center gap-4">
            <div class="relative group">
              <div class="w-32 h-32 rounded-xl overflow-hidden bg-surface-container-highest shadow-lg">
                <img v-if="displayedImage" class="w-full h-full object-cover" :src="displayedImage" :alt="form.name" />
                <div v-else class="w-full h-full bg-gradient-to-br from-primary-container to-secondary-container opacity-40"></div>
              </div>
            </div>
            <label class="flex items-center gap-2 text-label-sm font-medium text-primary hover:underline cursor-pointer">
              <font-awesome-icon icon="upload" />
              <span>{{ form.imageBase64 ? 'Imagem selecionada' : 'Trocar capa' }}</span>
              <input type="file" accept="image/jpeg,image/png" class="hidden" @change="onFileChange" />
            </label>
          </div>

          <!-- Name -->
          <div class="space-y-2">
            <label class="text-label-sm text-on-surface-variant uppercase tracking-wider font-medium">Título</label>
            <input
              v-model="form.name"
              type="text"
              maxlength="100"
              placeholder="Nome da playlist"
              class="w-full rounded-xl bg-surface-container-low border border-outline-variant/30 px-4 py-3 text-on-surface text-body-md outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            />
          </div>

          <!-- Privacy -->
          <div class="space-y-2">
            <label class="text-label-sm text-on-surface-variant uppercase tracking-wider font-medium">Privacidade</label>
            <div class="flex gap-3">
              <button
                type="button"
                class="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-body-sm font-medium transition-all"
                :class="form.isPublic
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/20 hover:border-outline-variant/40'"
                @click="form.isPublic = true"
              >
                <font-awesome-icon icon="globe" />
                Pública
              </button>
              <button
                type="button"
                class="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-body-sm font-medium transition-all"
                :class="!form.isPublic
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/20 hover:border-outline-variant/40'"
                @click="form.isPublic = false"
              >
                <font-awesome-icon icon="lock" />
                Privada
              </button>
            </div>
          </div>

          <!-- Description -->
          <div class="space-y-2">
            <label class="text-label-sm text-on-surface-variant uppercase tracking-wider font-medium">Descrição</label>
            <textarea
              v-model="form.description"
              rows="3"
              maxlength="300"
              placeholder="Adicione uma descrição..."
              class="w-full rounded-xl bg-surface-container-low border border-outline-variant/30 px-4 py-3 text-on-surface text-body-md outline-none resize-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            ></textarea>
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-2 text-label-sm text-on-surface-variant cursor-pointer hover:text-on-surface transition-colors">
                <input type="checkbox" v-model="form.includeTopArtists" class="accent-primary" />
                <span>Incluir top artistas</span>
              </label>
              <span class="text-[11px] text-on-surface-variant">{{ (form.description || '').length }}/300</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="p-8 pt-0 flex flex-col gap-3">
          <button
            class="group relative w-full bg-primary text-on-primary text-label-md font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            :disabled="isSubmitting"
            @click="confirm"
          >
            <div class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <font-awesome-icon v-if="isSubmitting" icon="sync" spin class="relative z-10" />
            <font-awesome-icon v-else icon="save" class="relative z-10" />
            <span class="relative z-10">{{ isSubmitting ? 'Salvando...' : 'Salvar no Spotify' }}</span>
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
