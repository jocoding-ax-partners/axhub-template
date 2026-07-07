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
npm run setup          # .env 없으면 예시 복사 + 로컬 Postgres 기동 (Docker 필요)
# .env 의 DATABASE_URL / APPHUB_* 값을 확인해요. (axhub 로 배포하면 자동 주입돼요)
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

## 3. 개발(dev) 환경

로컬에서 `npm run dev` 로 도는 환경 이야기예요. 배포(프로덕션)와 뭐가 다른지도 여기서 정리해요.

### 3-1. 핫리로드 (HMR)

`npm run dev`(`astro dev`)는 Vite 기반 dev 서버예요. 파일을 저장하면 **재시작 없이 즉시** 브라우저에 반영돼요. 별도 설정 필요 없어요.

- 반영이 안 되거나 화면이 이상하게 꼬이면: dev 서버 끄고 `node_modules/.vite` 폴더 삭제 후 `npm run dev` 재시작.
- `src/lib/db.ts` 의 DB 커넥션 풀은 핫리로드를 견디도록 dev 에서 재사용돼요 — 오래 개발해도 커넥션이 안 새요.

### 3-2. 로컬 DB 다루기

전부 npm 스크립트로 준비돼 있어요 (내부는 docker compose):

| 명령 | 하는 일 |
|------|---------|
| `npm run setup` | `.env` 없으면 예시 복사 + Postgres 기동 (최초 1회용) |
| `npm run db:up` | 로컬 Postgres 기동 (localhost:5432) |
| `npm run db:down` | 정지 — **데이터는 유지**돼요 |
| `npm run db:reset` | 정지 + **데이터 전부 삭제** 후 재기동 (초기화) |
| `npm run db:psql` | 실행 중인 DB 에 psql 콘솔로 접속 |

테이블은 `src/lib/db.ts` 의 `ensureSchema()` 가 자동 생성해요 (`CREATE TABLE IF NOT EXISTS`) —
마이그레이션 파일 없이, 스키마를 고치고 저장하면 다음 요청 때 반영돼요.
테이블 구조를 크게 바꿔서 꼬였다면 `npm run db:reset` 이 제일 빨라요.

### 3-3. dev vs 프로덕션

| | 로컬 dev (`npm run dev`) | 배포 (axhub) |
|---|---|---|
| 실행 방식 | Vite dev 서버 + HMR (포트 4321) | `astro build` → `node ./dist/server/entry.mjs` (포트 3000) |
| `NODE_ENV` | `development` | `production` (Dockerfile 이 고정) |
| DB | docker compose Postgres (`.env`) | axhub 발급 전용 DB (`DATABASE_URL` 자동 주입) |
| 로그인 사용자 | 없음 → `'local-dev'` 폴백 | 실제 axhub 로그인 사용자 (`me.email`) |

- 로그인(SDK 호출)은 axhub 세션 쿠키(`_hub_access`)가 필요해서 **로컬 단독으론 동작하지 않아요.**
  로컬에선 사용자 키가 `'local-dev'` 로 폴백되고, 실제 로그인은 배포 후 확인하세요.
- 배포 전에 프로덕션 모드로 미리 검증하고 싶으면: `npm run build && npm start`.

## 4. 데이터 저장 (표준 PostgreSQL)

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
- **로컬**: `npm run db:up` 으로 Postgres 를 띄우고 `.env` 의 `DATABASE_URL` 사용 (§3-2). **배포**: `axhub.yaml` 의 `database: { engine: postgres }` 선언으로 axhub 가 전용 DB 를 발급하고 `DATABASE_URL` / `DIRECT_DATABASE_URL` 을 자동 주입해요.

누가 로그인했는지(사용자별 데이터의 `user_key`)는 `@ax-hub/sdk 6.x` 로 — `src/lib/axhub-server.ts` 가 들어온 요청의 axhub 세션 쿠키를 *그 사용자 자격*으로 포워딩해요.

```astro
---
import { makeAxhub } from "../lib/axhub-server";
const sdk = makeAxhub({ cookie: Astro.request.headers.get("cookie") });
const me = await sdk.identity.me();              // me.email 을 user_key 로 쓰면 사용자별 격리
---
<p>안녕하세요, {me.name ?? me.email} 님</p>
```

> ⚠️ `src/lib/db.ts` · `src/lib/axhub-server.ts` 는 **Server-side 전용**이에요. `<script>` 태그(브라우저) 안에서 호출 금지 — 항상 frontmatter 또는 `src/pages/api/*.ts` endpoint 안에서. `src/lib/axhub.ts` 는 호환 re-export 이며 새 코드는 `src/lib/axhub-server.ts` 를 직접 import 하세요.

## 5. axhub 에 배포

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

## 6. 환경변수 / 설정

| 변수 | 용도 |
|------|------|
| `DATABASE_URL` | 앱 데이터 PostgreSQL (런타임 쿼리, 풀러 경유) |
| `DIRECT_DATABASE_URL` | 스키마 초기화/마이그레이션용 직결 세션 (로컬은 비우면 `DATABASE_URL` 폴백) |
| `APPHUB_API_URL` | Hub API origin (`{{API_BASE}}`) |
| `APPHUB_APP_SLUG` | 내 앱 슬러그 (`{{APP_SLUG}}`) |
| `APPHUB_TENANT` | 내 테넌트 슬러그 (`{{TENANT}}`) |

axhub 로 배포하면 위 값들은 **자동 주입**돼요 — `DATABASE_URL` / `DIRECT_DATABASE_URL` 은 `database: { engine: postgres }` 선언으로 발급되고, `APPHUB_*` 는 소스의 `{{...}}` placeholder 치환으로. `.env` 는 로컬 테스트용 override. **API key 는 없어요** — 인증은 들어온 요청의 세션 쿠키 포워딩으로.

## 7. 자주 막히는 곳

| 증상 | 해결 |
|------|------|
| DB 연결 실패 (`ECONNREFUSED ... 5432`) | Docker Desktop 실행 확인 후 `npm run db:up` |
| `db:up` 이 `port is already allocated` | 5432 를 다른 Postgres 가 쓰는 중 — `docker-compose.yml` 의 ports 를 `"5433:5432"` 로 바꾸고 `.env` 의 DATABASE_URL 포트도 5433 으로 |
| 테이블/데이터가 꼬임 | `npm run db:reset` — ⚠️ 로컬 데이터 전부 삭제돼요 |
| 저장해도 화면에 반영이 안 됨 | dev 서버 끄고 `node_modules/.vite` 삭제 후 `npm run dev` 재시작 (§3-1) |
| 빌드 후 `entry.mjs` 가 없음 | `astro.config.ts` 에 `adapter: node({ mode: "standalone" })` 확인 |
| 배포 후 502 | `Dockerfile` 의 `CMD` 가 `node ./dist/server/entry.mjs` 인지, PORT=3000 인지 확인 |
| `<script>` 안에서 axhub 호출 시 에러 | 브라우저엔 사용자 쿠키 컨텍스트 없음 — frontmatter 로 옮기세요 |
| 페이지가 갑자기 정적 (변경 안 됨) | `export const prerender = true` 가 어딘가 켜져 있나 확인 |

## 8. React island 추가하기

```bash
npm i @astrojs/react react react-dom
npx astro add react   # config 자동 수정
```

그 후 `.astro` 안에서 `<MyReact client:load />` 로 끼워 써요.

## 신뢰 모델 (이 템플릿)

이 (Astro SSR) 템플릿은 **server-side** (frontmatter / API endpoint 는 서버에서 실행).
- **데이터**: `src/lib/db.ts` 의 `db()` / `ensureSchema()` — 표준 PostgreSQL. 로컬은 docker compose, 배포는 axhub 가 `DATABASE_URL` / `DIRECT_DATABASE_URL` 주입.
- **인증/식별**: `@ax-hub/sdk 6.x` 의 `AxHubClient` — helper 는 `makeAxhub` / `makeTenant` + `APP_SLUG` / `TENANT` / `isAxhubConfigured()` 를 노출해요. axhub 로그인 세션 쿠키(`_hub_access`)로 인증: 호출 시 넘긴 `Astro.request` 쿠키를 SDK JWT 로 전달하고, SDK 가 `Authorization: Bearer` 로 처리해요. 정적 API key 안 써요. 모듈-레벨 client 캐시 금지 — 매 요청마다 factory.

풀 비교 표는 [axhub-template README](../README.md#axhubts-신뢰-모델-3종-공통) 참고.

## 9. 라이선스

MIT
