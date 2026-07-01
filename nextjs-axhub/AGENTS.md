# AI Agents Guide

이 프로젝트의 **모든 AI 에이전트 행동 규칙** 이에요. Claude Code, Codex, 다른 어떤 AI 도구든 이 파일이 source-of-truth.
한국어 vibe coder 가 좋은 결과를 얻도록 설계됐어요.

## 사용자
비전공자 한국인 vibe coder. 한국어로 답해요. 코드 용어는 풀어서 설명해요. 결과는 화면으로 확인.

## Stack
Next.js 16 (App Router · RSC · Server Actions) · React 19 · TypeScript strict · Tailwind 3 · Node 20+ · **`@ax-hub/sdk 3.x`** (Hub API · gateway 호출) · **`pg`** (앱 자체 데이터 raw-db — 앱 전용 Postgres).

## 5가지 Vibe Coder 프로토콜 (모든 작업에 적용)

1. **Plan first** — 다단계 작업 시작 전, 한국어로 한 줄 plan 보여줘요.
   예: "1. `app/page.tsx` 수정 → 2. `ownedTable('todos', ownerId)` 조회 추가 → 3. 결과 카드 render". 사용자 OK 후 코드.
2. **Verify-then-claim** — UI 변경 후 "되긴 해요" / "should work" / "테스트 해보세요" 만으로 끝 금지.
   정확히 어디 클릭/접속해서 무엇이 보여야 하는지 알려줘요.
   예: "http://localhost:3000 새로고침 → '환영합니다, {이름}님' 카드 + 백엔드 호출 치트시트 보여야 해요. 안 보이면 알려주세요."
   사용자 확인 전엔 "완료" 표시 금지.
3. **No unprompted refactor** — X 요청에 Y / Z 같이 "개선" 금지. 변경한 모든 line 이 X 와 직접 관련.
   추가로 할 일은 한국어로 적어두고 사용자가 결정.
4. **Honest failure** — 못 만들면 plainly 말해요. "아직 안 풀렸어요. 시도: A, B. 모름: C." 가짜 진행/성공 보고 금지.
5. **Ask before install** — 작은 utility 라도 npm install 전에 "X 추가해도 될까요? 이유: Y" 한 번 물어봐요. (단, `@ax-hub/sdk 3.x` 는 이미 설치돼 있으니 다시 설치 금지.)

## axhub 리소스 준비 — 데이터/시크릿 코드를 짜기 *전에* (에이전트 필수)

> 사용자는 "대화 저장되게 / 주문 목록 보여줘 / OpenAI 로 답변 생성" 처럼 **결과만** 말해요.
> 앱 자체 데이터는 **raw-db** (앱 전용 Postgres · `DATABASE_URL`) 로 다뤄요 — 동적테이블 `app.data.*` API 는
> `@ax-hub/sdk 5.0.0` 에서 제거됐어요. 에이전트가 코드보다 먼저 아래(테이블·환경변수)를 처리해야 배포 후에도 동작해요.

### R1. 저장/조회/기록 요청 → 테이블을 SQL 마이그레이션으로 먼저 (코드보다 먼저)
데이터를 담을 테이블이 앱 DB 에 **먼저 있어야** 해요. 없으면 쿼리가 깨져요. 테이블 생성(DDL)은 이제 **앱의 몫** 이에요
(`axhub tables create` 아님) — `db/migrations/*.sql` 에 SQL 로 정의하고 `psql "$DATABASE_URL" -f ...` 로 적용해요.
1. 사전: `axhub` 에서 이 앱의 raw DB 를 켜면(enable) 다음 배포 때 `DATABASE_URL` 이 주입돼요 (자세히 → `db/README.md`).
2. **사용자마다 자기 데이터만 보는 경우(대부분) → `owner_id uuid not null` 컬럼 + 인덱스** (예시: `db/migrations/001_init.sql`):
   ```sql
   create table if not exists chat_messages (
     id          uuid primary key default gen_random_uuid(),
     owner_id    uuid not null,           -- 로그인 사용자 id — 격리의 핵심
     role        text not null,
     content     text not null,
     created_at  timestamptz not null default now()
   );
   create index if not exists chat_messages_owner_id_idx on chat_messages (owner_id, created_at desc);
   ```

### R2. ⚠️ owner_id 격리는 이제 **앱의 몫** — 항상 직접 필터/세팅 (보안 필수)
> raw-db 는 예전 동적테이블과 달리 **owner_id 자동 격리가 없어요.** 앱이 안 걸면 모든 사용자의 데이터가 서로 유출돼요.
- 사용자-스코프 read/write 는 **항상 `lib/data.ts` 의 `ownedTable(name, ownerId)` 로.** `list/get/insert/update/delete`
  모든 메서드가 `owner_id` 를 자동 필터/세팅해서 남의 행에 못 닿아요. `ownerId` 는 `currentUserId()` 로 얻어요.
- insert: `owner_id` 를 values 에 **직접 넣지 마세요** — `ownedTable` 이 자동 세팅해요 (덮어쓰려 하면 에러).
- 커스텀 SQL(`query()`, JOIN/집계 등)을 직접 쓸 땐 **`WHERE owner_id = $1` 을 반드시 직접** 넣어요 (호출자 책임).
- 모두가 공유하는 공용 데이터만 owner_id 없이 다뤄요 — 사용자별 데이터인데 owner_id 를 빠뜨리면 **유출**이에요.

### R3. 데이터 호출은 로그인 세션 + 요청 스코프 안에서만
- `currentUserId()` 는 **로그인한 사용자의 세션 쿠키**로 identity 를 읽어요 (`me.userId`). 비로그인 호출은 401.
- 호출 위치는 **Route Handler · Server Action · 요청 중 렌더** 안에서만 (S5 참조). 빌드 타임이나 모듈 최상단에서 부르면 토큰이 없어 깨져요.
- 앱 데이터 접근은 항상 `lib/data.ts` 의 `ownedTable()` / `query()` 로 (직접 pg Pool 을 새로 만들지 마세요 — data.ts 가 싱글톤 관리).

### R4. 코드가 secret(API 키 등)을 쓰면 → axhub env 에 등록 (배포 필수)
`.env.local` 만 채우면 **로컬만** 돌아가요. 배포 환경엔 그 값이 없어 배포 preflight 가 막히거나 런타임에 `env: <KEY> not found` 로 깨져요.
1. `axhub.yaml` 의 `env` 에 **이름과 scope 만** 선언 (값은 적지 않음). `scope` 는 `build` / `runtime` / `both` — 런타임에 쓰는 API 키는 `runtime`:
   ```yaml
   env:
     required:
       - { name: OPENAI_API_KEY, scope: runtime }
   ```
2. 값은 CLI 로 등록 (콘솔도 되지만 CLI 권장 · 값은 stdin 으로만 — 명령행 노출 방지). `--stage` 는 위 `scope` 와 같은 값(`build`/`runtime`/`both`, 생략 시 양쪽):
   ```bash
   printf %s "$OPENAI_API_KEY" | axhub env set OPENAI_API_KEY --app <APP_SLUG> --secret --from-stdin --stage runtime --json
   ```
- `APPHUB_API_URL` / `APPHUB_APP_SLUG` / `APPHUB_TENANT` 는 axhub 가 **자동 주입**해요 — 직접 등록 불필요. 소스에 `{{...}}` 가 그대로 보이거나 `isAxhubConfigured()` 가 false 면 아직 미배포/미설정 상태이니, 코드를 깨지 말고 그 사실을 사용자에게 알려요.

## SDK 사용 프로토콜 (axhub 백엔드 호출 규칙)

> 이 템플릿의 axhub 백엔드 호출은 **항상** `@ax-hub/sdk 3.x` 경유. raw `fetch()` 로 `api.axhub.ai` 를 직접 때리면 안 돼요.
> 사용자 자격은 `lib/axhub-server.ts` 의 `makeAxhub()` factory 가 자동 처리해요.

### S1. 진입점은 factory 만 — 모듈 레벨 클라이언트 금지
- ✅ 매 호출마다 `const sdk = await makeAxhub()` 또는 `const app = await makeApp()`.
- ❌ 파일 최상단에 `const sdk = new AxHubClient({...})` 캐싱 — 사용자 자격이 다음 요청에 누설돼요.
- 이유: 들어온 요청의 `_hub_access` 쿠키마다 다른 사용자. SDK 인스턴스는 그 요청 안에서만 유효.

### S2. tenant/app 스코프는 helper 로 — 슬러그 하드코딩 금지
- ✅ app 스코프 관리 호출은 `const app = await makeApp()` (apps.* 등). 앱 자체 데이터는 `lib/data.ts` 의 `ownedTable()`/`query()` (raw-db).
- ✅ tenant 만 필요하면 `const t = await makeTenant()` → `t.apps.list()`.
- ❌ `sdk.tenant('my-tenant').app('my-app')` 처럼 슬러그 문자열 박지 마요 — `lib/axhub-server.ts` 의 `TENANT`/`APP_SLUG` 상수가 환경별로 다름.
- ❌ flat 호출 (`sdk.apps.create(...)` 같이 tenant 스코프 없이) 금지 — `TenantSlugRequiredError` 떨어져요. (단, `sdk.identity.*` 는 tenant 불필요 — 예외.)

### S3. 앱 자체 데이터는 raw-db — `lib/data.ts` 헬퍼로 (직접 pg / raw URL 금지)
- ✅ 진입점은 `lib/data.ts` 의 `ownedTable<Row>('todos', ownerId)` — 사용자-스코프 CRUD 는 전부 여기로 (owner_id 자동 격리, 위 R2).
- ✅ `ownerId` 는 `currentUserId()` (identity `me.userId`) 로. 테이블은 SQL 마이그레이션으로 먼저 (위 R1).
- ✅ 커스텀 쿼리(JOIN/집계)는 `query<Row>(sql, params)` — 항상 parameterized `$n`, owner_id 필터 직접 (호출자 책임, R2).
- ❌ 모듈에서 `new Pool(...)` 를 직접 만들지 마요 — `lib/data.ts` 가 hot-reload 안전 싱글톤을 관리해요.
- ❌ `fetch('/data/...')` 나 사용자 입력을 SQL 문자열에 이어붙이기 금지 — 값은 반드시 `params` 로 (injection 방지).

### S4. 에러는 `error.code` / `instanceof` 로 분기 — 메시지 문자열 매칭 금지
- ✅ `if (err instanceof ConflictError) { ... }` 또는 `if (err instanceof AxHubError && err.code === 'slug_taken')`.
- ❌ `if (err.message.includes('이미 존재'))` — 백엔드 메시지는 한국어/번역 변경 가능, machine-readable 한 건 `code` / `category` 뿐.
- 자주 쓰는 클래스: `ValidationError`, `UnauthenticatedError`, `PermissionDeniedError`, `NotFoundError`, `ConflictError`, `RateLimitedError`, `AxHubError` (catch-all).

### S5. 서버 전용 — 클라이언트 컴포넌트에서 import 금지
- ✅ `app/page.tsx`, `app/api/.../route.ts`, Server Action 안에서만 `lib/axhub-server.ts` import.
- ❌ `"use client"` 컴포넌트에서 `makeAxhub` / `makeApp` import — `next/headers` 가 server-only 라 빌드 깨져요.
- 클라이언트에서 백엔드가 필요하면 Route Handler (`app/api/.../route.ts`) 거치게.

### S6. Gateway query — 외부 DB/SaaS 조회는 `queryConnector()` 로
> **이 기능은 핵심.** 외부 시스템(자체 PostgreSQL/MySQL/SaaS connector) 데이터를 axhub 가 만든 데이터처럼 안전하게 읽어요.
> 모든 호출은 audit log 에 기록되고, connector 권한 정책으로 게이트돼요. 직접 DB 접속 금지.

> ⚠️ **gateway 는 tenant 경로에 UUID 를 요구해요 (slug 거부 → 400 invalid_format).** slug 기반 `makeTenant()` 로는 gateway 가 안 돼요.
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
- ✅ **정책 deny 는 throw** — `try/catch` 로 `PermissionDeniedError` (정책 거부) / `UnauthenticatedError` (session 만료) / `NotFoundError` (grant 없음) 분기. in-band `res.allowed` 플래그는 더 이상 없어요.
- ❌ `makeTenant()` (slug) 로 gateway 호출 — tenant UUID 가 아니라 **400 invalid_format**. `makeGateway()` / `queryConnector()` 만.
- ❌ connector UUID 하드코딩 — connector 이름으로 넘기면 자동 resolve.
- ❌ session 을 안 닫고 방치 — 저수준 사용 시 `finally` 로 `sessions.end()`. (`queryConnector()` 는 자동.)
- ❌ 모듈-레벨에 gateway 결과·session 캐싱 — 자격·데이터가 사용자별로 달라요.

### S7. 앱 자체 데이터 — raw-db (`lib/data.ts`: `ownedTable` / `query` / `currentUserId`)
> 앱 자체 데이터는 앱 전용 Postgres 에 SQL 로 직접 붙어요 (`DATABASE_URL`). 동적테이블 DSL(`where()`/`and()`/`defineSchema`)은
> `@ax-hub/sdk 5.0.0` 에서 제거됐어요. 값은 항상 parameterized `$n`, 식별자는 검증 — `lib/data.ts` 가 이걸 다 감싸요.

#### 기본 — `ownedTable(name, ownerId)` (owner_id 자동 격리)
```ts
import { currentUserId, ownedTable } from '@/lib/data'

const ownerId = await currentUserId()          // 로그인 사용자 id (me.userId)
const todos = ownedTable<{ id: string; title: string; done: boolean }>('todos', ownerId)

const { rows } = await todos.list({ orderBy: 'created_at desc', limit: 50 })  // 내 행만 (owner_id 자동)
const one = await todos.get(id)                 // id + owner_id 매칭될 때만, 아니면 null
await todos.insert({ title: '장보기', done: false })  // owner_id 자동 세팅 — values 에 넣지 마세요
await todos.update(id, { done: true })          // 내 행일 때만
await todos.delete(id)                          // 내 행일 때만 (반환: 삭제된 행 수)
```
- 모든 메서드가 `owner_id` 를 자동 필터/세팅해요 → 남의 행에 절대 못 닿아요. 이게 예전 backend 자동 격리를 대신해요.
- `orderBy` 는 `'컬럼 dir'` 문자열 (컬럼은 식별자 검증, dir 은 asc/desc). 테이블/컬럼명은 `^[a-z_][a-z0-9_]*$` 로 검증돼요.

#### 커스텀 쿼리 — `query(sql, params)` (JOIN / 집계 등)
```ts
import { currentUserId, query } from '@/lib/data'

const ownerId = await currentUserId()
const { rows, rowCount } = await query<{ done: boolean; n: number }>(
  'SELECT done, count(*)::int AS n FROM todos WHERE owner_id = $1 GROUP BY done',
  [ownerId],   // ✅ 항상 parameterized $n — 사용자 입력을 SQL 문자열에 이어붙이지 마세요
)
```
- ⚠️ `query()` 는 owner_id 를 **자동으로 안 걸어요.** 사용자-스코프 쿼리면 `WHERE owner_id = $1` 을 직접 넣는 게 호출자 책임이에요 (R2).

#### 절대 규칙 (raw-db)
- ✅ 사용자-스코프 CRUD 는 **항상 `ownedTable()`** — owner_id 격리가 기본으로 박혀 있어요 (R2, 보안 필수).
- ✅ 값은 **항상 `params` 로 ($n)** — 사용자 입력을 SQL 문자열에 이어붙이기 절대 금지 (injection).
- ✅ 커스텀 `query()` 로 사용자 데이터 조회 시 `WHERE owner_id = $1` 직접 (안 걸면 사용자 간 유출).
- ✅ 테이블은 `db/migrations/*.sql` 로 먼저 만들기 (DDL 은 앱의 몫, R1).
- ❌ 모듈에서 `new Pool(...)` 직접 생성 — `lib/data.ts` 가 hot-reload 안전 싱글톤을 관리해요.
- ❌ 식별자(테이블/컬럼명)를 사용자 입력으로 동적 결정 — 코드 상수만 (식별자는 parameterize 불가).

## Framework-Specific Rules (Next.js)

- `lib/axhub-server.ts` 는 **Server-side 전용** (`next/headers` 사용). `"use client"` 컴포넌트에서 import 금지.
- 새 axhub API 호출은 항상 Route Handler (`app/api/.../route.ts`) 또는 Server Action 경유.
- Tailwind class 는 길어도 분리하지 말고 인라인 유지 (vibe coder 가 한 곳에서 다 보는 게 편함).
- 변경 보고: `file:line` 형식.

## 절대 규칙 (negative-phrased)

- DO NOT `lib/axhub-server.ts`(server 전용, `next/headers`)를 `"use client"` 컴포넌트에서 import.
- DO NOT raw `fetch()` 로 `api.axhub.ai` 또는 `APPHUB_API_URL` 을 직접 호출 — 항상 `makeAxhub()` / `makeApp()` 경유.
- DO NOT 모듈 레벨에 `AxHubClient` 인스턴스를 캐싱 (사용자 자격 누설).
- DO NOT slug/tenant 를 코드에 하드코딩 — `lib/axhub-server.ts` 의 `TENANT` / `APP_SLUG` 상수 또는 helper 사용.
- DO NOT `AxHubError.message` 한국어 문자열로 분기 — `code` / `category` / `instanceof` 만.
- DO NOT Gateway `query.run({ sql })` 에 사용자 입력을 그대로 박기 — 항상 `params: [...]` 로 분리 (parameterized SQL).
- DO NOT `connectorId` / `path` 를 사용자 입력으로 동적 결정 — admin 이 발급한 ID, 코드 상수만.
- DO NOT raw-db `query()` / `ownedTable()` 에 사용자 입력을 SQL 문자열로 이어붙이기 — 값은 항상 `params` ($n), 식별자는 코드 상수만.
- DO NOT 사용자-스코프 데이터에서 owner_id 필터를 빠뜨리기 — `ownedTable()` 을 쓰거나 `query()` 면 `WHERE owner_id = $1` 직접 (유출 방지, R2).
- DO NOT 사용자 세션 쿠키(`_hub_access`)/토큰을 응답 본문·로그에 노출.
- DO NOT `.env.local` 커밋 (`.gitignore` 막혀있지만 force-add 도 금지).
- DO NOT 사용자 동의 없이 destructive git (`reset --hard`, `push --force`, `branch -D`).
- DO NOT 새 npm 패키지 사용자 확인 없이 설치 (`@ax-hub/sdk 3.x` 는 이미 들어가 있어 재설치 금지).
- DO NOT 빌드/타입/린트 명령 사용자가 묻기 전에 실행.

## axhub-server.ts 신뢰 모델 (1-line)

이 (Next.js) 템플릿은 **server-side**. SDK helper = `makeAxhub` / `makeApp` / `makeTenant` + `APP_SLUG` / `TENANT` / `isAxhubConfigured()`.
인증: 들어온 요청의 세션 쿠키(`next/headers` 의 `cookies()` 로 읽은 `_hub_access`)를 `AxHubClient({ token, tokenType: 'jwt' })` 로 박아 SDK 가 `Authorization: Bearer` 자동 처리. 정적 API key 안 씀. 풀 비교 표는 [axhub-template README](../README.md#axhubts-신뢰-모델-3종-공통) 참고.

## SDK 빠른 레퍼런스

```ts
// Server Component / Route Handler / Server Action 안에서
import { makeAxhub, makeTenant, queryConnector } from '@/lib/axhub-server'
import { currentUserId, ownedTable, query } from '@/lib/data'
import { AxHubError, PermissionDeniedError } from '@ax-hub/sdk'

// 1) 내 정보 — tenant 불필요
const sdk = await makeAxhub()
const me = await sdk.identity.me() // me.userId / me.email / me.name / me.tenants[]

// 2) 앱 데이터 (raw-db) — ownedTable 로 owner_id 자동 격리 (사용자-스코프 CRUD 기본)
const ownerId = await currentUserId()  // me.userId
const todos = ownedTable<{ id: string; title: string; done: boolean }>('todos', ownerId)
const { rows } = await todos.list({ orderBy: 'created_at desc', limit: 20 })  // 내 행만
await todos.insert({ title: '할 일', done: false })  // owner_id 자동 — 넣지 마세요
await todos.update(id, { done: true })                // 내 행일 때만
await todos.delete(id)                                 // 내 행일 때만

// 3) 앱 데이터 (raw-db) — 커스텀 쿼리는 query(sql, params). owner_id 필터 직접 (호출자 책임)
const stats = await query<{ done: boolean; n: number }>(
  'SELECT done, count(*)::int AS n FROM todos WHERE owner_id = $1 GROUP BY done',
  [ownerId],  // ✅ 항상 parameterized $n
)

// 4) 에러 처리 — raw-db 는 pg 에러 코드(e.code) / Hub API 는 AxHubError
try {
  await query('INSERT INTO todos (owner_id, id) VALUES ($1, $2)', [ownerId, 'dup'])
} catch (e) {
  if ((e as { code?: string }).code === '23505') {/* unique_violation — 중복 키 */}
  else if (e instanceof AxHubError) console.error(e.code, e.category, e.requestId)
  else throw e
}

// 5) Gateway query — 외부 DB / SaaS connector 조회 (connector 이름으로; helper 가 grant·session·UUID 처리)
const employees = await queryConnector<{ id: number; name: string }>({
  connector: 'my-db',     // connector 이름 (UUID 아님) — 활성 grant 가 있어야 보여요
  sql: 'SELECT id, name FROM public.employees WHERE active = $1 LIMIT $2',  // ⚠️ PostgreSQL: 스키마 포함 + 네이티브 $n placeholder('?' 는 500)
  params: [true, 10],     // ✅ 항상 parameterized · $1,$2 순서대로
})
// employees.rows (컬럼 매핑된 객체) / employees.rowCount / employees.columns
// 정책 deny 는 throw — try/catch 로 PermissionDeniedError 분기 (in-band allowed 플래그 없음)
```

## 배포

`/axhub:deploy` (Claude Code) 또는 `axhub deploy create --app <slug> --branch main`. 사용자 명시 요청 후에만.
