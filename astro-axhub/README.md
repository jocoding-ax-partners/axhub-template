# astro-axhub

axhub 위에서 바로 굴러가는 **Astro 5 SSR (Node 20+)** 템플릿이에요.
콘텐츠 중심 사이트 + 부분 SSR 이 필요한 vibe coder 에게 적합.

## 0. 누가 쓰면 좋아요

랜딩, 블로그, 문서 사이트, 상품 페이지처럼 **HTML 위주 + 일부 동적 데이터** 가 필요한 vibe coder.
React 컴포넌트도 island 로 끼워 쓸 수 있어요 (필요할 때 `npm i @astrojs/react`).

## 1. 5분 안에 시작

```bash
npx degit jocoding-ax-partners/examples/astro-axhub my-app
cd my-app
npm install
cp .env.example .env
# .env 의 APPHUB_* 값을 채워요.
npm run dev
# http://localhost:4321 접속
```

## 2. 바이브코딩 흐름

`.astro` 파일은 **frontmatter (서버) + HTML 템플릿 + style** 한 파일에 다 들어가요.

```
src/pages/blog.astro 만들어줘.
- frontmatter: axhub.fetch("/v1/posts") 결과를 posts 변수로
- 템플릿: posts.map 으로 카드 그리드
- style: scoped CSS, 모바일 친화
```

## 3. axhub Hub API 쓰기

`src/lib/axhub.ts` — Astro frontmatter / API endpoint 에서 그대로 import.

```astro
---
import { axhub } from "../lib/axhub";
const res = await axhub.fetch("/v1/me");
const me = await res.json();
---
<p>안녕하세요, {me.name} 님</p>
```

> ⚠️ axhub 헬퍼는 **Server-side 전용**이에요. `<script>` 태그 안에서 직접 호출 금지 — 항상 frontmatter 또는 `src/pages/api/*.ts` endpoint 안에서.

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

`apphub.yaml` 에 `start: npm start` 명시 — `@astrojs/node` standalone 모드로 빌드된 `dist/server/entry.mjs` 가 PORT=3000 으로 떠요.

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
| 빌드 후 `entry.mjs` 가 없음 | `astro.config.ts` 에 `adapter: node({ mode: "standalone" })` 확인 |
| 배포 후 502 | `start` 가 PORT=3000 으로 띄우는지 (`apphub.yaml` start 명령 확인) |
| `<script>` 안에서 axhub 호출 시 에러 | 클라이언트 번들엔 import.meta.env 의 시크릿 안 들어감 — frontmatter 로 옮기세요 |
| 페이지가 갑자기 정적 (변경 안 됨) | `export const prerender = true` 가 어딘가 켜져 있나 확인 |

## 7. React island 추가하기

```bash
npm i @astrojs/react react react-dom
npx astro add react   # config 자동 수정
```

그 후 `.astro` 안에서 `<MyReact client:load />` 로 끼워 써요.

## axhub.ts 신뢰 모델 (이 템플릿)

이 (Astro SSR) 템플릿은 **server-side** (frontmatter / API endpoint 는 서버에서 실행).
axhub 헬퍼는 6개 템플릿 모두 동일한 외부 API (`axhub.fetch / data / slug / isConfigured`) 를 노출해요.
Transport 만 달라요: 이 템플릿은 `Authorization: Bearer ${process.env.APPHUB_API_KEY}`.
풀 비교 표는 [examples README](../README.md#axhubts-신뢰-모델-모든-템플릿) 참고.

## 8. 라이선스

MIT
