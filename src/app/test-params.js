// 테스트 전용 URL 파라미터 게이트 — localhost/127.0.0.1(E2E 하네스가 뜨는 호스트)에서만 값을
// 반환하고, 그 외(공개 배포 URL)에서는 항상 null이다.
//
// 배경: ?timerScale=·?fakeGyro=·?markerMock= 같은 파라미터는 E2E가 대기 시간을 줄이거나(S4·S6),
// 자이로·마커 인식을 헤드리스로 흉내내기 위한(S7·S8) 장치인데, 게이팅 없이는 키오스크 무인 운영
// 중에도 그대로 동작한다 — ?timerScale=0.01로 리셋 타이머를 왜곡하거나 ?fakeGyro=1로 자이로
// 구독 자체를 죽여(아무도 콜백을 호출하지 않아 회전이 멈춘다) 전시 부스를 망가뜨릴 수 있다.
//
// ?visionMock=은 이 게이트를 거치지 않는다(vision/classifier.js가 직접 읽는다) — 실기기에서
// Vision 인식 흐름을 시연·확인하는 용도로 쓰이므로 공개 URL에서도 계속 동작해야 한다.
const TEST_HOSTS = new Set(['localhost', '127.0.0.1']);

export function testParam(name, search = location.search, hostname = location.hostname) {
  if (!TEST_HOSTS.has(hostname)) return null;
  return new URLSearchParams(search).get(name);
}
