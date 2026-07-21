import { describe, it, expect } from 'vitest';
import { resolveModelAssetUrl, BROKEN_TEXTURE_SENTINEL } from '../src/characters.js';

const MODEL_DIR = '/raon-friends-ar/models/';

// 회귀 배경(2026-07-21 리뷰): 이전 구현(rewriteBakedTexturePath)은 백슬래시·드라이브 문자를
// 검사했지만, FBXLoader는 URL 수정자에 넘기기 전에 경로를 파일명으로 정규화한다
// (`split('\\').pop()`) — 즉 수정자는 `C:\...` 형태를 절대 받지 못해 그 구현은 무효(no-op)였고
// 프로덕션 404가 그대로 남았다. 이 테스트는 "수정자가 실제로 받는 입력"(정규화된 파일명 URL)을
// 그대로 사용한다.
describe('resolveModelAssetUrl', () => {
  it('fbx가 요청하는, 배포 목록에 없는 텍스처(구워진 경로의 파일명)는 센티널로 보낸다', () => {
    // raoni.fbx의 C:\Users\Administrator\raoni_texture-01.jpg → FBXLoader 정규화 후 실제 요청 URL
    expect(resolveModelAssetUrl(`${MODEL_DIR}raoni_texture-01.jpg`))
      .toBe(BROKEN_TEXTURE_SENTINEL);
  });

  it('배포된 모델·텍스처 파일 요청은 그대로 둔다', () => {
    for (const f of ['raong.fbx', 'raoni.fbx', 'raona.fbx', 'raoni_tex.jpg', 'raona_tex.jpg', 'raong_face.jpg', 'raong_syringe.jpg', 'raong_face_tail_texture-01-01.jpg']) {
      expect(resolveModelAssetUrl(`${MODEL_DIR}${f}`)).toBe(`${MODEL_DIR}${f}`);
    }
  });

  it('blob:·data: URL(임베디드 텍스처)은 건드리지 않는다', () => {
    expect(resolveModelAssetUrl('blob:http://localhost/abc-123')).toBe('blob:http://localhost/abc-123');
    expect(resolveModelAssetUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });

  it('센티널은 유효한 데이터 URI다(로드에 성공해야 네트워크 요청·콘솔 에러가 없다)', () => {
    expect(BROKEN_TEXTURE_SENTINEL.startsWith('data:image/gif;base64,')).toBe(true);
  });
});
