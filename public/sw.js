// 오프라인 자산 캐시 (D — 리서치 보완 ⑥: 행사장 네트워크 불안정 대비 3D 모델·텍스처·카드 타깃 사전 캐싱).
// 등록은 main.js가 담당하며, 이 스크립트 자체나 캐시 적재가 실패해도 앱 동작에는 영향이 없다
// (무해 실패 — main.js의 register().catch()가 조용히 흡수한다).

// 자산 파일 내용을 교체하는 배포가 있으면 이 버전을 반드시 올릴 것 (v2: SWR 전략 전환).
const CACHE_NAME = 'raon-friends-ar-v2';

// 서비스워커 스크립트 자신의 위치(scope) 기준 상대 경로 — GitHub Pages 서브패스 배포에도 안전.
const PRECACHE_URLS = [
  'img/raong.png',
  'img/raoni.png',
  'img/raona.png',
  'models/raong.fbx',
  'models/raong_face.jpg',
  'models/raong_syringe.jpg',
  'models/raoni.fbx',
  'models/raoni_tex.jpg',
  'models/raona.fbx',
  'models/raona_tex.jpg',
  'targets/cards.mind',
  'targets/card-raong.png',
  'targets/card-raoni.png',
  'targets/card-raona.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => {
        // 자산 하나라도 404/네트워크 오류면 addAll 전체가 실패한다 — 캐시 없이 넘어가도 무해.
        console.warn('[sw] precache 실패 — 오프라인 캐시 없이 동작', err);
      }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Vision AI 분류 모델(tflite)은 PRECACHE_URLS에 일부러 넣지 않는다 — 용량이 크고(수 MB), 아래
// SWR 전략을 그대로 적용하면 "모델 파일만 교체한 배포"가 재방문 시 1회는 구버전으로 응답된다.
// 라벨 체계·정확도가 바뀐 모델이 잠깐이라도 구버전으로 나가는 건 텍스처 SWR 지연보다 리스크가
// 커서, 이 경로만 네트워크 우선(성공하면 캐시 갱신, 실패해야만 캐시 폴백)으로 처리한다.
function isVisionModelRequest(url) {
  return url.pathname.includes('/models/vision/');
}

// stale-while-revalidate — 캐시가 있으면 즉시 응답해 오프라인·속도를 확보하되, 백그라운드에서
// 네트워크로 최신본을 받아 캐시를 갱신한다. 순수 cache-first는 "자산 파일만 바꾼 배포"가
// 재방문 브라우저에 영원히 반영되지 않는 함정이 있었다(적대 리뷰 HIGH 1).
// (HTML 네비게이션은 가로채지 않음 — 앱 셸은 항상 네트워크에서 최신으로.)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 외부(구글 폼, MediaPipe CDN 등)는 관여 안 함

  if (isVisionModelRequest(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const res = await fetch(request);
          if (res && res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached; // 오프라인일 때만 이전에 받아둔 모델로 폴백
          throw new Error('vision model fetch failed and no cache available');
        }
      }),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached); // 오프라인이면 캐시 폴백 (캐시도 없으면 실패 그대로)
      return cached || network;
    }),
  );
});
