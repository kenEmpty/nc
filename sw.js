// 旋盤輪郭座標計算 — オフライン用サービスワーカー（依存なし・ランタイムキャッシュ方式）。
//
// Vite のビルド成果物はハッシュ付きファイル名になるため、事前に名前を列挙できない。
// そこで「取得したものを都度キャッシュ」する方式を採る：
//  - 初回オンライン表示でアプリシェル＋資産がキャッシュされ、以降はオフラインでも動く。
//  - ナビゲーションは network-first（更新を取得、失敗時はキャッシュ/シェルへフォールバック）。
//  - 静的資産は cache-first（あればキャッシュ、無ければ取得してキャッシュ）。
// キャッシュ名の版を上げると、activate で旧キャッシュを破棄して更新する。

const CACHE = 'lathecalc-v4';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function cachePut(request, response) {
  if (response && response.ok && response.type === 'basic') {
    caches.open(CACHE).then((c) => c.put(request, response));
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 同一オリジンのみ扱う

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          cachePut(req, res.clone());
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('./index.html'))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          cachePut(req, res.clone());
          return res;
        }),
    ),
  );
});
