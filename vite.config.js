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
