# express-axhub

axhub 위에서 바로 굴러가는 **Express 5 (Node 20+)** 서버 템플릿이에요.
TypeScript 없이 **순수 JavaScript** 라서 vibe coder 가 한 줄씩 읽어가며 고치기 가장 쉬워요.

## 0. 누가 쓰면 좋아요

서버가 필요한 vibe coder. 예:

- 외부 API 를 프록시 (시크릿 키 숨기기)
- 폼 데이터 받아서 DB 에 저장
- Webhook 받기
- 정적 SPA(`vite-react-axhub`) 의 백엔드

## 1. 5분 안에 시작

```bash
npx degit jocoding-ax-partners/examples/express-axhub my-server
cd my-server
npm install
cp .env.example .env
# .env 의 APPHUB_* 값을 채워요.
npm run dev
# http://localhost:3000 접속
```

## 2. 라우트 추가하기

`index.js` 를 열어서 그대로 추가해요. AI 한테 부탁할 때:

```
index.js 에 POST /api/feedback 라우트 추가해줘.
요청 본문: { name, message }.
받은 데이터를 axhub.data("/feedback") 에 POST 로 저장.
성공하면 { ok: true } 응답, 실패하면 500 + 에러 메시지.
```

## 3. axhub Hub API 호출

`lib/axhub.js` 의 헬퍼 사용:

```js
import { axhub } from "./lib/axhub.js";

const res = await axhub.fetch("/v1/users");
const users = await res.json();
```

## 4. axhub 에 배포

### A. Claude Code

```
/axhub:deploy
```

### B. CLI

```bash
axhub apps
axhub deploy create --app my-server-slug --branch main
axhub deploy status dep_xxxxx --watch
```

## 5. 환경변수

| 변수 | 용도 |
|------|------|
| `APPHUB_API_URL` | Hub API endpoint |
| `APPHUB_API_KEY` | Hub API 인증 (Server-side 전용) |
| `APPHUB_APP_SLUG` | 내 앱 슬러그 |
| `APPHUB_DATA_BASE_URL` | Data plane base URL |
| `PORT` | 로컬 포트 (배포에선 3000 고정) |

## 6. 자주 막히는 곳

| 증상 | 해결 |
|------|------|
| `axhub deploy` 빌드 통과 후 503 | `/api/health` 가 200 리턴하는지 확인 (apphub.yaml health_path) |
| `npm install` 실패 | Node 20+ (`node -v`) |
| 호출이 401 | `APPHUB_API_KEY` 가 유효한지, `Bearer` 형식인지 확인 |
| CORS 에러 (브라우저에서 호출 시) | `app.use(cors())` 추가하거나 같은 도메인에서 reverse proxy |

## 7. 왜 TypeScript 가 아닌가

vibe coder 첫 서버 = JS 가 더 쉬워요. 타입 다툴 시간에 기능 더 만들기. 나중에 익숙해지면 TS 로 옮기면 돼요.

## axhub.ts 신뢰 모델 (이 템플릿)

이 (Express) 템플릿은 **server-side**. axhub 헬퍼는 6개 템플릿 모두 동일한 외부 API
(`axhub.fetch / data / slug / isConfigured`) 를 노출해요. Transport 만 달라요:
이 템플릿은 `Authorization: Bearer ${process.env.APPHUB_API_KEY}`.
이 템플릿은 `vite-react-axhub` 같은 브라우저 SPA 의 **backend 역할** 로 자주 쓰여요.
풀 비교 표는 [examples README](../README.md#axhubts-신뢰-모델-모든-템플릿) 참고.

## 8. 라이선스

MIT
