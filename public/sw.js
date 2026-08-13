/**
 * NotifyMVP WebPush Service Worker
 * Handles background push notifications & Action Link clicks
 */

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const data = event.data.json()
    const title = data.notification?.title || data.title || 'Notification'
    const options = {
      body: data.notification?.body || data.body || '',
      icon: data.notification?.image || data.imageUrl || '/icon.png',
      badge: '/badge.png',
      data: {
        url: data.fcmOptions?.link || data.data?.url || data.data?.click_action || data.url || '/',
        ...data.data,
      },
    }

    event.waitUntil(self.registration.showNotification(title, options))
  } catch (e) {
    console.error('[ServiceWorker] Error parsing push data:', e)
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || event.notification.data?.click_action || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if a tab is already open with the target URL
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
