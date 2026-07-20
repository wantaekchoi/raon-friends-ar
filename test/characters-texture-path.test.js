import { describe, it, expect } from 'vitest';
import { rewriteBakedTexturePath } from '../src/characters.js';

const MODEL_DIR = '/raon-friends-ar/models/';
const SHIPPED = `${MODEL_DIR}raoni_tex.jpg`; // 실제로 배포한 그 캐릭터의 텍스처

describe('rewriteBakedTexturePath', () => {
  it('제작 PC 절대경로가 구워진 텍스처 요청은 배포된 텍스처로 돌린다', () => {
    // 실제 raoni.fbx에 구워져 있는 경로 (FBXLoader가 모델 디렉토리 기준으로 이어붙여 요청한다)
    expect(
      rewriteBakedTexturePath(`${MODEL_DIR}C:\\Users\\Administrator\\raoni_texture-01.jpg`, SHIPPED),
    ).toBe(SHIPPED);
  });

  it('드라이브 문자 없이 역슬래시만 있는 경로도 배포 텍스처로 돌린다', () => {
    expect(rewriteBakedTexturePath('textures\\sub\\raoni_texture-01.jpg', SHIPPED)).toBe(SHIPPED);
  });

  it('정상적인 상대 URL은 그대로 둔다 (모델·정상 텍스처 요청을 가로채지 않는다)', () => {
    expect(rewriteBakedTexturePath(`${MODEL_DIR}raoni.fbx`, SHIPPED)).toBe(`${MODEL_DIR}raoni.fbx`);
    expect(rewriteBakedTexturePath(`${MODEL_DIR}raong_face.jpg`, SHIPPED))
      .toBe(`${MODEL_DIR}raong_face.jpg`);
  });

  it('blob:·data: URL은 건드리지 않는다 (임베디드 텍스처 경로)', () => {
    expect(rewriteBakedTexturePath('blob:http://localhost/abc-123', SHIPPED))
      .toBe('blob:http://localhost/abc-123');
    expect(rewriteBakedTexturePath('data:image/png;base64,AAAA', SHIPPED))
      .toBe('data:image/png;base64,AAAA');
  });

  it('돌릴 텍스처가 없으면 원본 URL을 유지한다 (텍스처 없는 캐릭터 대비)', () => {
    expect(rewriteBakedTexturePath('C:\\x\\y.jpg', undefined)).toBe('C:\\x\\y.jpg');
  });
});
