<script setup>
  import { ref, computed, watch } from 'vue'

  const emit = defineEmits(['close', 'confirm'])

  const props = defineProps({
    open: {
      type: Boolean,
      default: false
    },
    mode: {
      type: String,
      default: 'edit'
    },
    request: {
      type: Object,
      default: null
    },
    isSubmitting: {
      type: Boolean,
      default: false
    }
  })

  const value = ref('')
  const dueDate = ref('')
  const status = ref('pending')

  const isEdit = computed(() => props.mode === 'edit')

  const init = () => {
    const request = props.request ?? {}
    value.value = request.value != null ? Number(request.value).toFixed(2).replace('.', ',') : ''
    dueDate.value = request.due_date ?? ''
    status.value = request.status ?? 'pending'
  }

  watch(() => props.open, (opened) => {
    if (opened) {
      init()
    }
  })

  const close = () => {
    if (props.isSubmitting) return
    emit('close')
  }

  const confirm = () => {
    if (props.isSubmitting) return
    if (isEdit.value) {
      emit('confirm', { value: value.value, due_date: dueDate.value, status: status.value })
    } else {
      emit('confirm')
    }
  }
</script>

<template>
  <transition name="modal-fade">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
      <div class="absolute inset-0 bg-black/70" @click="close"></div>
      <div class="relative w-full max-w-[520px] bg-surface-container-lowest border border-outline-variant/20 rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden">
        <!-- Header -->
        <div class="flex justify-between items-start p-8 pb-0">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center" :class="isEdit ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'">
              <font-awesome-icon :icon="isEdit ? 'edit' : 'exclamation-triangle'" class="text-[22px]" />
            </div>
            <div>
              <h3 class="text-headline-sm text-on-surface">{{ isEdit ? 'Editar request' : 'Excluir request' }}</h3>
              <p class="text-label-sm text-on-surface-variant">{{ isEdit ? 'Atualize os dados do request.' : 'Esta ação não pode ser desfeita.' }}</p>
            </div>
          </div>
          <button class="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant" title="Fechar" @click="close">
            <font-awesome-icon icon="times" />
          </button>
        </div>

        <!-- Edit Content -->
        <div v-if="isEdit" class="p-8 space-y-6">
          <div class="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl border border-outline-variant/20">
            <div class="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center flex-shrink-0">
              <font-awesome-icon icon="music" class="text-on-surface-variant" />
            </div>
            <div class="min-w-0">
              <span class="block text-body-lg font-bold text-on-surface truncate">{{ request?.name }}</span>
              <span class="block text-label-sm text-on-surface-variant truncate">#{{ request?.position ?? '--' }} · {{ request?.requester_name ?? 'Desconhecido' }}</span>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-3">
              <label class="text-label-md text-primary uppercase tracking-wider">Valor (R$)</label>
              <input
                v-model="value"
                type="text"
                inputmode="decimal"
                placeholder="0,00"
                class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
              />
            </div>
            <div class="space-y-3">
              <label class="text-label-md text-primary uppercase tracking-wider">Vencimento</label>
              <div class="relative">
                <input
                  v-model="dueDate"
                  type="date"
                  class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
                />
                <font-awesome-icon icon="calendar-alt" class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]" />
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <label class="text-label-md text-primary uppercase tracking-wider">Status</label>
            <select
              v-model="status"
              class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface appearance-none focus:outline-none focus:border-primary transition-all cursor-pointer"
            >
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
            </select>
          </div>
        </div>

        <!-- Delete Content -->
        <div v-else class="p-8">
          <div class="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl border border-outline-variant/20">
            <div class="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center flex-shrink-0">
              <font-awesome-icon icon="music" class="text-on-surface-variant" />
            </div>
            <div class="min-w-0">
              <span class="block text-body-lg font-bold text-on-surface truncate">{{ request?.name }}</span>
              <span class="block text-label-sm text-on-surface-variant truncate">#{{ request?.position ?? '--' }} · {{ request?.requester_name ?? 'Desconhecido' }}</span>
            </div>
          </div>

          <div class="mt-6 bg-error/5 border border-error/30 rounded-xl p-5 space-y-3">
            <div class="flex items-center gap-2 text-error">
              <font-awesome-icon icon="trash" class="text-[18px]" />
              <span class="text-label-md font-bold uppercase tracking-tight">Atenção</span>
            </div>
            <p class="text-body-sm text-on-surface-variant leading-relaxed">
              Excluir este request apaga permanentemente o registro de venda da música
              <strong class="text-on-surface">“{{ request?.name }}”</strong> do banco de dados. A música em si não está mais na playlist, então esta ação apenas remove o registro.
            </p>
          </div>
        </div>

        <!-- Actions -->
        <div class="p-8 pt-0 flex flex-col gap-3">
          <button
            v-if="isEdit"
            class="group relative w-full bg-primary hover:bg-primary-fixed text-on-primary text-label-md font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            :disabled="isSubmitting"
            @click="confirm"
          >
            <div class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <font-awesome-icon v-if="isSubmitting" icon="sync" spin class="relative z-10" />
            <font-awesome-icon v-else icon="save" class="relative z-10" />
            <span class="relative z-10">{{ isSubmitting ? 'Salvando...' : 'Salvar alterações' }}</span>
          </button>
          <button
            v-else
            class="group relative w-full bg-error text-on-error text-label-md font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            :disabled="isSubmitting"
            @click="confirm"
          >
            <div class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <font-awesome-icon v-if="isSubmitting" icon="sync" spin class="relative z-10" />
            <font-awesome-icon v-else icon="trash" class="relative z-10" />
            <span class="relative z-10">{{ isSubmitting ? 'Excluindo...' : 'Sim, excluir request' }}</span>
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
