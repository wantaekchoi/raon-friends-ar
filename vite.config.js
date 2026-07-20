import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/raon-friends-ar/',
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
