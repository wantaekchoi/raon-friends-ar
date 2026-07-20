import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// vite preview(빌드 산출물 정적 서빙)는 기본 appType:'spa' 히스토리 폴백 때문에 존재하지 않는
// 정적 파일 요청까지도 index.html(200)로 흘려보낸다 — 실제 배포 호스트(정적 파일 서버, 404 확인됨)
// 와 로컬 e2e 환경의 동작이 달라져, "파일 존재 여부로 버튼을 게이팅"하는 로직(start-screen.js의
// #btn-vision — CONFIG.vision.modelPath)을 로컬에서 검증할 수 없다. appType:'mpa'로 전역 폴백을
// 끄면 해결되지만, 그러면 이 리포에 이미 있던 무관한 텍스처 경로 버그(예:
// models/D:/...tex.jpg — FBX에 박힌 원본 제작 PC의 절대경로 추정)까지 로컬에서 새로 404로
// 드러나 다른 시나리오들이 깨진다(실사용 결함 1건만 고치는 이번 작업 범위 밖 — 별도 보고).
// 그래서 전역 폴백은 그대로 두고, "게이팅 대상 자산이 실제로 없을 때" 요청 하나만 정확히
// 가로채 진짜 404를 내려주는 좁은 미들웨어를 추가한다. 그 외 모든 경로는 기존 동작 그대로다.
const GATED_ASSET_PATH = 'models/vision/raon-mascot-classifier.tflite';

export default defineConfig({
  base: '/raon-friends-ar/',
  plugins: [
    {
      name: 'strict-404-for-vision-model-asset',
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.includes(GATED_ASSET_PATH)) {
            res.statusCode = 404;
            res.end('Not Found');
            return;
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: [
      // mind-ar 브라우저 번들이 three r152에서 제거된 sRGBEncoding을 import하는 문제 우회.
      // 정규식으로 "three" 베어 스펙파이어만 정확히 매치 — "three/addons/*"는 영향받지 않음.
      // 자세한 배경: src/lib/three-compat.js
      { find: /^three$/, replacement: fileURLToPath(new URL('./src/lib/three-compat.js', import.meta.url)) },
    ],
    // three.js 인스턴스 중복 방지 힌트. 실측(2026-07-20): 프로덕션 빌드+`vite preview`는 Rollup이
    // 이미 동일 파일(위 alias 대상)로 정적 결합해 dedupe 유무와 무관하게 "Multiple instances of
    // Three.js" 경고 0건. `npm run dev`는 esbuild optimizeDeps가 mind-ar·three/addons/loaders/
    // FBXLoader.js의 내부 "three" 임포트를 별도 프리번들 사본으로 분리해 경고가 재현되며, 이 dedupe
    // 만으로는 해소되지 않음(원인이 노드모듈 중복 경로가 아니라 프리번들 사본 분리라 dedupe의
    // 적용 범위 밖 — 근본 해결은 optimizeDeps.exclude 필요, docs/NEXT_STEP.md 낮은 우선순위 참고).
    // 그래도 향후 node_modules 구조가 바뀌어 실제 중복 경로가 생기는 경우를 막는 방어용으로 유지.
    dedupe: ['three'],
  },
  build: {
    // dashboard.html(부스 모니터용 대시보드)을 별도 페이지로 함께 빌드한다.
    // rollupOptions.input을 지정하면 index.html도 명시적으로 넣어줘야 한다(자동 포함 안 됨).
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        dashboard: fileURLToPath(new URL('./dashboard.html', import.meta.url)),
      },
    },
  },
});
