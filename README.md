# Guilty by Default — 전시 / 웹 공용 프로젝트 (프로토타입)

외부 패키지가 없습니다. Node.js 18 이상만 설치되어 있으면 됩니다. (`npm install` 불필요)

## 전시장 (전시용 PC)
    MODE=exhibit PORT=3000 ADMIN_TOKEN=원하는암호 node server.js
- 게임:      http://localhost:3000/?kiosk=1   (크롬 `--kiosk` 로 전체 화면 권장)
- 옆 화면:   http://localhost:3000/side       (같은 PC의 두 번째 모니터, 또는 같은 공유기의 다른 기기에서 `http://전시PC주소:3000/side`)
- 응답은 `data/plays-exhibit.jsonl` 에 한 줄씩 쌓입니다. 인터넷이 없어도 동작합니다.
- 오픈 전 테스트: 주소 뒤에 `&test=1` 을 붙여 플레이하면 통계에서 제외됩니다.
- 관리(암호 필요):
  - `/api/admin/export?token=암호`       전체 응답 내려받기
  - `/api/admin/clear-test?token=암호`    테스트 응답 삭제
  - `/api/admin/archive-reset?token=암호` 현재 응답을 백업 파일로 옮기고 0에서 다시 시작(개막 전 초기화)

## 웹 (집에서 해보기용)
    MODE=web PORT=3000 ADMIN_TOKEN=원하는암호 node server.js
- 같은 코드를 인터넷에 올린 서버에서 `MODE=web` 으로 실행합니다. 전시 응답과 웹 응답은 파일이 따로 쌓입니다(`plays-web.jsonl`).
- 올릴 곳(호스팅)은 아직 정하지 않았습니다. Node 서버를 돌릴 수 있고 디스크가 유지되는 곳이어야 합니다.

## 동작 규칙
- 끝까지 마친 판만 저장합니다. 이름·기기 정보는 받지 않고, 무작위 세션 번호만 씁니다.
- 응답이 20명 미만이면 퍼센트 대신 “지금까지 N명”만 보여 줍니다(`server.js`의 `MIN_N`).
- 서버가 꺼져 있어도 게임은 동작하며, 저장하지 못한 응답은 브라우저에 보관했다가 다시 보냅니다.
- 화면 속 사건과 피해 수치는 이야기 속 가상 값입니다.

## 아직 비어 있는 것
- 크레딧의 팀원 이름(`public/index.html` 의 `CREDITS`)
- Midjourney 이미지(현재는 임시 도형 돼지)
- 사다리 칸의 연출/모션, 1080×1920 전용 레이아웃
- 전시장과 웹을 잇는 연결(QR 등)
