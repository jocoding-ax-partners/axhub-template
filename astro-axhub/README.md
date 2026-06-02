# astro-axhub

axhub 위에서 바로 굴러가는 **Astro 5 SSR (Node 20+)** 템플릿이에요.
콘텐츠 중심 사이트 + 부분 SSR 이 필요한 vibe coder 에게 적합.

## 0. 누가 쓰면 좋아요

랜딩, 블로그, 문서 사이트, 상품 페이지처럼 **HTML 위주 + 일부 동적 데이터** 가 필요한 vibe coder.
React 컴포넌트도 island 로 끼워 쓸 수 있어요 (필요할 때 `npm i @astrojs/react`).

## 1. 5분 안에 시작

```bash
npx degit jocoding-ax-partners/axhub-template/astro-axhub my-app
cd my-app
npm install
cp .env.example .env
# .env 의 APPHUB_* 값을 채워요. (axhub 로 배포하면 자동 주입돼요)
npm run dev
# http://localhost:4321 접속
```

## 2. 바이브코딩 흐름

`.astro` 파일은 **frontmatter (서버) + HTML 템플릿 + style** 한 파일에 다 들어가요.

```
src/pages/blog.astro 만들어줘.
- frontmatter: axhub.fetch("/api/v1/posts", {}, { cookie: Astro.request.headers.get("cookie") }) 결과를 posts 변수로
- 템플릿: posts.map 으로 카드 그리드
- style: scoped CSS, 모바일 친화
```

## 3. axhub Hub API 쓰기

`src/lib/axhub.ts` — Astro frontmatter / API endpoint 에서 import. 들어온 요청의 axhub 세션 쿠키를
포워딩해 *그 사용자 자격*으로 호출하므로, 3번째 인자로 `Astro.request` 쿠키를 넘겨줘요.

```astro
---
import { axhub } from "../lib/axhub";
const res = await axhub.fetch("/api/v1/me", {}, { cookie: Astro.request.headers.get("cookie") });
const me = await res.json();
---
<p>안녕하세요, {me.name} 님</p>
```

> ⚠️ axhub 헬퍼는 **Server-side 전용**이에요. `<script>` 태그(브라우저) 안에서 호출 금지 — 항상 frontmatter 또는 `src/pages/api/*.ts` endpoint 안에서. (브라우저엔 사용자 쿠키 컨텍스트가 없어요.)

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

빌드는 repo 의 `Dockerfile` 로 떠요 — `@astrojs/node` standalone 으로 만든 `dist/server/entry.mjs` 를 `node` 가 PORT=3000 으로 띄워요.

`axhub.yaml` 을 새로 쓰거나 고칠 때는 `axhub.yaml.example` 에 axhub.yaml 에서 쓸 수 있는 필드와 제약을 모두 적어뒀으니 먼저 참고하세요.

## 5. 환경변수 / 설정

| 변수 | 용도 |
|------|------|
| `APPHUB_API_URL` | Hub API origin (`{{API_BASE}}`) |
| `APPHUB_APP_SLUG` | 내 앱 슬러그 (`{{APP_SLUG}}`) |
| `APPHUB_TENANT` | 내 테넌트 슬러그 (`{{TENANT}}`) |

axhub 로 배포하면 위 값들은 소스의 `{{...}}` placeholder 치환으로 **자동 주입**돼요. `.env` 는 로컬 테스트용 override. **API key 는 없어요** — 인증은 들어온 요청의 세션 쿠키 포워딩으로.

## 6. 자주 막히는 곳

| 증상 | 해결 |
|------|------|
| 빌드 후 `entry.mjs` 가 없음 | `astro.config.ts` 에 `adapter: node({ mode: "standalone" })` 확인 |
| 배포 후 502 | `Dockerfile` 의 `CMD` 가 `node ./dist/server/entry.mjs` 인지, PORT=3000 인지 확인 |
| `<script>` 안에서 axhub 호출 시 에러 | 브라우저엔 사용자 쿠키 컨텍스트 없음 — frontmatter 로 옮기세요 |
| 페이지가 갑자기 정적 (변경 안 됨) | `export const prerender = true` 가 어딘가 켜져 있나 확인 |

## 7. React island 추가하기

```bash
npm i @astrojs/react react react-dom
npx astro add react   # config 자동 수정
```

그 후 `.astro` 안에서 `<MyReact client:load />` 로 끼워 써요.

## axhub.ts 신뢰 모델 (이 템플릿)

이 (Astro SSR) 템플릿은 **server-side** (frontmatter / API endpoint 는 서버에서 실행).
axhub 헬퍼는 3종 모두 동일한 외부 API (`axhub.fetch / data / slug / isConfigured`) 를 노출해요.
인증은 axhub 로그인 세션 쿠키(`_hub_access`)로: 호출 시 넘긴 `Astro.request` 쿠키를 백엔드에
`Authorization: Bearer` 로 포워딩해요. 정적 API key 안 써요.
풀 비교 표는 [axhub-template README](../README.md#axhubts-신뢰-모델-3종-공통) 참고.

## 8. 라이선스

MIT
