// Service Worker Self-Destruct
// 既存のService Workerを強制的に削除し、キャッシュをクリアするためのスクリプト

self.addEventListener('install', (event) => {
    // 直ちにアクティブ化
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        clients.claim().then(() => {
            // 全てのキャッシュを削除
            return caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        console.log('Deleting cache:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            });
        }).then(() => {
            // 自分自身を登録解除
            console.log('Service Worker unregistering...');
            return self.registration.unregister();
        })
    );
});

// リクエストは全てネットワークにスルー（何もキャッチしない）
self.addEventListener('fetch', (event) => {
    return;
});
