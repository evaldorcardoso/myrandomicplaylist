import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@mrplaylist.app'
const DRY_RUN = process.argv.includes('--dry-run') || String(process.env.DRY_RUN) === 'true'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

if (!DRY_RUN && (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY)) {
  console.error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY env vars')
  process.exit(1)
}

if (!DRY_RUN) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function getTodayBrDate() {
  const now = new Date()
  const brasilia = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  return brasilia.toISOString().slice(0, 10)
}

async function getExpiringToday() {
  const today = getTodayBrDate()
  const { data, error } = await supabase
    .from('track_requests')
    .select('id, name, due_date, status, playlist_id, playlists(name)')
    .in('status', ['pending', 'paid'])
    .eq('due_date', today)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching expiring tracks:', error.message)
    return []
  }
  return data ?? []
}

async function getSubscriptions() {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  if (error) {
    console.error('Error fetching subscriptions:', error.message)
    return []
  }
  return data ?? []
}

function buildPayload(tracks) {
  if (tracks.length === 0) {
    return null
  }

  if (tracks.length === 1) {
    const t = tracks[0]
    const playlistName = t.playlists?.name || 'playlist'
    return {
      title: 'MR Playlist — Música expira hoje',
      body: `"${t.name}" expira hoje em "${playlistName}"`,
      url: '/'
    }
  }

  const names = tracks.map(t => t.name).slice(0, 5).join(', ')
  const suffix = tracks.length > 5 ? ` e mais ${tracks.length - 5}` : ''
  return {
    title: `MR Playlist — ${tracks.length} músicas expiram hoje`,
    body: names + suffix,
    url: '/'
  }
}

async function sendToSubscription(subscription, payload) {
  const sub = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth
    }
  }
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload))
    return { success: true }
  } catch (err) {
    return { success: false, statusCode: err.statusCode, message: err.message }
  }
}

async function run() {
  console.log(`[${new Date().toISOString()}] Expiration notification job started${DRY_RUN ? ' (DRY RUN)' : ''}`)

  const tracks = await getExpiringToday()
  const payload = buildPayload(tracks)

  if (!payload) {
    console.log('No tracks expiring today. Nothing to send.')
    return
  }

  console.log(`Found ${tracks.length} track(s) expiring today.`)
  console.log(`Notification title: ${payload.title}`)
  console.log(`Notification body: ${payload.body}`)

  if (DRY_RUN) {
    console.log('Dry run — skipping push send.')
    return
  }

  const subscriptions = await getSubscriptions()
  if (subscriptions.length === 0) {
    console.log('No push subscriptions registered. Nothing to send.')
    return
  }

  console.log(`Sending to ${subscriptions.length} subscription(s)...`)

  let success = 0
  let failed = 0

  for (const sub of subscriptions) {
    const result = await sendToSubscription(sub, payload)
    if (result.success) {
      success++
    } else {
      failed++
      console.error(`Failed to send to ${sub.endpoint.slice(-20)}: ${result.statusCode} — ${result.message}`)
      if (result.statusCode === 410 || result.statusCode === 404) {
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint)
        if (error) console.error('Failed to clean up stale subscription:', error.message)
        else console.log(`Cleaned up stale subscription: ...${sub.endpoint.slice(-20)}`)
      }
    }
  }

  console.log(`Done. Success: ${success}, Failed: ${failed}`)
}

run().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
