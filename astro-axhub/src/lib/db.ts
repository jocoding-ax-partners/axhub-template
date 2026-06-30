// 표준 PostgreSQL 접근 (서버 전용 — Astro frontmatter / API endpoint). 이 앱의 데이터는 전부 여기로.
//
// 연결 문자열은 환경에서 와요:
//   - 로컬: `docker compose up -d` 로 띄운 Postgres → .env 의 DATABASE_URL
//   - 배포: axhub 가 전용 DB 를 발급하고 DATABASE_URL / DIRECT_DATABASE_URL 을 자동 주입
//     (axhub.yaml 의 `database: { engine: postgres }` 선언이 트리거)
//
// 두 URL 의 차이:
//   - DATABASE_URL        런타임 쿼리용 (풀러 경유). prepared statement 미지원 풀러가 있어 prepare:false.
//   - DIRECT_DATABASE_URL 스키마 초기화/마이그레이션용 (직결 세션). 없으면 DATABASE_URL 로 폴백(로컬).
import postgres from "postgres";

const RUNTIME_URL = process.env.DATABASE_URL ?? "";
const DIRECT_URL = process.env.DIRECT_DATABASE_URL || RUNTIME_URL;

// DATABASE_URL 이 채워졌는지. 로컬에서 docker compose 를 아직 안 띄웠으면 false.
export function isDbConfigured(): boolean {
  return Boolean(RUNTIME_URL);
}

// 런타임 쿼리 클라이언트 (지연 싱글톤 — 모듈 로드 시 연결하지 않음).
//
//   const rows = await db()`SELECT * FROM todos WHERE user_key = ${userKey}`
//
// 값은 tagged-template 으로 넘기면 자동으로 안전하게 바인딩돼요 (SQL 인젝션 방지).
let _sql: ReturnType<typeof postgres> | null = null;
export function db(): ReturnType<typeof postgres> {
  if (!RUNTIME_URL) {
    throw new Error(
      "DATABASE_URL 이 없어요. 로컬은 `docker compose up -d` 로 Postgres 를 띄운 뒤 " +
        ".env 에 DATABASE_URL 을 채워 주세요. axhub 로 배포하면 자동 주입돼요.",
    );
  }
  // prepare:false — 일부 연결 풀러(transaction pooling)는 prepared statement 를 지원하지 않아요.
  _sql ??= postgres(RUNTIME_URL, { prepare: false });
  return _sql;
}

// 멱등 스키마 초기화. 프로세스당 한 번만 실행돼요. 데이터 read/write 전에 한 번 await 하세요.
// 테이블을 추가/변경하려면 아래 CREATE TABLE IF NOT EXISTS 블록을 늘리면 돼요 (평범한 SQL).
let _schema: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  _schema ??= (async () => {
    // 마이그레이션은 직결 세션(DIRECT_URL)으로 — advisory lock 등 세션 기능이 필요할 수 있어요.
    const migrate = postgres(DIRECT_URL, { max: 1 });
    try {
      await migrate`
        CREATE TABLE IF NOT EXISTS todos (
          id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_key   text        NOT NULL,
          title      text        NOT NULL,
          done       boolean     NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await migrate`CREATE INDEX IF NOT EXISTS todos_user_key_idx ON todos (user_key)`;
    } finally {
      await migrate.end();
    }
  })();
  return _schema;
}
