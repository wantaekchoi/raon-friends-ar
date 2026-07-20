// mind-ar의 브라우저 번들(mind-ar/dist/mindar-image-three.prod.js)은
// `import { sRGBEncoding } from "three"` 를 사용하는데, 이 상수는 three r152에서 제거되어
// three 0.170에는 export 자체가 없다. 그대로 두면 번들링 단계에서
// "does not provide an export named 'sRGBEncoding'" 에러로 빌드가 깨진다.
//
// vite.config.js의 resolve.alias(정규식 /^three$/ 로 정확히 "three" 베어 스펙파이어만 매치,
// "three/addons/*" 서브패스는 건드리지 않음)가 그 임포트를 이 파일로 우회시킨다.
// 아래에서 실제 three 빌드 파일을 "상대 경로"로 직접 참조하는 이유: 베어 스펙파이어 'three'로
// re-export하면 alias가 이 파일 자신에게 다시 걸려 무한 루프가 된다.
export * from '../../node_modules/three/build/three.module.js';

export const sRGBEncoding = 3001; // three r152 이전 THREE.sRGBEncoding 값. mind-ar 쪽에서
// renderer.outputEncoding에 대입만 하고 실제로는 사용하지 않는 legacy 필드라 값 자체는 의미 없음.
