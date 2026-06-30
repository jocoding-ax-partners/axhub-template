# AI Agents Guide

이 프로젝트의 **모든 AI 에이전트 행동 규칙** 이에요. Claude Code, Codex, 다른 어떤 AI 도구든 이 파일이 source-of-truth.
한국어 vibe coder 가 좋은 결과를 얻도록 설계됐어요.

## 사용자
비전공자 한국인 vibe coder. 한국어로 답해요. 코드 용어는 풀어서 설명해요. 결과는 화면으로 확인.

## Stack
Next.js 16 (App Router · RSC · Server Actions) · React 19 · TypeScript strict · Tailwind 3 · Node 20+ ·
**데이터는 표준 PostgreSQL** (`lib/db.ts`, `DATABASE_URL`) · **인증/식별 · 외부 connector 는 `@ax-hub/sdk 3.x`** (`lib/axhub-server.ts`).

## 5가지 Vibe Coder 프로토콜 (모든 작업에 적용)

1. **Plan first** — 다단계 작업 시작 전, 한국어로 한 줄 plan 보여줘요.
   예: "1. `lib/db.ts` 에 테이블 추가 → 2. `app/page.tsx` 에서 조회·표시 → 3. 결과 확인". 사용자 OK 후 코드.
2. **Verify-then-claim** — UI 변경 후 "되긴 해요" / "should work" 만으로 끝 금지.
   정확히 어디 접속해서 무엇이 보여야 하는지 알려줘요.
   예: "http://localhost:3000 새로고침 → '내 할 일' 카드에 방금 추가한 항목이 보여야 해요. 안 보이면 알려주세요."
   사용자 확인 전엔 "완료" 표시 금지.
3. **No unprompted refactor** — X 요청에 Y / Z 같이 "개선" 금지. 변경한 모든 line 이 X 와 직접 관련.
4. **Honest failure** — 못 만들면 plainly 말해요. "아직 안 풀렸어요. 시도: A, B. 모름: C." 가짜 성공 보고 금지.
5. **Ask before install** — 작은 utility 라도 npm install 전에 "X 추가해도 될까요? 이유: Y" 한 번 물어봐요.
   (단, `@ax-hub/sdk` 와 `postgres` 는 이미 설치돼 있으니 다시 설치 금지.)

## 데이터 = 표준 PostgreSQL (`lib/db.ts`)

> 사용자는 "대화 저장되게 / 주문 목록 보여줘" 처럼 **결과만** 말해요. 이 앱의 데이터는 이 앱 전용
> **PostgreSQL** 에 저장해요 — `lib/db.ts` 가 단일 진입점이에요. 평범한 SQL 을 쓰면 돼요(특별한 API 없음).

### D1. read/write 는 `lib/db.ts` 의 `db()` 로 — 평범한 SQL
```ts
import { db, ensureSchema } from '@/lib/db'
await ensureSchema()                                  // 첫 read/write 전에 한 번 (테이블 정의는 lib/db.ts 에)
// 값은 tagged-template 으로 — 자동 바인딩되어 SQL injection 안전. 문자열 이어붙이기 금지.
await db()`INSERT INTO todos (user_key, title) VALUES (${userKey}, ${title})`
const rows = await db()<{ id: string; title: string }[]>`
  SELECT id::text, title FROM todos WHERE user_key = ${userKey} ORDER BY id DESC LIMIT 50`
```

### D2. 테이블은 `ensureSchema()` 에 `CREATE TABLE IF NOT EXISTS` 로
- 새 테이블/컬럼이 필요하면 `lib/db.ts` 의 `ensureSchema()` 안에 `CREATE TABLE IF NOT EXISTS ...`
  (또는 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) 한 줄을 추가. 별도 마이그레이션 도구 불필요.
- `id`/`created_at` 같은 컬럼도 직접 SQL 로 선언 (자동 추가 같은 마법 없음 — 평범한 Postgres).

### D3. 사용자별 데이터 → `user_key` 컬럼 + 로그인 사용자
- **자동 격리는 없어요.** 자기 데이터만 보이게 하려면 테이블에 `user_key text` 컬럼을 두고,
  모든 쿼리를 `WHERE user_key = ${userKey}` 로 직접 필터해요.
- 로그인 사용자는 SDK 로: `const me = await (await makeAxhub()).identity.me()` → `me.email`(안정적인 식별자)을 `user_key` 로.
  배포 시엔 실제 로그인 사용자, 로컬 단독 실행 땐 `'local-dev'` 로 폴백 (예: `app/page.tsx` 의 `currentUserKey()`).

### D4. 로컬은 docker, 배포는 axhub 가 주입
- **로컬**: `docker compose up -d` 로 Postgres 를 띄우고 `.env.local` 의 `DATABASE_URL` 사용.
- **배포**: `axhub.yaml` 의 `database: { engine: postgres }` 선언으로 axhub 가 이 앱 전용 DB 를 발급하고
  `DATABASE_URL` / `DIRECT_DATABASE_URL` 을 자동 주입해요. `isDbConfigured()` 가 false 면 아직 로컬 DB 미설정.

### D5. 코드가 secret(API 키 등)을 쓰면 → axhub env 에 등록 (배포 필수)
`.env.local` 만 채우면 **로컬만** 돌아가요. 배포 환경엔 그 값이 없어 런타임에 `env: <KEY> not found` 로 깨져요.
1. `axhub.yaml` 의 `env` 에 **이름과 scope 만** 선언 (값은 적지 않음). `scope` 는 `build`/`runtime`/`both`:
   ```yaml
   env:
     required:
       - { name: OPENAI_API_KEY, scope: runtime }
   ```
2. 값은 CLI 로 등록 (값은 stdin 으로만 — 명령행 노출 방지):
   ```bash
   printf %s "$OPENAI_API_KEY" | axhub env set OPENAI_API_KEY --app <APP_SLUG> --secret --from-stdin --stage runtime --json
   ```
- `DATABASE_URL` / `DIRECT_DATABASE_URL` / `APPHUB_*` 는 axhub 가 **자동 주입** — 직접 등록 불필요.

## SDK 사용 프로토콜 (인증/식별 · 외부 connector)

> 이 템플릿에서 `@ax-hub/sdk 3.x` 는 **인증/식별**과 **외부 connector(gateway)** 호출에 써요. (앱 데이터는 위 PostgreSQL.)
> 사용자 자격은 `lib/axhub-server.ts` 의 `makeAxhub()` factory 가 자동 처리해요. raw `fetch()` 로 `api.axhub.ai` 직접 호출 금지.

### S1. 진입점은 factory 만 — 모듈 레벨 클라이언트 금지
- ✅ 매 호출마다 `const sdk = await makeAxhub()`.
- ❌ 파일 최상단에 `const sdk = new AxHubClient({...})` 캐싱 — 사용자 자격이 다음 요청에 누설돼요.
- 이유: 들어온 요청의 `_hub_access` 쿠키마다 다른 사용자. SDK 인스턴스는 그 요청 안에서만 유효.

### S2. 슬러그 하드코딩 금지 — helper / 상수 사용
- ✅ tenant 만 필요하면 `const t = await makeTenant()` → `t.apps.list()`.
- ❌ `sdk.tenant('my-tenant')` 처럼 슬러그 문자열 박지 마요 — `lib/axhub-server.ts` 의 `TENANT`/`APP_SLUG` 상수가 환경별로 달라요.
- ❌ flat 호출 (`sdk.apps.create(...)` 같이 tenant 스코프 없이) 금지 — `TenantSlugRequiredError`. (단, `sdk.identity.*` 는 tenant 불필요 — 예외.)

### S3. 서버 전용 — 클라이언트 컴포넌트에서 import 금지
- ✅ `app/page.tsx`, `app/api/.../route.ts`, Server Action 안에서만 `lib/axhub-server.ts` / `lib/db.ts` import.
- ❌ `"use client"` 컴포넌트에서 `makeAxhub` / `db` import — `next/headers` · DB 드라이버는 server-only 라 빌드 깨져요.
- 클라이언트에서 백엔드가 필요하면 Route Handler (`app/api/.../route.ts`) 또는 Server Action 거치게.

### S4. 에러는 `error.code` / `instanceof` 로 분기 — 메시지 문자열 매칭 금지
- ✅ `if (err instanceof AxHubError && err.code === 'slug_taken')`.
- ❌ `if (err.message.includes('이미 존재'))` — 백엔드 메시지는 변경 가능, machine-readable 한 건 `code`/`category` 뿐.
- 자주 쓰는 클래스: `ValidationError`, `UnauthenticatedError`, `PermissionDeniedError`, `NotFoundError`, `ConflictError`, `AxHubError`(catch-all).
- DB(`lib/db.ts`) 호출은 표준 postgres 에러를 던져요 — try/catch 로 감싸요.

### S5. Gateway query — 외부 DB/SaaS 조회는 `queryConnector()` 로
> **이 기능은 핵심.** 외부 시스템(자체 PostgreSQL/MySQL/SaaS connector) 데이터를 안전하게 읽어요.
> 모든 호출은 audit log 에 기록되고 connector 권한 정책으로 게이트돼요. 직접 DB 접속 금지.
> (이 앱 자체의 데이터 저장과는 별개 — 그건 위 `lib/db.ts` PostgreSQL.)

> ⚠️ **gateway 는 tenant 경로에 UUID 를 요구해요 (slug 거부 → 400 invalid_format).** slug 기반 `makeTenant()` 로는 안 돼요.
> `lib/axhub-server.ts` 의 `makeGateway()` (me() 로 tenant UUID 자동 스코프) / `queryConnector()` 를 쓰세요.

#### 기본 사용 — connector "이름" 으로 (UUID 자동 resolve)
```ts
import { queryConnector } from '@/lib/axhub-server'
const res = await queryConnector<{ id: number; name: string }>({
  connector: 'my-db',          // connector 이름 (gateway.me.connectors() 의 .name) — UUID 아님, helper 가 resolve
  sql: 'SELECT id, name FROM public.employees WHERE active = $1 LIMIT $2',  // postgres 네이티브 $n placeholder — '?' 는 백엔드에서 500(internal_error)
  params: [true, 10],          // ✅ 항상 parameterized · $1,$2 순서대로 — SQL injection 방지
})
// res.rows: 컬럼명으로 매핑된 객체 배열 · res.rowCount · res.columns
// 정책 deny 는 in-band 플래그가 아니라 throw — try/catch 로 PermissionDeniedError 분기.
```

> **SDK 3.x gateway 모델:** connector 에 **활성 grant** 가 있어야 **session** 을 열고, SQL 은 그 session 으로 실행해요.
> `queryConnector()` 가 (grant 보유 connector resolve → session open → query → session close) 를 한 번에 감싸요.

#### 저수준 — 직접 session 을 다룰 때
```ts
import { makeGateway } from '@/lib/axhub-server'
const gw = await makeGateway()                       // tenant UUID 로 스코프된 gateway (makeTenant 아님!)
const connectors = await gw.me.connectors()          // 배열 — 내가 grant 가진 connector 만. .find(c => c.name === 'my-db')
const session = await gw.sessions.create({ connectorId: connectors[0].id })  // grant 없으면 NotFoundError
try {
  const res = await gw.query.run({ sessionId: session.id, sql: 'SELECT 1' })
} finally {
  await gw.sessions.end(session.id)                  // 끝나면 반드시 닫기
}
```
- `gw.me.connectors()` / `gw.me.connectorResources(id)` / `gw.me.grants()` 는 **배열** 반환 (member-scoped — 내 grant 기준).
- REST connector 는 `gw.invoke({ sessionId, method, path })` 로 프록시 (SQL 아님).
- connector 등록·관리(create/update/delete)는 콘솔 관리자 작업 — SDK gateway 표면에 없어요.

#### 절대 규칙 (Gateway)
- ✅ **PostgreSQL SQL 테이블명은 스키마 포함 필수** — `FROM schema.table`. `FROM table` 만 쓰면 `AxHubError(internal_error)` 발생.
- ✅ `queryConnector()` 우선 — connector 이름만 넘기면 grant resolve·session 생명주기를 helper 가 처리.
- ✅ **항상 parameterized SQL** — placeholder + `params: [...]`. 사용자 입력을 SQL 문자열에 직접 박지 마요.
- ✅ `connector` / `sql` 은 코드 상수 — 사용자 값은 `params` 로만 (권한 우회·injection 방지).
- ✅ 결과 cap 은 SQL `LIMIT` 로 — gateway 가 무한 결과를 막지 않아요.
- ✅ **정책 deny 는 throw** — `try/catch` 로 `PermissionDeniedError` / `UnauthenticatedError`(session 만료) / `NotFoundError`(grant 없음) 분기.
- ❌ `makeTenant()` (slug) 로 gateway 호출 — **400 invalid_format**. `makeGateway()` / `queryConnector()` 만.
- ❌ connector UUID 하드코딩 — connector 이름으로 넘기면 자동 resolve.
- ❌ session 을 안 닫고 방치 — 저수준 사용 시 `finally` 로 `sessions.end()`. (`queryConnector()` 는 자동.)
- ❌ 모듈-레벨에 gateway 결과·session 캐싱 — 자격·데이터가 사용자별로 달라요.

## Framework-Specific Rules (Next.js)

- `lib/db.ts` · `lib/axhub-server.ts` 는 **Server-side 전용**. `"use client"` 컴포넌트에서 import 금지.
- 새 백엔드/DB 호출은 항상 Server Component · Route Handler (`app/api/.../route.ts`) · Server Action 경유.
- Tailwind class 는 길어도 분리하지 말고 인라인 유지 (vibe coder 가 한 곳에서 다 보는 게 편함).
- 변경 보고: `file:line` 형식.

## 절대 규칙 (negative-phrased)

- DO NOT `lib/db.ts` · `lib/axhub-server.ts`(server 전용)를 `"use client"` 컴포넌트에서 import.
- DO NOT DB 쿼리에 사용자 입력을 문자열로 이어붙이기 — 항상 tagged-template `db()\`... ${value} ...\`` 로 바인딩.
- DO NOT raw `fetch()` 로 `api.axhub.ai` 직접 호출 — identity/gateway 는 `makeAxhub()` / `queryConnector()` 경유.
- DO NOT 모듈 레벨에 `AxHubClient` 인스턴스를 캐싱 (사용자 자격 누설).
- DO NOT slug/tenant 를 코드에 하드코딩 — `TENANT` / `APP_SLUG` 상수 또는 helper 사용.
- DO NOT `AxHubError.message` 한국어 문자열로 분기 — `code` / `category` / `instanceof` 만.
- DO NOT Gateway `query.run({ sql })` 에 사용자 입력을 그대로 박기 — 항상 `params: [...]` (parameterized SQL).
- DO NOT 사용자 세션 쿠키(`_hub_access`)/토큰을 응답 본문·로그에 노출.
- DO NOT `.env.local` 커밋 (`.gitignore` 막혀있지만 force-add 도 금지).
- DO NOT 사용자 동의 없이 destructive git (`reset --hard`, `push --force`, `branch -D`).
- DO NOT 새 npm 패키지 사용자 확인 없이 설치 (`@ax-hub/sdk` · `postgres` 는 이미 들어가 있어 재설치 금지).
- DO NOT 빌드/타입/린트 명령 사용자가 묻기 전에 실행.

## 신뢰 모델 (1-line)

- **데이터**: `lib/db.ts` 의 `db()` / `ensureSchema()` — `DATABASE_URL`(런타임, prepare:false) · `DIRECT_DATABASE_URL`(마이그레이션). 로컬은 docker compose, 배포는 axhub 주입.
- **인증/식별 · gateway**: `lib/axhub-server.ts` 의 `makeAxhub` / `makeTenant` / `makeGateway` / `queryConnector` + `APP_SLUG` / `TENANT` / `isAxhubConfigured()`. 들어온 요청의 `_hub_access` 쿠키를 `AxHubClient({ token, tokenType: 'jwt' })` 로 박아 SDK 가 `Authorization: Bearer` 자동 처리.

## 빠른 레퍼런스

```ts
// ── 데이터 (표준 PostgreSQL) — Server Component / Route Handler / Server Action 안에서 ──
import { db, ensureSchema } from '@/lib/db'
await ensureSchema()
await db()`INSERT INTO todos (user_key, title) VALUES (${userKey}, ${title})`
const rows = await db()<{ id: string; title: string; done: boolean }[]>`
  SELECT id::text, title, done FROM todos WHERE user_key = ${userKey} ORDER BY id DESC LIMIT 50`

// ── 로그인 사용자 (사용자별 데이터의 user_key) ──
import { makeAxhub } from '@/lib/axhub-server'
const sdk = await makeAxhub()
const me = await sdk.identity.me()    // me.email / me.name / me.tenants[]

// ── Gateway · 외부 DB/SaaS connector 조회 (connector 이름으로; helper 가 grant·session·UUID 처리) ──
import { queryConnector } from '@/lib/axhub-server'
const employees = await queryConnector<{ id: number; name: string }>({
  connector: 'my-db',     // connector 이름 (UUID 아님) — 활성 grant 가 있어야 보여요
  sql: 'SELECT id, name FROM public.employees WHERE active = $1 LIMIT $2',  // ⚠️ PostgreSQL: 스키마 포함 + 네이티브 $n placeholder('?' 는 500)
  params: [true, 10],
})
// 정책 deny 는 throw — try/catch 로 PermissionDeniedError 분기 (in-band allowed 플래그 없음)

// ── 에러 처리 ──
import { AxHubError } from '@ax-hub/sdk'
try {
  /* DB 또는 SDK 호출 */
} catch (err) {
  if (err instanceof AxHubError) console.error(err.code, err.category, err.requestId) // SDK(identity/gateway)
  else console.error(err)                                                             // 표준 postgres 에러
}
```

## 배포

`/axhub:deploy` (Claude Code) 또는 `axhub deploy create --app <slug> --branch main`. 사용자 명시 요청 후에만.
