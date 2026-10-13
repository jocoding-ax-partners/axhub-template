// 표준 PostgreSQL 접근 (서버 전용). 이 앱의 데이터는 전부 여기로 read/write 해요.
//
// 연결 문자열은 환경에서 와요:
//   - 로컬: `npm run db:up` 으로 띄운 Postgres → .env.local 의 DATABASE_URL
//   - 배포: axhub 가 전용 DB 를 발급하고 DATABASE_URL / DIRECT_DATABASE_URL 을 자동 주입
//     ⚠️ 기본값은 DB 없음 — axhub.yaml 의 database 선언 주석을 풀어야 발급돼요
//     (axhub.yaml 의 `database: { engine: postgres }` 선언이 트리거)
//
// 두 URL 의 차이:
//   - DATABASE_URL        런타임 쿼리용 (풀러 경유). prepared statement 미지원 풀러가 있어 prepare:false.
//   - DIRECT_DATABASE_URL 스키마 초기화/마이그레이션용 (직결 세션). 없으면 DATABASE_URL 로 폴백(로컬).
//
// 클라이언트 컴포넌트에서 import 금지 — 서버(Server Component / Route Handler / Server Action)에서만.
import postgres from 'postgres'

const RUNTIME_URL = process.env.DATABASE_URL ?? ''
const DIRECT_URL = process.env.DIRECT_DATABASE_URL || RUNTIME_URL

// DATABASE_URL 이 채워졌는지. 로컬에서 아직 Postgres 를 안 띄웠거나,
// 배포본에서 axhub.yaml 의 database 선언이 주석 상태면 false.
export function isDbConfigured(): boolean {
  return Boolean(RUNTIME_URL)
}

// 런타임 쿼리 클라이언트 (지연 싱글톤 — 모듈 로드 시 연결하지 않음).
//
//   const rows = await db()`SELECT id, name FROM candidates WHERE id = ${id}`
//
// 값은 tagged-template 으로 넘기면 자동으로 안전하게 바인딩돼요 (SQL 인젝션 방지).
//
// dev(`next dev`)의 핫리로드는 이 모듈을 다시 평가해요 — 모듈 레벨 변수만 쓰면 리로드마다
// 새 커넥션 풀이 생기고 이전 풀은 안 닫혀 로컬 Postgres 커넥션이 누적돼요(too many connections).
// 그래서 dev 에서만 globalThis 에 풀을 캐시해 핫리로드를 견뎌요. 프로덕션은 기존 경로 그대로.
const _global = globalThis as typeof globalThis & { __axhubSql?: ReturnType<typeof postgres> }
let _sql: ReturnType<typeof postgres> | null = null
export function db(): ReturnType<typeof postgres> {
  if (!RUNTIME_URL) {
    throw new Error(
      'DATABASE_URL 이 없어요. 로컬은 `npm run db:up` 으로 Postgres 를 띄운 뒤 ' +
        '.env.local 에 DATABASE_URL 을 채워 주세요. axhub 는 axhub.yaml 의 database 선언 주석을 풀고 다시 배포해야 발급해요.',
    )
  }
  // prepare:false — 일부 연결 풀러(transaction pooling)는 prepared statement 를 지원하지 않아요.
  if (process.env.NODE_ENV !== 'production') {
    _global.__axhubSql ??= postgres(RUNTIME_URL, { prepare: false })
    return _global.__axhubSql
  }
  _sql ??= postgres(RUNTIME_URL, { prepare: false })
  return _sql
}

// 멱등 스키마 초기화. 프로세스당 한 번만 실행돼요. 데이터 read/write 전에 한 번 await 하세요.
// 테이블을 추가/변경하려면 아래 CREATE TABLE IF NOT EXISTS 블록을 늘리면 돼요 (평범한 SQL).
//
// 이 promise 는 일부러 globalThis 에 캐시하지 않아요 — dev 핫리로드 때 재실행돼야
// 여기 추가한 테이블이 서버 재시작 없이 반영돼요 (커넥션은 finally 로 닫혀 누수 없음).
let _schema: Promise<void> | null = null
export function ensureSchema(): Promise<void> {
  _schema ??= (async () => {
    // 마이그레이션은 직결 세션(DIRECT_URL)으로 — advisory lock 등 세션 기능이 필요할 수 있어요.
    const migrate = postgres(DIRECT_URL, { max: 1 })
    try {
      // 파드 여러 개가 동시에 떠도 DDL 이 한 번에 하나씩 돌게 세션 잠금을 잡아요
      // (CREATE ... IF NOT EXISTS 도 동시에 돌면 pg_type 중복 오류가 날 수 있어요).
      await migrate`SELECT pg_advisory_lock(767019)`
      // 지원자 한 명 = 한 줄. 면접관은 axhub 로그인 이메일(소문자) 배열로 배정해요.
      // interview_at 은 시각(timestamptz) — 화면에서 고른 KST 시각을 그대로 저장하고 KST 로 보여요.
      await migrate`
        CREATE TABLE IF NOT EXISTS candidates (
          id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          name         text        NOT NULL,
          position     text        NOT NULL,
          interview_at timestamptz NOT NULL,
          interviewers text[]      NOT NULL CHECK (cardinality(interviewers) BETWEEN 1 AND 10),
          result       text        CHECK (result IN ('pass', 'hold', 'fail')),
          result_by    text,
          result_at    timestamptz,
          created_by   text        NOT NULL DEFAULT '',
          created_at   timestamptz NOT NULL DEFAULT now()
        )
      `
      await migrate`CREATE INDEX IF NOT EXISTS candidates_interviewers_idx ON candidates USING gin (interviewers)`
      await migrate`CREATE INDEX IF NOT EXISTS candidates_interview_at_idx ON candidates (interview_at DESC, id DESC)`
      // 면접관 한 명이 지원자 한 명에게 남긴 평가표 = 한 줄. 다시 저장하면 같은 줄을 고쳐요.
      // 평균은 따로 저장하지 않고 이 표에서 매번 계산해요.
      await migrate`
        CREATE TABLE IF NOT EXISTS scorecards (
          candidate_id      bigint      NOT NULL REFERENCES candidates (id) ON DELETE CASCADE,
          interviewer_email text        NOT NULL,
          interviewer_name  text        NOT NULL DEFAULT '',
          job_skill         smallint    NOT NULL CHECK (job_skill BETWEEN 1 AND 5),
          communication     smallint    NOT NULL CHECK (communication BETWEEN 1 AND 5),
          culture_fit       smallint    NOT NULL CHECK (culture_fit BETWEEN 1 AND 5),
          comment           text        NOT NULL,
          created_at        timestamptz NOT NULL DEFAULT now(),
          updated_at        timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (candidate_id, interviewer_email)
        )
      `
    } finally {
      // 연결을 닫으면 세션 잠금도 풀려요.
      await migrate.end()
    }
  })().catch((e) => {
    // 실패(일시적인 DB 연결 오류 등)는 기억하지 않아요 — 다음 요청이 다시 시도해요.
    _schema = null
    throw e
  })
  return _schema
}
