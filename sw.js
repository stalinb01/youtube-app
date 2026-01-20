const CACHE_NAME = 'youtube-app-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cacheando archivos');
                return cache.addAll(urlsToCache);
            })
            .catch((err) => {
                console.error('[SW] Error al cachear:', err);
            })
    );
    
    self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Activando Service Worker...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Eliminando caché antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    return self.clients.claim();
});

// Intercepción de peticiones
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // No cachear peticiones a YouTube API
    if (url.hostname.includes('youtube.com') || url.hostname.includes('ytimg.com')) {
        event.respondWith(fetch(request));
        return;
    }
    
    // Estrategia: Network First, fallback a Cache
    event.respondWith(
        fetch(request)
            .then((response) => {
                // Si la respuesta es válida, clonarla y guardarla en caché
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Si falla la red, intentar obtener de caché
                return caches.match(request).then((response) => {
                    if (response) {
                        return response;
                    }
                    
                    // Si no está en caché, devolver página offline
                    if (request.destination === 'document') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

// Sincronización en segundo plano (opcional)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-history') {
        event.waitUntil(syncHistory());
    }
});

async function syncHistory() {
    // Aquí podrías sincronizar el historial con un servidor
    console.log('[SW] Sincronizando historial...');
}

// Notificaciones push (opcional)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Nueva notificación';
    const options = {
        body: data.body || 'Tienes una actualización',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        data: data
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Click en notificación
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});