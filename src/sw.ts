import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [
      /^https:\/\/api\.spotify\.com/,
      /^https:\/\/image-cdn-ak\.spotifycdn\.com/,
      /^https:\/\/.*\.supabase\.co/
    ]
  })
)

registerRoute(
  /^https:\/\/image-cdn-ak\.spotifycdn\.com\/.*$/i,
  new CacheFirst({
    cacheName: 'spotify-images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 30 // 30 dias
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200]
      })
    ]
  })
)

// Push event handler
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (e) {
    payload = {}
  }

  const title = payload.title || 'MR Playlist'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/launchericon-192x192.png',
    badge: '/launchericon-192x192.png',
    data: {
      url: payload.url || '/'
    }
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client && client.url) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})

self.skipWaiting()
clientsClaim()
