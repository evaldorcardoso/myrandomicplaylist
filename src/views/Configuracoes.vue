<script setup>
  import { reactive } from 'vue'
  import { useSettingsStore } from '@/stores/settings'
  import { notify } from "@kyvg/vue3-notification";

  const settingsStore = useSettingsStore()

  const SETTINGS_FIELDS = [
    {
      key: 'playlistPageSize',
      label: 'Playlists por página',
      description: 'Quantidade de playlists carregadas por requisição ao Spotify (máximo 50).',
      min: 10,
      max: 50
    },
    {
      key: 'tracksPageSize',
      label: 'Músicas por página',
      description: 'Quantidade de músicas carregadas por requisição ao abrir uma playlist (máximo 100).',
      min: 10,
      max: 100
    },
    {
      key: 'artistsBatchSize',
      label: 'Artistas por lote',
      description: 'Quantidade de artistas consultados por requisição ao calcular os gêneros (máximo 50).',
      min: 1,
      max: 50
    },
    {
      key: 'topGenresCount',
      label: 'Gêneros principais',
      description: 'Quantidade de gêneros principais exibidos.',
      min: 1,
      max: 50
    },
    {
      key: 'dashboardExpirationsDisplay',
      label: 'Expirações no dashboard',
      description: 'Quantidade de expirações exibidas inicialmente no painel antes de "Ver todas".',
      min: 1,
      max: 20
    }
  ]

  const form = reactive({ ...settingsStore.settings })

  const save = () => {
    settingsStore.setSettings({ ...form })
    notify({ title: 'Salvo', text: 'Configurações atualizadas!', type: 'success' })
  }

  const resetDefaults = () => {
    if (!confirm('Restaurar todos os valores padrão?')) return
    settingsStore.resetSettings()
    Object.assign(form, settingsStore.settings)
    notify({ title: 'Restaurado', text: 'Valores padrão restaurados!', type: 'info' })
  }
</script>

<template>
  <div class="h-full overflow-y-auto bg-surface text-on-surface">
    <div class="max-w-[720px] mx-auto p-gutter md:p-lg flex flex-col gap-lg">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0">
          <span class="material-symbols-outlined text-primary">settings</span>
        </div>
        <div>
          <h1 class="text-headline-lg font-display text-on-surface">Configurações</h1>
          <p class="text-body-sm text-on-surface-variant">Ajuste o desempenho e a exibição do aplicativo.</p>
        </div>
      </div>

      <section class="bg-surface-container-low rounded-xl border border-outline-variant/10 p-lg flex flex-col gap-md">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-secondary">speed</span>
          <h2 class="text-headline-sm font-display text-on-surface">Avançado</h2>
        </div>

        <div class="flex flex-col divide-y divide-outline-variant/10">
          <div
            v-for="field in SETTINGS_FIELDS"
            :key="field.key"
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-md"
          >
            <div class="flex flex-col min-w-0 pr-4">
              <span class="text-body-md font-bold text-on-surface">{{ field.label }}</span>
              <span class="text-label-sm text-on-surface-variant">{{ field.description }}</span>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <input
                v-model.number="form[field.key]"
                type="number"
                :min="field.min"
                :max="field.max"
                class="w-24 bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-body-md font-mono text-on-surface text-center focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
      </section>

      <div class="flex items-center justify-end gap-3">
        <button
          class="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface-variant text-label-md font-bold border border-outline-variant/20 hover:text-on-surface hover:bg-surface-container transition-all flex items-center gap-2"
          @click="resetDefaults"
        >
          <span class="material-symbols-outlined text-[18px]">restart_alt</span>
          Restaurar padrões
        </button>
        <button
          class="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-label-md font-bold hover:brightness-110 transition-all flex items-center gap-2"
          @click="save"
        >
          <span class="material-symbols-outlined text-[18px]">save</span>
          Salvar
        </button>
      </div>
    </div>
  </div>
</template>
