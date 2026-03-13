// ══ 대리운전 기록앱 Service Worker v1.0 ══
const CACHE_NAME = 'daeri-v1';
const OFFLINE_URL = '/index.html';

// 캐시할 파일 목록
const PRECACHE_URLS = [
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ── 설치: 앱 파일 캐시 ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// ── 활성화: 이전 캐시 삭제 ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ── 네트워크 요청 처리 (오프라인 우선) ──
self.addEventListener('fetch', (event) => {
  // 구글 폰트 등 외부 요청은 네트워크 우선
  if (!event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 앱 파일은 캐시 우선 → 없으면 네트워크 → 없으면 오프라인 페이지
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // 성공 응답이면 캐시에 저장
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // 오프라인 상태 — HTML 요청이면 캐시된 index.html 반환
        if (event.request.destination === 'document') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// ── 푸시 알림 수신 (미래 서버 푸시용) ──
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || '대리운전 기록앱', {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      tag: 'daeri-notif',
      renotify: true,
      data: { url: data.url || '/' }
    })
  );
});

// ── 알림 클릭 시 앱 열기 ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
