# remix-axhub

axhub 위에서 바로 굴러가는 **Remix 2 (SSR, Node 20+)** 템플릿이에요.
loader/action 패턴으로 풀스택을 한 파일에서 짤 수 있어 vibe coder 친화적.

## 0. 누가 쓰면 좋아요

서버 렌더링 + 데이터 로더가 필요한 vibe coder. 예: 검색 페이지, 사용자별 대시보드,
SEO 가 중요한 콘텐츠 사이트.

## 1. 5분 안에 시작

```bash
npx degit jocoding-ax-partners/examples/remix-axhub my-app
cd my-app
npm install
cp .env.example .env
# .env 의 APPHUB_* 값을 채워요.
npm run dev
# http://localhost:5173 접속
```

## 2. 바이브코딩 흐름

Remix 의 핵심: 한 라우트 파일에 `loader` (서버 데이터) + `action` (서버 변이) + 컴포넌트가 같이 있어요.

```
app/routes/feedback.tsx 만들어줘.
- loader: axhub.data("/feedback") GET 으로 기존 피드백 목록
- action: form 제출 시 axhub.data("/feedback") POST
- 컴포넌트: 폼 + 목록
- 모두 한 파일 안에서
```

## 3. axhub Hub API 쓰기

`app/lib/axhub.server.ts` — `.server.ts` 접미사가 **클라이언트 번들에서 자동 제외** 시켜줘요.

```ts
// app/routes/users.tsx
import { json, useLoaderData } from "@remix-run/react";
import { axhub } from "~/lib/axhub.server";

export async function loader() {
  const res = await axhub.fetch("/v1/users");
  return json(await res.json());
}

export default function Users() {
  const users = useLoaderData<typeof loader>();
  return <pre>{JSON.stringify(users, null, 2)}</pre>;
}
```

> ⚠️ axhub 헬퍼는 **Server-side 전용**이에요. 컴포넌트 본문에서 직접 호출 금지 — 항상 loader/action 안에서.

## 4. axhub 에 배포

```
/axhub:deploy
```

또는 CLI:

```bash
axhub apps
axhub deploy create --app my-app-slug --branch main
axhub deploy status dep_xxxxx --watch
```

`apphub.yaml` 에서 `start: npm start` 명시 — `remix-serve` 가 빌드 결과를 Express 로 띄워요.

## 5. 환경변수

| 변수 | 용도 |
|------|------|
| `APPHUB_API_URL` | Hub API endpoint |
| `APPHUB_API_KEY` | Hub API 인증 (Server-side 전용) |
| `APPHUB_APP_SLUG` | 내 앱 슬러그 |
| `APPHUB_DATA_BASE_URL` | Data plane base URL |

## 6. 자주 막히는 곳

| 증상 | 해결 |
|------|------|
| 클라이언트 번들 빌드 에러 "Cannot use ... in browser" | `axhub.server.ts` 를 loader/action 외부에서 import 했어요 |
| 배포 후 500 | `start` 가 `remix-serve` 를 호출하는지 (`npm start` 동작 확인) |
| 폼 submit 이 페이지 새로고침 | `<Form>` (Remix) 대신 `<form>` 썼는지 확인 |

## 7. 관련 자료

- [axhub 가이드](https://github.com/jocoding-ax-partners/axhub)
- [Remix docs](https://remix.run/docs)

## axhub.ts 신뢰 모델 (이 템플릿)

이 (Remix SSR) 템플릿은 **server-side**. axhub 헬퍼는 6개 템플릿 모두 동일한 외부 API
(`axhub.fetch / data / slug / isConfigured`) 를 노출해요. Transport 만 달라요:
이 템플릿은 `Authorization: Bearer ${process.env.APPHUB_API_KEY}`,
`.server.ts` 접미사가 클라이언트 번들 노출 자동 차단.
풀 비교 표는 [examples README](../README.md#axhubts-신뢰-모델-모든-템플릿) 참고.

## 8. 라이선스

MIT
