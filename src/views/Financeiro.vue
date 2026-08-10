<script setup>
  import { ref, computed, onMounted } from 'vue'
  import { FinanceService } from '@/services/FinanceService'

  const { loadEarningsLedger } = FinanceService()
  const isLoading = ref(true)
  const records = ref([])

  const filterMode = ref('month')
  const monthFilter = ref('')
  const customStart = ref('')
  const customEnd = ref('')

  const formatCurrency = (value) => {
    if (value == null) return '-'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('pt-BR')
  }

  const parseLocalDate = (value) => {
    if (!value) return null
    const parts = String(value).split('-').map(Number)
    if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return null
    return new Date(parts[0], parts[1] - 1, parts[2])
  }

  const ledgerTypeLabel = (type) => type === 'renewal' ? 'Renovação' : 'Novo'

  const total = computed(() => records.value.reduce((sum, row) => sum + (row.amount ?? 0), 0))

  const filterWindow = () => {
    if (filterMode.value === 'month') {
      const now = new Date()
      const [year, month] = monthFilter.value
        ? monthFilter.value.split('-').map(Number)
        : [now.getFullYear(), now.getMonth() + 1]
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 1)
      return { start, end }
    }

    const today = new Date()
    let start = parseLocalDate(customStart.value) ?? new Date(today.getFullYear(), today.getMonth(), 1)
    let end = parseLocalDate(customEnd.value) ?? new Date()
    end.setDate(end.getDate() + 1)
    return { start, end }
  }

  const loadRecords = async () => {
    isLoading.value = true
    records.value = []
    try {
      const { start, end } = filterWindow()
      const { data } = await loadEarningsLedger({ start, end })
      records.value = data
    } catch (error) {
      console.error(error)
    } finally {
      isLoading.value = false
    }
  }

  const applyFilters = () => {
    loadRecords()
  }

  const resetFilters = () => {
    filterMode.value = 'month'
    monthFilter.value = ''
    customStart.value = ''
    customEnd.value = ''
    loadRecords()
  }

  onMounted(() => {
    loadRecords()
  })
</script>

<template>
  <div v-if="isLoading" class="h-full overflow-y-auto bg-surface text-on-surface">
    <div class="max-w-[1600px] mx-auto p-gutter md:p-lg">
      <div class="bg-surface-container-low p-lg rounded-xl flex flex-col gap-xs shadow-sm mb-lg">
        <div class="flex items-center justify-between">
          <div class="h-4 w-40 rounded animate-pulse bg-surface-container-high"></div>
          <div class="h-6 w-6 rounded animate-pulse bg-surface-container-high"></div>
        </div>
        <div class="h-10 w-28 rounded animate-pulse bg-surface-container-high"></div>
      </div>

      <div class="bg-surface-container-low rounded-xl p-lg border border-outline-variant/10 mb-lg">
        <div class="h-8 w-full rounded animate-pulse bg-surface-container-high"></div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div v-for="n in 3" :key="'f-skel-' + n" class="h-8 w-full rounded animate-pulse bg-surface-container-high"></div>
        </div>
      </div>

      <div class="bg-surface-container-low rounded-xl overflow-hidden shadow-sm border border-outline-variant/10">
        <table class="w-full table-fixed text-left border-collapse min-w-[720px]">
          <tbody class="divide-y divide-outline-variant/5">
            <tr v-for="n in 5" :key="'row-skel-' + n">
              <td v-for="col in 6" :key="'cell-skel-' + n + '-' + col" class="px-4 py-4">
                <div class="h-4 w-16 rounded animate-pulse bg-surface-container-high"></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div v-else class="h-full overflow-y-auto bg-surface text-on-surface">
    <div class="max-w-[1600px] mx-auto p-gutter md:p-lg">
      <!-- Summary Card -->
      <div class="bg-surface-container-low p-lg rounded-xl flex flex-col gap-xs shadow-sm hover:bg-surface-container transition-colors mb-lg">
        <div class="flex items-center justify-between">
          <span class="text-label-sm text-on-surface-variant uppercase tracking-widest">Ganhos do Período</span>
          <span class="material-symbols-outlined text-primary text-headline-sm">payments</span>
        </div>
        <span class="text-display-lg font-display text-on-surface">{{ formatCurrency(total) }}</span>
        <span class="text-label-sm text-on-surface-variant">{{ records.length }} registro{{ records.length === 1 ? '' : 's' }} no período</span>
      </div>

      <!-- Filters -->
      <div class="bg-surface-container-low rounded-xl p-lg border border-outline-variant/10 mb-lg">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div class="space-y-3">
            <label class="text-label-md text-primary uppercase tracking-wider">Período</label>
            <select
              v-model="filterMode"
              class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface appearance-none focus:outline-none focus:border-primary transition-all cursor-pointer"
            >
              <option value="month">Mês</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          <div v-if="filterMode === 'month'" class="space-y-3">
            <label class="text-label-md text-primary uppercase tracking-wider">Mês</label>
            <input
              v-model="monthFilter"
              type="month"
              class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
            />
          </div>

          <template v-else>
            <div class="space-y-3">
              <label class="text-label-md text-primary uppercase tracking-wider">Início</label>
              <input
                v-model="customStart"
                type="date"
                class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
              />
            </div>
            <div class="space-y-3">
              <label class="text-label-md text-primary uppercase tracking-wider">Fim</label>
              <input
                v-model="customEnd"
                type="date"
                class="w-full bg-surface-container-high border border-outline-variant/30 rounded-xl px-5 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary transition-all"
              />
            </div>
          </template>
        </div>

        <div class="flex gap-3 mt-5">
          <button
            class="bg-primary hover:bg-primary-fixed text-on-primary text-label-md font-bold py-2.5 px-4 rounded-xl transition-all"
            @click="applyFilters"
          >Aplicar Filtros</button>
          <button
            class="border border-outline-variant/30 hover:bg-surface-container-high text-on-surface-variant text-label-md py-2.5 px-4 rounded-xl transition-all"
            @click="resetFilters"
          >Limpar</button>
        </div>
      </div>

      <!-- Records Table -->
      <div v-if="records.length > 0" class="bg-surface-container-low rounded-xl overflow-hidden shadow-sm border border-outline-variant/10">
        <div class="overflow-x-auto">
          <table class="w-full table-fixed text-left border-collapse min-w-[720px]">
            <thead>
              <tr class="bg-surface-container text-label-sm text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
                <th class="px-4 py-4 w-[110px]">Data</th>
                <th class="px-4 py-4">Música</th>
                <th class="px-4 py-4">Playlist</th>
                <th class="px-4 py-4">Cliente</th>
                <th class="px-4 py-4 w-[100px]">Tipo</th>
                <th class="px-4 py-4 text-right w-[110px]">Valor</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/5">
              <tr
                v-for="record in records"
                :key="record.id"
                class="hover:bg-surface-container-high/50 transition-colors"
              >
                <td class="px-4 py-4">
                  <span class="text-body-sm text-on-surface-variant">{{ formatDate(record.created_at) }}</span>
                </td>
                <td class="px-4 py-4">
                  <span class="text-body-md font-bold text-on-surface truncate block">{{ record.track_name || 'Faixa' }}</span>
                </td>
                <td class="px-4 py-4">
                  <span class="text-body-sm text-on-surface truncate block">{{ record.playlist_name || '—' }}</span>
                </td>
                <td class="px-4 py-4">
                  <div class="flex flex-col">
                    <span class="text-body-sm font-bold text-on-surface truncate">{{ record.requester_name || '—' }}</span>
                    <span v-if="record.curator" class="text-label-sm text-on-surface-variant">por {{ record.curator }}</span>
                  </div>
                </td>
                <td class="px-4 py-4">
                  <span
                    class="text-label-sm px-2.5 py-1 rounded-full"
                    :class="record.type === 'renewal' ? 'bg-secondary-container/10 text-secondary-container' : 'bg-primary/10 text-primary'"
                  >{{ ledgerTypeLabel(record.type) }}</span>
                </td>
                <td class="px-4 py-4 text-right">
                  <span class="font-mono text-body-md text-on-surface">{{ formatCurrency(record.amount) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-16 flex flex-col items-center gap-3">
        <span class="material-symbols-outlined text-[48px] text-primary opacity-20">payments</span>
        <p class="text-body-md text-on-surface-variant">Nenhum registro de ganhos encontrado para o período selecionado.</p>
        <p class="text-label-sm text-on-surface-variant">Venda posições ou confirme pagamentos pendentes para começar a registrar ganhos.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>