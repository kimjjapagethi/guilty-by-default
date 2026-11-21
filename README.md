# Guilty by Default (길바디) — 전시/웹 게임 (v4)

시나리오: 「AI 책임 딜레마 시나리오 대본집」. 첫 화면(플레이·설정) → 오프닝 S#0 → 인물 선택(서연(유족) / 루소(피자 가게 사장) / 대통령) → 인물별 도입 → **선택 1**(3지) → 파급 → 중간 장면(단체 정보 카드) → **선택 2**(3지) → 엔딩(인물별 5개, 총 15개) → 마지막 화면.

엔딩 매핑(선택1 × 선택2 → 엔딩 번호)
- 서연(A): 1번→[2,3,1] · 2번→[2,4,1] · 3번→[2,5,1]  (예: 선택1=1, 선택2=1 → A-2)
- 루소(B), 대통령(C): 1번→[1,2,3] · 2번→[1,2,3] · 3번→[4,2,5]

## 실행
```
npm run dev
```
게임 http://localhost:3000 · 옆 화면 /side · 편집기 /editor · 디자인 시스템 /design
(포트 변경: PowerShell `$env:PORT=3100; npm run dev`)

주소 옵션: `?kiosk=1` 또는 `?zone=1` 90초 무입력 시 처음으로 · `?test=1` 통계에서 제외
조작: 마우스 클릭(선택·다음). Esc = 설정(소리·처음 화면으로), 플레이 중 우측 상단 톱니바퀴도 같은 설정

## 파일
| 파일 | 역할 |
|---|---|
| `public/index.html` | 게임 진입 |
| `public/game.js` / `game.css` | 게임 흐름 / 화면 (ds.css 토큰만 사용) |
| `public/script.json` | 모든 대사·선택지·엔딩 (편집기가 씀). 초기본 `script.default.json` |
| `public/editor.html` | 스크립트 편집기 (오프닝·단체 카드·인물별 도입/선택/중간/엔딩/매핑표) |
| `public/side.html` | 옆 화면 (인물별 엔딩 비율·선택 비율) |
| `server.js` | 저장·통계 (의존성 없음). 기록 `data/plays3-<mode>.jsonl` |
| `tools/mk_script.py` | docx 시나리오 → script.json 생성기 (`python tools/mk_script.py`) |
| `public/media/s0_delivered.png` | 첫 화면 배경 |

## 이미지
`public/scenes/<컷번호>.webp|png|jpg` 로 넣으면 자동 표시 (컷 번호 예: `S0-1`, `A-S3b`). 없으면 배경 색만 나옵니다.

## 기록 스키마 (`/api/play`)
`{ sid, src, test, ch(0~2), c1(0~2), c2(0~2), ending('A-1'~'C-5') }` — 엔딩은 선택한 인물의 것이어야 저장됩니다. 20판 이상 모이면 전체 통계, 인물별 5판 이상이면 그 인물의 비율을 공개합니다. 이전 `plays*.jsonl` 은 읽지 않습니다.
