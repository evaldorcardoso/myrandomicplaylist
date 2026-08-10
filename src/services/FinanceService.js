import { supabase } from '@/support/supabaseClient'

const EARNINGS_LEDGER_TABLE = 'earnings_ledger'

const sumLedger = (rows = []) => {
  let total = 0
  for (const row of rows) {
    if (row.amount == null) continue
    total += row.amount
  }
  return total
}

const sumLedgerByType = (rows = []) => {
  const totals = { new: 0, renewal: 0 }
  for (const row of rows) {
    if (row.amount == null) continue
    const kind = row.type === 'renewal' ? 'renewal' : 'new'
    totals[kind] += row.amount
  }
  return totals
}

export function FinanceService() {
  const loadEarningsLedger = async ({ start, end }) => {
    const startISO = start ? new Date(start).toISOString() : null
    const endISO = end ? new Date(end).toISOString() : null

    let query = supabase
      .from(EARNINGS_LEDGER_TABLE)
      .select('*')

    if (startISO) {
      query = query.gte('created_at', startISO)
    }
    if (endISO) {
      query = query.lte('created_at', endISO)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error(error.message)
      return { data: [], error }
    }
    return { data: data ?? [], error: null }
  }

  return {
    loadEarningsLedger,
    sumLedger,
    sumLedgerByType
  }
}