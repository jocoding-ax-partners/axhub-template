# AI Agents Guide

이 프로젝트의 **모든 AI 에이전트 행동 규칙** 이에요. Claude Code, Codex, 다른 어떤 AI 도구든 이 파일이 source-of-truth.
한국어 vibe coder 가 좋은 결과를 얻도록 설계됐어요.

## 사용자
비전공자 한국인 vibe coder. 한국어로 답해요. 콘텐츠 사이트 + SSR. 결과는 브라우저로 확인.

## Stack
Astro 5 · @astrojs/node (standalone) · TypeScript · Node 20+ · **SSR** ·
**데이터는 표준 PostgreSQL** (`src/lib/db.ts`, `DATABASE_URL`) · **인증/식별은 `@ax-hub/sdk 6.x`** (`src/lib/axhub-server.ts`, 서버 호출 전용).

## 5가지 Vibe Coder 프로토콜 (모든 작업에 적용)

1. **Plan first** — 다단계 작업 시작 전, 한국어로 한 줄 plan 보여줘요.
   예: "1. `src/lib/db.ts` 에 테이블 추가 → 2. `src/pages/blog.astro` frontmatter 에서 조회·표시 → 3. 카드 그리드". 사용자 OK 후 코드.
2. **Verify-then-claim** — 페이지 변경 후 "되긴 해요" / "should work" / "테스트 해보세요" 만으로 끝 금지.
   정확히 어디 접속해서 무엇이 보여야 하는지 알려줘요.
   예: "http://localhost:4321/blog 접속 → 글 카드 N개 보여야 해요. 빈 페이지면 frontmatter 에러 알려주세요."
   사용자 확인 전엔 "완료" 표시 금지.
3. **No unprompted refactor** — X 요청에 Y / Z 같이 "개선" 금지.
4. **Honest failure** — 못 만들면 plainly 말해요. 가짜 성공 보고 금지.
5. **Ask before install** — npm install 전에 한 번 물어봐요.

## 데이터 = 표준 PostgreSQL (`src/lib/db.ts`)

> 사용자는 "방명록 저장되게 / 글 목록 보여줘" 처럼 **결과만** 말해요. 이 앱의 데이터는 이 앱 전용
> **PostgreSQL** 에 저장해요 — `src/lib/db.ts` 가 단일 진입점이에요. 평범한 SQL 을 쓰면 돼요(특별한 API 없음).

### D1. read/write 는 `src/lib/db.ts` 의 `db()` 로 — 평범한 SQL
```ts
import { db, ensureSchema } from '../lib/db'
await ensureSchema()                                  // 첫 read/write 전에 한 번 (테이블 정의는 src/lib/db.ts 에)
// 값은 tagged-template 으로 — 자동 바인딩되어 SQL injection 안전. 문자열 이어붙이기 금지.
await db()`INSERT INTO todos (user_key, title) VALUES (${userKey}, ${title})`
const rows = await db()<{ id: string; title: string }[]>`
  SELECT id::text, title FROM todos WHERE user_key = ${userKey} ORDER BY id DESC LIMIT 50`
```

### D2. 테이블은 `ensureSchema()` 에 `CREATE TABLE IF NOT EXISTS` 로
- 새 테이블/컬럼이 필요하면 `src/lib/db.ts` 의 `ensureSchema()` 안에 `CREATE TABLE IF NOT EXISTS ...`
  (또는 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) 한 줄을 추가. 별도 마이그레이션 도구 불필요.
- `id`/`created_at` 같은 컬럼도 직접 SQL 로 선언 (자동 추가 같은 마법 없음 — 평범한 Postgres).

### D3. 사용자별 데이터 → `user_key` 컬럼 + 로그인 사용자
- **자동 격리는 없어요.** 자기 데이터만 보이게 하려면 테이블에 `user_key text` 컬럼을 두고,
  모든 쿼리를 `WHERE user_key = ${userKey}` 로 직접 필터해요.
- 로그인 사용자는 SDK 로: `const me = await makeAxhub(ctx).identity.me()` → `me.email`(안정적인 식별자)을 `user_key` 로.
  배포 시엔 실제 로그인 사용자, 로컬 단독 실행 땐 `'local-dev'` 로 폴백 (예: `src/pages/index.astro` 의 `userKey`).

### D4. 쓰기는 frontmatter POST (PRG) — Astro 는 SSR
- Astro 는 `output: "server"` SSR 이라 **frontmatter 에서 POST 를 직접 처리**해요. 폼 → DB 쓰기 → redirect:
  ```ts
  // src/pages/index.astro frontmatter
  if (dbReady && Astro.request.method === "POST") {
    const form = await Astro.request.formData()
    await ensureSchema()
    await db()`INSERT INTO todos (user_key, title) VALUES (${userKey}, ${String(form.get("title"))})`
    return Astro.redirect("/")          // PRG — 새로고침 후 GET 으로 목록 표시
  }
  ```
- `src/pages/api/*.ts` endpoint(`POST(request)`)에서도 `request.formData()` / JSON body → `db()` 로 쓸 수 있어요.
- frontmatter · `src/pages/api/*.ts` 안에서만 (Framework-Specific 참조). `<script>` 태그(브라우저)에서 호출 금지.

### D5. 로컬은 docker, 배포는 axhub 가 주입
- **로컬**: `docker compose up -d` 로 Postgres 를 띄우고 `.env` 의 `DATABASE_URL` 사용.
- **배포**: `axhub.yaml` 의 `database: { engine: postgres }` 선언으로 axhub 가 이 앱 전용 DB 를 발급하고
  `DATABASE_URL` / `DIRECT_DATABASE_URL` 을 자동 주입해요. `isDbConfigured()` 가 false 면 아직 로컬 DB 미설정.

### D6. 코드가 secret(API 키 등)을 쓰면 → axhub env 에 등록 (배포 필수)
`.env` 만 채우면 **로컬만** 돌아가요. 배포 환경엔 그 값이 없어 배포 preflight 가 막히거나 런타임에 `env: <KEY> not found` 로 깨져요.
1. `axhub.yaml` 의 `env` 에 **이름과 scope 만** 선언 (값은 적지 않음). `scope` 는 `build` / `runtime` / `both` — 런타임에 쓰는 API 키는 `runtime`:
   ```yaml
   env:
     required:
       - { name: OPENAI_API_KEY, scope: runtime }
   ```
2. 값은 CLI 로 등록 (콘솔도 되지만 CLI 권장 · 값은 stdin 으로만 — 명령행 노출 방지). `--stage` 는 위 `scope` 와 같은 값:
   ```bash
   printf %s "$OPENAI_API_KEY" | axhub env set OPENAI_API_KEY --app <APP_SLUG> --secret --from-stdin --stage runtime --json
   ```
- `DATABASE_URL` / `DIRECT_DATABASE_URL` / `APPHUB_*` 는 axhub 가 **자동 주입**해요 — 직접 등록 불필요. 소스에 `{{...}}` 가 그대로 보이거나 `isAxhubConfigured()` 가 false 면 아직 미배포/미설정 상태이니, 코드를 깨지 말고 그 사실을 사용자에게 알려요.

## Framework-Specific Rules (Astro 5 SSR)

- `astro.config.ts` 의 `output: "server"` + `adapter: node({ mode: "standalone" })` **절대 바꾸지 마요**. 이게 axhub 배포 핵심.
- `src/lib/db.ts` · `src/lib/axhub-server.ts` 는 **frontmatter / API endpoint (`src/pages/api/*.ts`) / `getStaticPaths` 안에서만** import. `<script>` 태그(브라우저) 안 호출 금지 — DB 드라이버·세션 쿠키는 server-only. `src/lib/axhub.ts` 는 호환 re-export 뿐이므로 새 코드는 `axhub-server` 를 직접 import.
- `.astro` 한 파일에 frontmatter + 템플릿 + scoped style 같이 두는 게 컨벤션. 분리 금지.
- React/Vue 가 정말 필요한 경우만 island 추가 (`npm i @astrojs/react`). 기본은 `.astro`.
- 변경 보고: `file:line` 형식.

## 절대 규칙 (negative-phrased)

- DO NOT `output: "server"` 또는 `adapter: node({ mode: "standalone" })` 변경.
- DO NOT `db.ts` · `axhub-server.ts` · `axhub.ts` 를 `<script>` 태그 안에서 import.
- DO NOT DB 쿼리에 사용자 입력을 문자열로 이어붙이기 — 항상 tagged-template `db()\`... ${value} ...\`` 로 바인딩.
- DO NOT `.env` 커밋.
- DO NOT 사용자 동의 없이 destructive git.
- DO NOT 새 npm 패키지 사용자 확인 없이 설치.

## 신뢰 모델 (1-line)

이 (Astro) 템플릿은 **server-side** (frontmatter 는 빌드/요청 시 서버에서 실행).
- **데이터**: `src/lib/db.ts` 의 `db()` / `ensureSchema()` — `DATABASE_URL`(런타임, prepare:false) · `DIRECT_DATABASE_URL`(마이그레이션). 로컬은 docker compose, 배포는 axhub 주입.
- **인증/식별**: `src/lib/axhub-server.ts` 의 `@ax-hub/sdk 6.x` factory(`makeAxhub` / `makeTenant` + `APP_SLUG` / `TENANT` / `isAxhubConfigured()`). 호출 시 넘긴 `Astro.request` 쿠키에서 `_hub_access` 를 꺼내 SDK JWT 로 전달하고, SDK 가 `Authorization: Bearer` 로 처리해요. 정적 API key 안 씀. `src/lib/axhub.ts` 는 호환 re-export 이며 새 코드는 `axhub-server` 를 직접 import. 풀 비교 표는 [axhub-template README](../README.md#axhubts-신뢰-모델-3종-공통) 참고.

## 배포

`/axhub:deploy` 또는 `axhub deploy create --app <slug> --branch main`. 빌드는 repo 의 `Dockerfile`(`node ./dist/server/entry.mjs`, PORT=3000)로 떠요.
