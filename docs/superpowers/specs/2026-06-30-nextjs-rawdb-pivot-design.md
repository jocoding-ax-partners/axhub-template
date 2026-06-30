# nextjs-axhub: 동적 DB(/data SDK) 제거 → 표준 Postgres(rawDB) 전환

날짜: 2026-06-30
대상 템플릿: `nextjs-axhub` (astro/vite 는 후속, 본 설계 범위 밖)

## 목표

`nextjs-axhub` 템플릿에서 **동적 DB(axhub `/data` API = `@ax-hub/sdk` 의 `app.data.*`)** 흔적을
통째로 제거하고, 데이터 저장을 **표준 PostgreSQL(`DATABASE_URL`)** 로 바꾼다. Claude Code(LLM)
가 이 템플릿 안에서 보기엔 평범한 Next.js + Postgres 풀스택 앱이어야 하며, 동적 DB SDK·API 의
흔적(코드·주석·가이드)이 **하나도 없어야** 한다.

- 로컬 개발: 로컬 Postgres 를 자연스럽게 띄워 `DATABASE_URL` 로 개발.
- 배포(axhub): `axhub.yaml` 의 `database: { engine: postgres }` 선언으로 전용 raw DB 가
  발급되고 `DATABASE_URL` / `DIRECT_DATABASE_URL` 이 자동 주입됨 (spec 052).

## 비목표 (그대로 유지)

- **인증/식별**: `@ax-hub/sdk` 의 identity(`makeAxhub()` / `sdk.identity.me()`)와 `_hub_access`
  세션 처리, 로그인 사용자 환영 카드 — 유지.
- **게이트웨이**: 외부 connector 읽기(`makeGateway()` / `queryConnector()`) — 유지. (동적 DB 와
  별개 기능이며 사용자가 명시적으로 유지 요청.)
- astro/vite 템플릿 — 본 설계 범위 밖. vite 는 정적 SPA(서버 없음)라 `DATABASE_URL` 불가.

## 현재 상태 (SDK 사용 지점)

| 파일 | SDK 용도 | 조치 |
|---|---|---|
| `package.json` | `@ax-hub/sdk` 의존성 | **유지** (identity·gateway 가 씀) |
| `lib/axhub-server.ts` | `makeAxhub`(identity)·`makeApp`(동적DB)·`makeGateway`/`queryConnector`(게이트웨이) | **트림**: `makeApp` 및 동적 DB 관련 주석/예시만 제거, 나머지 유지 |
| `lib/data.ts` | `table()` → `app.data.table()` (동적 DB 단일 진입점) | **삭제** |
| `app/page.tsx` | `sdk.identity.me()` 환영 카드 (동적 DB 미사용) | **유지** + rawDB 데모 섹션 추가 |
| `app/layout.tsx` | SDK 미사용 (grep 오탐) | 변경 없음 |

가이드 파일: `AGENTS.md`(R1~R3 동적테이블 룰 + S3/S7 데이터 DSL), `CLAUDE.md`,
`prompts/getting-started.md` 의 동적 DB 안내 — **제거 후 표준 Postgres 안내로 교체**. 인증/게이트웨이
가이드는 유지.

## 변경 설계

### 제거 (동적 DB)
- `lib/data.ts` 파일 삭제.
- `lib/axhub-server.ts` 에서 `makeApp()` 와 `app.data.discover/table` 예시·주석 제거
  (`makeTenant()` 가 게이트웨이 외 용도가 없으면 함께 제거; 게이트웨이가 쓰면 유지).
- `AGENTS.md`: R1(테이블 먼저 생성)·R2(owner_id 자동격리)·R3(`table()`·raw fetch 금지) 및
  S3/S7 의 데이터 API DSL 부분 삭제.
- `prompts/getting-started.md`: 동적 테이블 생성·사용 섹션 삭제.
- 동적 DB 관련 환경변수 안내(있으면) 삭제.

### 추가 (표준 Postgres = rawDB)
- `lib/db.ts` — `postgres.js` 클라이언트. 런타임 쿼리는 `DATABASE_URL`, 스키마 초기화/마이그레이션은
  `DIRECT_DATABASE_URL`(session 풀러, advisory lock) 사용. 멱등 `ensureSchema()`
  (`CREATE TABLE IF NOT EXISTS ...`) 포함.
- `docker-compose.yml` — 로컬 Postgres 1개. `docker compose up -d` 한 방으로 로컬 DB 기동
  (= "자연스럽게 로컬 디비 띄우기").
- `.env.example` — `DATABASE_URL=postgres://postgres:postgres@localhost:5432/app` (로컬 기본값).
- `axhub.yaml` — 최상위 블록 추가:
  ```yaml
  database:
    engine: postgres
  ```
  기존 `APPHUB_*`(identity/gateway 용) env 는 유지.
- 데모 — `app/page.tsx` 에 **사용자별 todo** 예제: `sdk.identity.me()` 로 user id 를 받아
  자기 Postgres 테이블의 `user_id` 컬럼으로 격리(서버 액션 또는 라우트 핸들러에서 `lib/db.ts` 사용).
  → identity 유지 + 저장은 rawDB.
- 가이드 재작성(`AGENTS.md`·`CLAUDE.md`·`prompts/getting-started.md`): "데이터는 `lib/db.ts` 의
  표준 Postgres 로. 테이블은 `lib/db.ts` 에서 `CREATE TABLE IF NOT EXISTS` 로 만들고 평범한 SQL 로
  read/write. 사용자별 데이터는 `sdk.identity.me()` 의 user id 를 `user_id` 컬럼으로. 로컬은
  `docker compose up`." — 동적 테이블/`/data`/`table()` 언급 0.

### PG 클라이언트
`postgres.js` (가벼움, tagged-template 안전 SQL, ORM/생성 단계 없음, LLM 친화). Dockerfile 빌드에
추가 단계 불필요.

## 데이터 흐름

```
[브라우저] --(_hub_access 쿠키, axhub 엣지 SSO)--> [Next 서버]
  app/page.tsx (서버) ── sdk.identity.me() ──> 현재 사용자 (identity, 유지)
                     └─ lib/db.ts (postgres.js) ──> Postgres (DATABASE_URL)
                          런타임: DATABASE_URL / 스키마초기화: DIRECT_DATABASE_URL
로컬: docker-compose Postgres   |   배포: axhub.yaml database.engine → 주입
```

## 검증 / 성공 기준

1. 템플릿 전체 grep 에 동적 DB 흔적 0: `app.data`, `lib/data`, `table(`(동적), `/data/`,
   `discover(`, `defineSchema`, AGENTS 의 R1~R3 등.
2. `npm install && docker compose up -d && npm run dev` → 데모 todo CRUD 가 로컬 Postgres 로 동작.
3. identity 환영 카드 정상(로그인 사용자 표시) — SDK identity 유지 확인.
4. 게이트웨이 헬퍼(`makeGateway`/`queryConnector`) 컴파일·존재 유지.
5. `axhub.yaml` 에 `database.engine: postgres` 선언 — 배포 시 prod `DATABASE_URL` 주입(별도 배포 검증).
6. 빌드 통과(`npm run build`), Dockerfile 빌드 통과.

## 후속 (범위 밖)
- astro-axhub 동일 적용(SSR 이라 가능).
- vite-react-axhub: 정적 SPA — rawDB 불가, 별도 논의(서버 템플릿 안내 등).
