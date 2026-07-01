# db — 앱 자체 DB (raw-db) 마이그레이션

이 앱은 **자기 Postgres** 에 SQL 로 직접 붙어요 (raw-db). 예전 동적테이블 `app.data.*` API 는
`@ax-hub/sdk 5.0.0` 에서 제거됐고, 이제 **테이블(DDL)은 앱의 몫** 이에요 — 아래 `.sql` 파일로 관리해요.

## 1. 한 번만: 앱의 raw DB 켜기 (setup)

`axhub` 에서 이 앱의 raw DB 를 켜면(enable) 앱 전용 Postgres role 이 만들어지고, **다음 배포 때**
`DATABASE_URL` 이 앱에 자동 주입돼요.

- **Claude Code / axhub 플러그인**: raw DB enable 스킬로 미리보기+동의까지 처리돼요.
- **관리자 API (admin-ring)**: `sdk.apps.rawDb.enable(appId)` — 이건 **관리 제어 호출**이지 앱 런타임 코드가 아니에요.
  (앱 런타임은 주입된 `DATABASE_URL` 로 붙기만 해요. 앱이 자기 DB 를 스스로 enable 하지 않아요.)
- 켠 뒤 **재배포** 해야 `DATABASE_URL` 이 들어와요.

로컬 개발용으로는 `.env.local` 에 `DATABASE_URL` 을 직접 채워요 (`.env.example` 참고).

## 2. 마이그레이션 적용 (psql)

`migrations/*.sql` 를 순서대로 앱의 `DATABASE_URL` 에 적용해요:

```bash
# DATABASE_URL 은 배포 환경엔 주입돼 있고, 로컬은 .env.local 값을 써요.
psql "$DATABASE_URL" -f db/migrations/001_init.sql
```

- 파일은 번호 순(`001_`, `002_`, …)으로. 이 템플릿은 별도 마이그레이션 러너 없이 **psql 직접 적용**이 기본이에요.
- 모든 문은 `if not exists` 로 idempotent 하게 써서 다시 돌려도 안전하게.

## 3. 런타임 — owner_id 격리 (보안 필수)

raw-db 는 사용자 행을 **자동 격리하지 않아요** (예전 동적테이블과 다른 점). 사용자별 데이터는:

- 테이블에 `owner_id uuid not null` 컬럼을 두고 (예시: `migrations/001_init.sql`),
- 런타임에 `lib/data.ts` 의 **`ownedTable(name, ownerId)`** 로 read/write 하세요 —
  `list/get/insert/update/delete` 모든 메서드에 `owner_id` 필터/세팅이 박혀 있어 남의 행에 못 닿아요.

```ts
import { currentUserId, ownedTable } from "@/lib/data";

const ownerId = await currentUserId();                 // 로그인 사용자 id (me.userId)
const todos = ownedTable<{ id: string; title: string; done: boolean }>("todos", ownerId);
await todos.insert({ title: "장보기", done: false });   // owner_id 자동
const { rows } = await todos.list({ orderBy: "created_at desc", limit: 50 }); // 내 행만
```

커스텀 SQL(JOIN/집계 등)이 필요하면 `query()` 를 쓰되 **`WHERE owner_id = $1` 을 직접 넣는 건 호출자 책임**이에요.
