// 기념 스크린샷 — 완료 화면 [📸 기념사진] 버튼에서 호출한다 (main.js 연결은 조율 세션 몫).
//
// 사용 예 (main.js, 조율 세션이 완료 화면에 버튼을 추가하며 연결):
//   import { captureMoment } from './capture.js';
//   document.getElementById('btn-capture').addEventListener('click', async () => {
//     const { shared } = await captureMoment({
//       videoEl: document.getElementById('camera-video'),
//       canvasEl: document.getElementById('three-canvas'),
//       caption: '라온 프렌즈와 함께! 🐯',
//     });
//     if (!shared) showLine({ speaker: 'raona', text: '사진이 저장됐어요! 📸' });
//   });
//
// 구현 메모 — three 캔버스는 `preserveDrawingBuffer` 없이 렌더링된다(overlay.js/marker.js
// 공통, GPU 메모리 절약). 이런 캔버스는 마지막 renderer.render() 호출 이후 임의 시점에
// 읽으면 이미 지워져 있을 수 있다 — 오직 "같은 프레임 안에서, 브라우저가 다음 페인트를
// 하기 전"에 동기적으로 읽어야 안전하다. requestAnimationFrame 콜백은 그 프레임의 렌더
// 호출들이 전부 끝난 직후·페인트 직전에 실행되므로, 캡처 로직 전체(video+canvas 합성)를
// rAF 콜백 안에 넣어 "렌더 직후 동기 캡처"를 보장한다.

const DEFAULT_CAPTION = '라온 프렌즈와 함께! 🐯';

// videoEl의 실제 프레임을 대상 사각형에 CSS object-fit:cover와 동일하게(중앙 크롭) 그린다.
// index.html에서 #camera-video는 object-fit:cover이므로 합성 결과가 화면에 보이는 구도와 일치해야 한다.
function drawVideoCover(ctx, videoEl, outW, outH) {
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return false;

  const srcRatio = vw / vh;
  const dstRatio = outW / outH;
  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (srcRatio > dstRatio) {
    // 영상이 더 넓다 → 좌우를 잘라낸다
    sw = vh * dstRatio;
    sx = (vw - sw) / 2;
  } else {
    // 영상이 더 좁다(세로로 김) → 위아래를 잘라낸다
    sh = vw / dstRatio;
    sy = (vh - sh) / 2;
  }
  ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, outW, outH);
  return true;
}

function drawCaptionBar(ctx, outW, outH, caption) {
  const barH = Math.round(outH * 0.1);
  const y = outH - barH;
  const grad = ctx.createLinearGradient(0, y, 0, outH);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.35, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, y, outW, barH);

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(barH * 0.42)}px -apple-system, "Apple SD Gothic Neo", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(caption, outW / 2, outH - barH / 2, outW - 32);
}

// 합성 자체는 100% 동기 함수 — rAF 콜백 안에서 호출되어야 "렌더 직후" 보장이 유지된다.
function composite({ videoEl, canvasEl, caption }) {
  const outW = (canvasEl && canvasEl.clientWidth) || videoEl?.videoWidth || window.innerWidth;
  const outH = (canvasEl && canvasEl.clientHeight) || videoEl?.videoHeight || window.innerHeight;

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d');

  // 배경: 카메라 프레임 (권한 거부 등으로 영상이 없으면 그라데이션으로 대체)
  const drewVideo = videoEl && drawVideoCover(ctx, videoEl, outW, outH);
  if (!drewVideo) {
    const bg = ctx.createLinearGradient(0, 0, 0, outH);
    bg.addColorStop(0, '#2b1a3a');
    bg.addColorStop(1, '#6b3f8f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, outW, outH);
  }

  // 전경: three.js 캔버스 (캐릭터) — 현재 드로잉 버퍼 내용을 그대로 얹는다
  if (canvasEl && canvasEl.width > 0 && canvasEl.height > 0) {
    ctx.drawImage(canvasEl, 0, 0, outW, outH);
  }

  drawCaptionBar(ctx, outW, outH, caption || DEFAULT_CAPTION);

  return out;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

function downloadBlob(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `raon-friends-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 완료 화면의 영상+캐릭터를 캡션과 함께 한 장의 이미지로 합성해 공유하거나 다운로드한다.
 *
 * @param {{ videoEl: HTMLVideoElement, canvasEl: HTMLCanvasElement, caption?: string }} opts
 * @returns {Promise<{ shared: boolean }>} navigator.share로 공유됐으면 true, 다운로드로
 *   폴백했거나 사용자가 공유를 취소했으면 false.
 */
export function captureMoment({ videoEl, canvasEl, caption }) {
  return new Promise((resolve, reject) => {
    requestAnimationFrame(async () => {
      let blob;
      try {
        const canvas = composite({ videoEl, canvasEl, caption });
        blob = await canvasToBlob(canvas);
        if (!blob) throw new Error('캡처 이미지 생성 실패');
      } catch (e) {
        reject(e);
        return;
      }

      const file = new File([blob], `raon-friends-${Date.now()}.png`, { type: 'image/png' });
      const canUseShare =
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });

      if (canUseShare) {
        try {
          await navigator.share({ files: [file], text: caption || DEFAULT_CAPTION });
          resolve({ shared: true });
          return;
        } catch (e) {
          // 사용자가 공유 시트를 취소한 경우(AbortError) — 강제로 다운로드까지 트리거하지 않고
          // 취소 의사를 존중한다. 그 외 에러만 다운로드 폴백으로 이어간다.
          if (e && e.name === 'AbortError') {
            resolve({ shared: false });
            return;
          }
        }
      }

      downloadBlob(blob);
      resolve({ shared: false });
    });
  });
}
