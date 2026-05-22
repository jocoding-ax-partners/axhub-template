# AI Agents Guide

이 프로젝트의 **모든 AI 에이전트 행동 규칙** 이에요. Claude Code, Codex, 다른 어떤 AI 도구든 이 파일이 source-of-truth.
한국어 vibe coder 가 좋은 결과를 얻도록 설계됐어요.

## 사용자
비전공자 한국인 vibe coder. 한국어로 답해요. 코드 용어는 풀어서 설명해요. 결과는 화면으로 확인.

## Stack
Next.js 16 (App Router · RSC · Server Actions) · React 19 · TypeScript strict · Tailwind 3 · Node 20+ · **`@ax-hub/sdk`** (백엔드 호출은 항상 SDK 경유).

## 5가지 Vibe Coder 프로토콜 (모든 작업에 적용)

1. **Plan first** — 다단계 작업 시작 전, 한국어로 한 줄 plan 보여줘요.
   예: "1. `app/page.tsx` 수정 → 2. `makeApp().data.discover` 추가 → 3. 결과 카드 render". 사용자 OK 후 코드.
2. **Verify-then-claim** — UI 변경 후 "되긴 해요" / "should work" / "테스트 해보세요" 만으로 끝 금지.
   정확히 어디 클릭/접속해서 무엇이 보여야 하는지 알려줘요.
   예: "http://localhost:3000 새로고침 → '환영합니다, {이름}님' 카드 + 백엔드 호출 치트시트 보여야 해요. 안 보이면 알려주세요."
   사용자 확인 전엔 "완료" 표시 금지.
3. **No unprompted refactor** — X 요청에 Y / Z 같이 "개선" 금지. 변경한 모든 line 이 X 와 직접 관련.
   추가로 할 일은 한국어로 적어두고 사용자가 결정.
4. **Honest failure** — 못 만들면 plainly 말해요. "아직 안 풀렸어요. 시도: A, B. 모름: C." 가짜 진행/성공 보고 금지.
5. **Ask before install** — 작은 utility 라도 npm install 전에 "X 추가해도 될까요? 이유: Y" 한 번 물어봐요. (단, `@ax-hub/sdk` 는 이미 설치돼 있으니 다시 설치 금지.)

## SDK 사용 프로토콜 (axhub 백엔드 호출 규칙)

> 이 템플릿의 axhub 백엔드 호출은 **항상** `@ax-hub/sdk` 경유. raw `fetch()` 로 `axhub-api.*` 를 직접 때리면 안 돼요.
> 사용자 자격은 `lib/axhub-server.ts` 의 `makeAxhub()` factory 가 자동 처리해요.

### S1. 진입점은 factory 만 — 모듈 레벨 클라이언트 금지
- ✅ 매 호출마다 `const sdk = await makeAxhub()` 또는 `const app = await makeApp()`.
- ❌ 파일 최상단에 `const sdk = new AxHubClient({...})` 캐싱 — 사용자 자격이 다음 요청에 누설돼요.
- 이유: 들어온 요청의 `_hub_access` 쿠키마다 다른 사용자. SDK 인스턴스는 그 요청 안에서만 유효.

### S2. tenant/app 스코프는 helper 로 — 슬러그 하드코딩 금지
- ✅ `const app = await makeApp()` → `app.data.discover('todos')`.
- ✅ tenant 만 필요하면 `const t = await makeTenant()` → `t.apps.list()`.
- ❌ `sdk.tenant('my-tenant').app('my-app')` 처럼 슬러그 문자열 박지 마요 — `lib/axhub-server.ts` 의 `TENANT`/`APP_SLUG` 상수가 환경별로 다름.
- ❌ flat 호출 (`sdk.apps.create(...)` 같이 tenant 스코프 없이) 금지 — `TenantSlugRequiredError` 떨어져요. (단, `sdk.identity.*` 는 tenant 불필요 — 예외.)

### S3. 데이터 호출은 discover 또는 defineSchema — raw URL 금지
- ✅ 빠른 prototyping: `await app.data.discover<{ id: string; title: string }>('todos')`.
- ✅ 안정 코드: `defineSchema({ table: 'todos', columns: { id: 'uuid', title: 'string' } })` 후 `app.data.table(Todos)`.
- ❌ `sdk.http.request(...)` / `fetch('/data/...')` 직접 호출 — SDK 가 cursor / where / projection 다 알아서 해요.
- 검색 필터는 `where()` / `and()` / `or()` 헬퍼만 사용. raw SQL 금지 (`raw()` 는 사용자가 명시 요청할 때만).

### S4. 에러는 `error.code` / `instanceof` 로 분기 — 메시지 문자열 매칭 금지
- ✅ `if (err instanceof ConflictError) { ... }` 또는 `if (err instanceof AxHubError && err.code === 'slug_taken')`.
- ❌ `if (err.message.includes('이미 존재'))` — 백엔드 메시지는 한국어/번역 변경 가능, machine-readable 한 건 `code` / `category` 뿐.
- 자주 쓰는 클래스: `ValidationError`, `UnauthenticatedError`, `PermissionDeniedError`, `NotFoundError`, `ConflictError`, `RateLimitedError`, `AxHubError` (catch-all).

### S5. 서버 전용 — 클라이언트 컴포넌트에서 import 금지
- ✅ `app/page.tsx`, `app/api/.../route.ts`, Server Action 안에서만 `lib/axhub-server.ts` import.
- ❌ `"use client"` 컴포넌트에서 `makeAxhub` / `makeApp` import — `next/headers` 가 server-only 라 빌드 깨져요.
- 클라이언트에서 백엔드가 필요하면 Route Handler (`app/api/.../route.ts`) 거치게.

### S6. Gateway query — 외부 DB/SaaS 조회는 SDK gateway.query 만
> **이 기능은 핵심.** 외부 시스템(자체 PostgreSQL/MySQL/SaaS connector) 데이터를 axhub 가 만든 데이터처럼 안전하게 읽어요.
> 모든 호출은 audit log 에 기록되고 (`auditEventId` 반환), connector 권한 정책으로 게이트돼요. 직접 DB 접속 금지.

#### 기본 사용
```ts
import { makeTenant } from '@/lib/axhub-server'
// gateway 는 tenant 스코프 (앱 스코프 아님) — 반드시 makeTenant() 또는 sdk.tenant(slug).gateway.
const t = await makeTenant()
const res = await t.gateway.query.run<{ id: number; name: string }>({
  connectorId: 'a2763ffa-bd26-4d6d-933c-f5dc54722a27', // gateway.connectors.list() 로 확인
  path: 'employees',                                    // 연결된 connector 안의 리소스 경로/테이블명
  sql: 'SELECT id, name FROM employees WHERE active = $1 LIMIT $2',
  params: [true, 10],                                   // ✅ 항상 parameterized — SQL injection 방지
  rowLimit: 10,                                         // 옵션: 결과 cap (백엔드 정책과 함께 동작)
})
// res.rows: Row[]  · res.rowCount  · res.auditEventId (사후 추적용)
```

#### 어떤 connector 가 있나
```ts
const engines    = await t.gateway.engines.list()        // postgres / mysql / ... + capabilities
const connectors = await t.gateway.connectors.list({ limit: 50 })
const resources  = await t.gateway.resources.list({ limit: 50 })  // connector 안의 노출 리소스
```
- `connectors.create()` / `update()` / `delete()` 는 admin ring — 평일 운영은 reader 가 read-only 권장.
- `connectorId` 와 `resourceId` 둘 다 받아요. 보통은 `connectorId` + `path` 조합 사용.

#### 큰 결과 스트리밍 (SSE)
```ts
const stream = t.gateway.query.stream<{ id: number }>({
  connectorId: 'a2763ffa-...',
  path: 'big_table',
  sql: 'SELECT id FROM big_table',
})
for await (const ev of stream) {
  if (ev.type === 'item') console.log(ev.value.id)
}
// AbortSignal 로 도중 취소 가능 (opts.signal).
```

#### 절대 규칙 (Gateway)
- ✅ **항상 parameterized SQL** — `$1, $2 ...` + `params: [...]`. 사용자 입력을 SQL 문자열에 직접 박지 마요.
- ✅ `connectorId` / `path` 는 코드 상수 또는 admin 이 발급한 ID — 사용자 입력으로 바꾸지 마요 (권한 우회 위험).
- ✅ `rowLimit` 명시 — 무한 결과 방지.
- ✅ 에러 분기: `PoolStaleError` (401, 자격 만료 → 재시도/안내), `AxHubError.code === 'pool_stale'` 도 동일. 권한은 `PermissionDeniedError`.
- ❌ raw user input 을 그대로 `sql` 에 넣지 마요 — `params` 로 분리.
- ❌ 모듈-레벨에 `gateway.query` 결과 캐싱 금지 — 자격 + 데이터가 사용자별로 달라요.
- ❌ `auditEventId` 무시 — 감사 가능 액션은 응답에 같이 보여주세요 ("이 조회 기록 ID: xxx").

### S7. Query DSL — `where()` / `and()` / `or()` / `raw()` 만 사용
> 데이터 API (`app.data.discover` / `app.data.table(Schema)`) 의 `list` / `count` 의 `where` 인자는 **DSL 객체** 만 받아요.
> SQL 문자열 직접 박지 말고 헬퍼 함수 조합.

#### 비교 연산자
```ts
import { where, and, or, not, defineSchema } from '@ax-hub/sdk'

where('status').eq('paid')         // status = 'paid'
where('status').ne('archived')     // status != 'archived'
where('total').gt(100)             // total > 100
where('total').gte(100)            // total >= 100
where('total').lt(1000)
where('total').lte(1000)
where('status').in(['paid', 'pending'])   // status IN (...)
```

#### LIKE 검색 — `%` / `_` / `\` 자동 escape (SQL injection / ReDoS 방어)
```ts
where('title').like.contains('주문')      // title LIKE '%주문%'  ('%' / '_' escape)
where('title').like.startsWith('axhub')   // title LIKE 'axhub%'
where('title').like.endsWith('.png')      // title LIKE '%.png'
where('title').like.raw('axhub\\_%')      // 사용자가 직접 패턴 작성 — assertSafeLikePattern 가 ReDoS 차단
```
- raw 패턴은 길이 1024 / `%` 연속 4회 / `%X%` 6 세그먼트 넘으면 `ValidationError(code: 'like_pattern_redos')` 던져요.

#### 조합 — and / or / not
```ts
const filter = and(
  where('status').eq('paid'),
  or(where('total').gt(100), where('priority').eq('high')),
  not(where('archived').eq(true)),
)
await app.data.table(Orders).list({ where: filter, limit: 50 })
```

#### 타입 강제 — defineSchema + `Orders.cols.<field>`
```ts
const Orders = defineSchema({
  table: 'orders',
  columns: {
    id: 'uuid',
    status: { type: 'enum', values: ['paid', 'pending', 'cancelled'] as const },
    total: 'number',
  },
})
// ✅ 컴파일 타임에 컬럼/타입 강제 — 오타시 TS 에러
where(Orders.cols.status).eq('paid')     // 'archived' 넣으면 TS error
where(Orders.cols.total).gt(100)         // string 넣으면 TS error
```

#### Projection — 필요한 컬럼만
```ts
const minimal = await app.data.table(Orders).list({
  where: where(Orders.cols.status).eq('paid'),
  select: ['id', 'total'] as const,        // 백엔드 _select=id,total → Pick<Row, 'id'|'total'>
  orderBy: [{ field: 'id', dir: 'asc' }],
  limit: 100,
})
// minimal.items[0].total 은 number, .status 는 타입에서 사라짐
```

#### Pagination — cursor `after` / `before`
```ts
const first = await app.data.table(Orders).list({ limit: 50, orderBy: [{ field: 'id', dir: 'asc' }] })
const next  = await app.data.table(Orders).list({ after: first.nextCursor!, orderBy: [{ field: 'id', dir: 'asc' }] })
const prev  = await app.data.table(Orders).list({ before: next.firstCursor!, orderBy: [{ field: 'id', dir: 'asc' }] })
```
- cursor 는 v2 토큰 (`v2:...`). 다른 테이블 cursor 재사용시 `InvalidCursorError(code: 'cursor_context_mismatch')`.

#### 절대 규칙 (DSL)
- ✅ 모든 필터는 `where()` / `and()` / `or()` / `not()` 헬퍼 조합.
- ✅ 검색어는 사용자 입력 그대로 `like.contains(userInput)` 에 넘겨도 안전 (escape 자동).
- ❌ `raw('SELECT ...')` 는 사용자가 명시 요청할 때만 — 보통은 쓸 일 없어요 (data API 는 `where` 가 SQL 을 대신함).
- ❌ `where` 인자로 문자열 SQL 직접 박는 거 금지 (`where: 'status = paid'` 같은 거 ❌).
- ❌ orderBy 무시한 cursor 사용 — `orderBy` 의 fingerprint 가 cursor 와 안 맞으면 `InvalidCursorError`.

## Framework-Specific Rules (Next.js)

- `lib/axhub-server.ts` 는 **Server-side 전용** (`next/headers` 사용). `"use client"` 컴포넌트에서 import 금지.
- 새 axhub API 호출은 항상 Route Handler (`app/api/.../route.ts`) 또는 Server Action 경유.
- Tailwind class 는 길어도 분리하지 말고 인라인 유지 (vibe coder 가 한 곳에서 다 보는 게 편함).
- 변경 보고: `file:line` 형식.

## 절대 규칙 (negative-phrased)

- DO NOT `lib/axhub-server.ts`(server 전용, `next/headers`)를 `"use client"` 컴포넌트에서 import.
- DO NOT raw `fetch()` 로 `axhub-api.*` 또는 `APPHUB_API_URL` 을 직접 호출 — 항상 `makeAxhub()` / `makeApp()` 경유.
- DO NOT 모듈 레벨에 `AxHubClient` 인스턴스를 캐싱 (사용자 자격 누설).
- DO NOT slug/tenant 를 코드에 하드코딩 — `lib/axhub-server.ts` 의 `TENANT` / `APP_SLUG` 상수 또는 helper 사용.
- DO NOT `AxHubError.message` 한국어 문자열로 분기 — `code` / `category` / `instanceof` 만.
- DO NOT Gateway `query.run({ sql })` 에 사용자 입력을 그대로 박기 — 항상 `params: [...]` 로 분리 (parameterized SQL).
- DO NOT `connectorId` / `path` 를 사용자 입력으로 동적 결정 — admin 이 발급한 ID, 코드 상수만.
- DO NOT data API 의 `where` 에 SQL 문자열 직접 박기 — `where()` / `and()` / `or()` 헬퍼만.
- DO NOT 사용자 세션 쿠키(`_hub_access`)/토큰을 응답 본문·로그에 노출.
- DO NOT `.env.local` 커밋 (`.gitignore` 막혀있지만 force-add 도 금지).
- DO NOT 사용자 동의 없이 destructive git (`reset --hard`, `push --force`, `branch -D`).
- DO NOT 새 npm 패키지 사용자 확인 없이 설치 (`@ax-hub/sdk` 는 이미 들어가 있어 재설치 금지).
- DO NOT 빌드/타입/린트 명령 사용자가 묻기 전에 실행.

## axhub-server.ts 신뢰 모델 (1-line)

이 (Next.js) 템플릿은 **server-side**. SDK helper = `makeAxhub` / `makeApp` / `makeTenant` + `APP_SLUG` / `TENANT` / `isAxhubConfigured()`.
인증: 들어온 요청의 세션 쿠키(`next/headers` 의 `cookies()` 로 읽은 `_hub_access`)를 `AxHubClient({ token, tokenType: 'jwt' })` 로 박아 SDK 가 `Authorization: Bearer` 자동 처리. 정적 API key 안 씀. 풀 비교 표는 [axhub-template README](../README.md#axhubts-신뢰-모델-3종-공통) 참고.

## SDK 빠른 레퍼런스

```ts
// Server Component / Route Handler / Server Action 안에서
import { makeAxhub, makeApp, makeTenant } from '@/lib/axhub-server'
import {
  AxHubError, ConflictError, NotFoundError, ValidationError, PermissionDeniedError,
  defineSchema, where, and, or, not,
} from '@ax-hub/sdk'

// 1) 내 정보 — tenant 불필요
const sdk = await makeAxhub()
const me = await sdk.identity.me() // me.email / me.name / me.tenants[]

// 2) 앱 데이터 — discover 패턴 (스키마 자동 추론)
const app = await makeApp()
const todos = await app.data.discover<{ id: string; title: string; done: boolean }>('todos')
const page = await todos.list({ where: where('done').eq(false), limit: 20 })
await todos.insert({ title: '할 일', done: false })

// 3) 앱 데이터 — defineSchema 패턴 (안정/타입 강제)
const Todos = defineSchema({
  table: 'todos',
  columns: { id: 'uuid', title: 'string', done: 'bool' },
})
const todosTyped = app.data.table(Todos)
await todosTyped.list({ where: where(Todos.cols.done).eq(false) })

// 4) 에러 처리
try {
  await todos.insert({ id: 'dup' })
} catch (err) {
  if (err instanceof ConflictError) {/* 중복 키 — UI 에서 다른 값 안내 */}
  else if (err instanceof ValidationError) {/* err.fields[] 보고 폼 표시 */}
  else if (err instanceof AxHubError) console.error(err.code, err.category, err.requestId)
  else throw err
}

// 5) Gateway query — 외부 DB / SaaS connector 조회 (tenant 스코프)
import { makeTenant } from '@/lib/axhub-server'
const t = await makeTenant()
const employees = await t.gateway.query.run<{ id: number; name: string }>({
  connectorId: 'a2763ffa-bd26-4d6d-933c-f5dc54722a27',
  path: 'employees',
  sql: 'SELECT id, name FROM employees WHERE active = $1 LIMIT $2',
  params: [true, 10],     // ✅ 항상 parameterized
  rowLimit: 10,
})
// employees.rows / employees.rowCount / employees.auditEventId

// 6) Query DSL — 데이터 API filter
const filter = and(
  where('status').eq('paid'),
  or(where('total').gt(100), where('priority').eq('high')),
  not(where('archived').eq(true)),
)
const page = await app.data.discover<{ status: string; total: number }>('orders')
  .then(o => o.list({ where: filter, select: ['status', 'total'] as const, limit: 50 }))
```

## 배포

`/axhub:deploy` (Claude Code) 또는 `axhub deploy create --app <slug> --branch main`. 사용자 명시 요청 후에만.
