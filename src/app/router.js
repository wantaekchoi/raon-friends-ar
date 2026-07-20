// 화면·모드 전환의 단일 소유자 — 이 모듈 밖에서 data-screen/data-mode를 만지거나
// style.display로 화면을 토글하는 것을 금지한다(셸 재작성 스펙 §2).
export function createRouter(root = document.body) {
  return {
    show(screen) { root.dataset.screen = screen; },
    screen() { return root.dataset.screen; },
    setMode(mode) {
      if (mode) root.dataset.mode = mode;
      else delete root.dataset.mode;
    },
    mode() { return root.dataset.mode ?? null; },
  };
}
