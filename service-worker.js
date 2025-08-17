const CACHE_NAME = 'lego-catalog-cache-v2';
const API_HOST = 'rebrickable.com';
const IMG_HOSTS = ['cdn.rebrickable.com', 'm.rebrickable.com'];

const PRECACHE_ASSETS = [
    './',
    './index.html',
    './site.webmanifest',
    './apple-touch-icon.png',
    './favicon-32x32.png',
    './favicon-16x16.png',
    './favicon.ico',
    './android-chrome-192x192.png',
    './android-chrome-512x512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log('Кэш открыт');
            return cache.addAll(PRECACHE_ASSETS);
        })
        .then(() => {
            console.log('Все ресурсы для предкэширования добавлены в кэш');
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Игнорируем запросы браузера при принудительном обновлении (Shift+Reload), чтобы избежать ошибок
    if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
        return;
    }

    // Запросы к API: стратегия "сначала сеть, потом кэш" для получения свежих данных
    if (url.hostname === API_HOST) {
        event.respondWith(networkFirst(event.request));
    } 
    // Запросы изображений: стратегия "сначала кэш, потом сеть" для быстрой загрузки
    else if (IMG_HOSTS.includes(url.hostname)) {
        event.respondWith(cacheFirst(event.request));
    } 
    // Остальные ресурсы (оболочка приложения): "сначала кэш"
    else {
        event.respondWith(
            caches.match(event.request)
            .then(cachedResponse => {
                return cachedResponse || fetch(event.request);
            })
        );
    }
});

// Стратегия "Сначала кэш, потом сеть" (Cache First)
function cacheFirst(request) {
    return caches.match(request).then(response => {
        // Если ответ есть в кэше, возвращаем его
        if (response) {
            return response;
        }
        // Иначе, делаем запрос к сети
        return fetch(request).then(networkResponse => {
            // Если ответ успешный, кэшируем его
            if (networkResponse.ok) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, responseToCache);
                });
            }
            return networkResponse;
        });
    });
}

// Стратегия "Сначала сеть, потом кэш" (Network First)
function networkFirst(request) {
    return fetch(request)
        .then(networkResponse => {
            // Если запрос успешен, обновляем кэш
            if (networkResponse.ok) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, responseToCache);
                });
            }
            return networkResponse;
        })
        .catch(() => {
            // Если сеть недоступна, пытаемся получить ответ из кэша
            return caches.match(request);
        });
}
