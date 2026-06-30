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
# .env 의 DATABASE_URL / APPHUB_* 값을 확인해요. (axhub 로 배포하면 자동 주입돼요)
docker compose up -d   # 로컬 Postgres 띄우기 (데이터 저장용)
npm run dev
# http://localhost:4321 접속
```

## 2. 바이브코딩 흐름

`.astro` 파일은 **frontmatter (서버) + HTML 템플릿 + style** 한 파일에 다 들어가요.

```
src/pages/blog.astro 만들어줘.
- frontmatter: src/lib/db.ts 의 db()`SELECT ...` 로 글 목록을 posts 변수로
- 템플릿: posts.map 으로 카드 그리드
- style: scoped CSS, 모바일 친화
```

## 3. 데이터 저장 (표준 PostgreSQL)

이 앱의 데이터는 이 앱 전용 **PostgreSQL** 에 저장해요 — `src/lib/db.ts` 가 단일 진입점이에요. 특별한 API 없이 평범한 SQL 을 써요.

```astro
---
import { db, ensureSchema } from "../lib/db";

// 쓰기는 frontmatter POST (Astro 는 output:"server" SSR) — PRG 패턴
if (Astro.request.method === "POST") {
  const form = await Astro.request.formData();
  await ensureSchema();                          // 첫 read/write 전에 한 번 (테이블 정의는 src/lib/db.ts 에)
  // 값은 tagged-template 으로 — 자동 바인딩되어 SQL 인젝션 안전. 문자열 이어붙이기 금지.
  await db()`INSERT INTO todos (user_key, title) VALUES (${userKey}, ${String(form.get("title"))})`;
  return Astro.redirect("/");                    // 새로고침 후 GET 으로 목록 표시
}

await ensureSchema();
const todos = await db()<{ id: string; title: string }[]>`
  SELECT id::text, title FROM todos WHERE user_key = ${userKey} ORDER BY id DESC LIMIT 50`;
---
```

- 새 테이블/컬럼이 필요하면 `src/lib/db.ts` 의 `ensureSchema()` 에 `CREATE TABLE IF NOT EXISTS ...` 한 줄을 추가해요 (별도 마이그레이션 도구 불필요).
- **로컬**: `docker compose up -d` 로 Postgres 를 띄우고 `.env` 의 `DATABASE_URL` 사용. **배포**: `axhub.yaml` 의 `database: { engine: postgres }` 선언으로 axhub 가 전용 DB 를 발급하고 `DATABASE_URL` / `DIRECT_DATABASE_URL` 을 자동 주입해요.

누가 로그인했는지(사용자별 데이터의 `user_key`)는 `@ax-hub/sdk 3.x` 로 — `src/lib/axhub-server.ts` 가 들어온 요청의 axhub 세션 쿠키를 *그 사용자 자격*으로 포워딩해요.

```astro
---
import { makeAxhub } from "../lib/axhub-server";
const sdk = makeAxhub({ cookie: Astro.request.headers.get("cookie") });
const me = await sdk.identity.me();              // me.email 을 user_key 로 쓰면 사용자별 격리
---
<p>안녕하세요, {me.name ?? me.email} 님</p>
```

> ⚠️ `src/lib/db.ts` · `src/lib/axhub-server.ts` 는 **Server-side 전용**이에요. `<script>` 태그(브라우저) 안에서 호출 금지 — 항상 frontmatter 또는 `src/pages/api/*.ts` endpoint 안에서. `src/lib/axhub.ts` 는 호환 re-export 이며 새 코드는 `src/lib/axhub-server.ts` 를 직접 import 하세요.

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
| `DATABASE_URL` | 앱 데이터 PostgreSQL (런타임 쿼리, 풀러 경유) |
| `DIRECT_DATABASE_URL` | 스키마 초기화/마이그레이션용 직결 세션 (로컬은 비우면 `DATABASE_URL` 폴백) |
| `APPHUB_API_URL` | Hub API origin (`{{API_BASE}}`) |
| `APPHUB_APP_SLUG` | 내 앱 슬러그 (`{{APP_SLUG}}`) |
| `APPHUB_TENANT` | 내 테넌트 슬러그 (`{{TENANT}}`) |

axhub 로 배포하면 위 값들은 **자동 주입**돼요 — `DATABASE_URL` / `DIRECT_DATABASE_URL` 은 `database: { engine: postgres }` 선언으로 발급되고, `APPHUB_*` 는 소스의 `{{...}}` placeholder 치환으로. `.env` 는 로컬 테스트용 override. **API key 는 없어요** — 인증은 들어온 요청의 세션 쿠키 포워딩으로.

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

## 신뢰 모델 (이 템플릿)

이 (Astro SSR) 템플릿은 **server-side** (frontmatter / API endpoint 는 서버에서 실행).
- **데이터**: `src/lib/db.ts` 의 `db()` / `ensureSchema()` — 표준 PostgreSQL. 로컬은 docker compose, 배포는 axhub 가 `DATABASE_URL` / `DIRECT_DATABASE_URL` 주입.
- **인증/식별**: `@ax-hub/sdk 3.x` 의 `AxHubClient` — helper 는 `makeAxhub` / `makeTenant` + `APP_SLUG` / `TENANT` / `isAxhubConfigured()` 를 노출해요. axhub 로그인 세션 쿠키(`_hub_access`)로 인증: 호출 시 넘긴 `Astro.request` 쿠키를 SDK JWT 로 전달하고, SDK 가 `Authorization: Bearer` 로 처리해요. 정적 API key 안 써요. 모듈-레벨 client 캐시 금지 — 매 요청마다 factory.

풀 비교 표는 [axhub-template README](../README.md#axhubts-신뢰-모델-3종-공통) 참고.

## 8. 라이선스

MIT
