# Guilty by Default — 전시 / 웹 공용 프로젝트 (프로토타입)

외부 패키지가 없습니다. Node.js 18 이상만 있으면 됩니다. (`npm install` 불필요)

## 실행
    MODE=exhibit PORT=3000 ADMIN_TOKEN=원하는암호 node server.js      # 전시장 PC
    MODE=web     PORT=3000 ADMIN_TOKEN=원하는암호 node server.js      # 인터넷에 올리는 웹 버전
(윈도우 PowerShell: `$env:MODE="exhibit"; $env:ADMIN_TOKEN="암호"; node server.js`)

| 주소 | 내용 |
|---|---|
| `/` , `/?kiosk=1` | 게임. 세로 1080×1920 비율이 기본이며 창 크기에 맞춰 줄어듭니다 |
| `/side` | 옆 화면(실시간 통계) |
| `/design` | 디자인 시스템(색, 서체, 컴포넌트) |
| `?test=1` | 응답이 통계에서 제외되는 테스트 플레이 |

## 폴더에 넣어 주세요
- `public/attract/opening_pig.mp4` : 처음 대기 화면에서 반복 재생되는 영상(소리 없이 자동 반복). `public/` 안이나 프로젝트 폴더 바로 아래에 두어도 찾습니다. 영상이 재생되지 않으면 아래 이미지 → 임시 도형 순으로 대체됩니다.
- `public/attract/` : (영상이 없을 때) 대기 화면에서 반복 재생할 돼지 이미지. 이름순 재생(01.png, 02.png…). 안에 README.txt 참고
- `public/pigs/` : 단계별 돼지 이미지 `pig-1.png … pig-5.png`, `cart.png` (없으면 임시 도형)
- `public/fonts/` : Pretendard(본문, 포함됨), PP Frama(제목, 라이선스 때문에 미포함 — 파일을 직접 넣어 주세요). 안에 README.txt 참고
- `public/attract/pig-vector.json` : 대기 화면의 벡터 돼지 애니메이션(배경 없음). 색은 `public/ds.css` 맨 위의 `--attract-bg`(배경), `--attract-line`(선)만 바꾸면 되고, 주소 뒤에 `?bg=BCD8DD&line=460E21` 을 붙여 미리 볼 수 있습니다. 새 영상으로 다시 만들려면 `tools/vectorize.py`(주석에 사용법). 벡터가 없으면 mp4 → 이미지 → 임시 도형 순으로 대체됩니다.

## 디자인 시스템
`public/ds.css` 한 파일에 색(버건디·페일 블루·아이보리), 서체, 크기, 컴포넌트, 모션이 모두 있습니다. 게임과 옆 화면이 같은 파일을 씁니다. 보기: `/design`

## 키보드(물리 버튼) 대응
- `1` = 예/첫 번째, `2` = 아니오/두 번째, `3` = 세 번째(레버 칸)
- `Enter` = 다음, `←/→` = 레버(맡기는 정도) 이동
- 대기 화면에서는 아무 키나 누르면 시작합니다. `?kiosk=1`이면 90초 동안 입력이 없을 때 처음(대기 화면)으로 돌아갑니다.
- 물리 버튼 3개(예, 아니오, 다음)와 레버(←/→)를 키보드 신호로 보내는 보드(아두이노 레오나르도, 라즈베리 파이 피코 등)가 필요합니다.

## 응답 저장·관리
- 끝까지 마친 판만 `data/plays-<mode>.jsonl` 에 익명으로 저장합니다(이름·기기 정보 없음, 무작위 세션 번호).
- 20명 미만이면 퍼센트 대신 “지금까지 N명”만 보여 줍니다.
- 관리(암호 필요): `/api/admin/export?token=암호` 내려받기 · `/api/admin/clear-test?token=암호` 테스트 응답 삭제 · `/api/admin/archive-reset?token=암호` 백업 후 초기화
- 서버가 꺼져 있어도 게임은 동작하며, 저장하지 못한 응답은 브라우저에 보관했다가 다시 보냅니다.

## 아직 비어 있는 것
크레딧 팀원 이름(`public/index.html` 의 `CREDITS`), Midjourney 돼지 이미지와 대기 화면 이미지, PP Frama 파일, 전시장·웹 연결(QR 등), 호스팅 선정
