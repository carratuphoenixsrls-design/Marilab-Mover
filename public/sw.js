const CACHE_NAME = 'marilab-mover-shell-v1.6.9';
const APP_SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

async function notifyOpenClients(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => client.postMessage(message));
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : 'Nuovo aggiornamento Marilab Mover.' };
  }

  const title = payload.title || 'Marilab Mover';
  const options = {
    body: payload.body || 'Nuovo aggiornamento operativo.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || `marilab-mover-${payload.notificationId || Date.now()}`,
    renotify: true,
    data: {
      url: payload.url || '/',
      notificationId: payload.notificationId,
      requestId: payload.requestId,
      kind: payload.kind,
    },
  };

  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    notifyOpenClients({ type: 'MARILAB_PUSH_RECEIVED', notificationId: payload.notificationId }),
  ]));
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(notifyOpenClients({ type: 'MARILAB_PUSH_SUBSCRIPTION_CHANGED' }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) await client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    }),
  );
});
