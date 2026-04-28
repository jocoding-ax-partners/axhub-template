# hono-axhub

axhub 위에서 바로 굴러가는 **Hono (Node 20+)** 가벼운 서버 템플릿이에요.
Express 보다 빠르고 코드 짧아요. TypeScript 친화적.

## 0. 누가 쓰면 좋아요

가벼운 API 서버, JSON 위주 백엔드, edge-친화 라우터가 필요한 vibe coder.
Express 보다 라우트 정의가 간결하고 타입 추론이 잘 돼요.

## 1. 5분 안에 시작

```bash
npx degit jocoding-ax-partners/examples/hono-axhub my-server
cd my-server
npm install
cp .env.example .env
npm run dev
# http://localhost:3000 접속
```

## 2. 라우트 추가하기

`src/index.ts` 를 열어서 그대로 추가:

```ts
app.post("/api/feedback", async (c) => {
  const body = await c.req.json();
  if (!body.message) return c.json({ error: "message 필수" }, 400);
  const res = await axhub.data("/feedback", { method: "POST", body: JSON.stringify(body) });
  return c.json(await res.json(), res.status as 200);
});
```

## 3. axhub Hub API 호출

`src/lib/axhub.ts` 의 헬퍼:

```ts
import { axhub } from "./lib/axhub.js";

const res = await axhub.fetch("/v1/users");
const users = await res.json();
```

## 4. axhub 에 배포

```
/axhub:deploy
```

또는 CLI:

```bash
axhub apps
axhub deploy create --app my-server-slug --branch main
axhub deploy status dep_xxxxx --watch
```

`apphub.yaml` 에서 `build: npm run build`, `start: npm start` 명시 — `tsc` 가 컴파일하고 `node dist/index.js` 가 실행돼요.

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
| `npm run build` 에러 "Cannot find module" | import 경로에 `.js` 확장자 붙였는지 확인 (NodeNext ESM 컨벤션) |
| 배포 후 502 | `apphub.yaml` 의 start 가 `npm start` 인지, dist/ 빌드 됐는지 |
| `tsx` 가 없다는 에러 | `npm install` 다시 (devDependencies 까지 설치) |

## 7. 왜 build 단계가 필요한가

Express 는 JS 라 그대로 실행, Hono 는 TS → tsc 로 컴파일 필요.
한 번 빌드하고 `dist/` 만 배포하면 더 빨라요.

## axhub.ts 신뢰 모델 (이 템플릿)

이 (Hono) 템플릿은 **server-side**. axhub 헬퍼는 6개 템플릿 모두 동일한 외부 API
(`axhub.fetch / data / slug / isConfigured`) 를 노출해요. Transport 만 달라요:
이 템플릿은 `Authorization: Bearer ${process.env.APPHUB_API_KEY}`.
`vite-react-axhub` / `nextjs-axhub` SPA / SSR 클라이언트의 가벼운 **backend 역할** 로 자주 쓰여요.
풀 비교 표는 [examples README](../README.md#axhubts-신뢰-모델-모든-템플릿) 참고.

## 8. 라이선스

MIT
