import { supabase } from '@/support/supabaseClient'

const TABLE = 'push_subscriptions'

export async function saveSubscription(sub) {
  const { endpoint, keys } = sub.toJSON()
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: navigator.userAgent })
    .single()
  if (error) throw error
  return data
}

export async function deleteSubscription(endpoint) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('endpoint', endpoint)
  if (error) throw error
}

export async function getSubscription(endpoint) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('endpoint', endpoint)
    .single()
  if (error) return null
  return data
}

export async function listSubscriptions() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
  if (error) throw error
  return data
}

export async function sendExpirationPush({ title, body, url }) {
  const { data, error } = await supabase.functions.invoke('notify-expiration', {
    body: { title, body, url: url || '/' }
  })
  if (error) throw error
  return data
}
