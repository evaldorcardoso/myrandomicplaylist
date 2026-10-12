import { supabase } from '@/support/supabaseClient'

const EARNINGS_LEDGER_TABLE = 'earnings_ledger'

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
    loadEarningsLedger
  }
}