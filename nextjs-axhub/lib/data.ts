// 앱 자체 DB (raw-db) 접근 헬퍼 — 서버 전용. 앱 데이터 read/write 의 단일 진입점이에요.
//
// raw-db 모델 (SDK 5.0.0 에서 동적테이블 app.data.* 가 제거되며 이걸로 바뀌었어요):
//   - `axhub` 에서 이 앱의 raw DB 를 켜면(enable), 앱 전용 Postgres role 이 만들어지고
//     다음 배포 때 DATABASE_URL 이 앱에 주입돼요. 그러면 앱이 *자기* Postgres 에 SQL 로 직접 붙어요.
//   - 테이블(DDL)은 이제 앱의 몫이에요 — `db/migrations/*.sql` 를 psql 로 적용해요 (더 이상 `axhub tables create` 아님).
//
// ⚠️⚠️ 보안 — 가장 중요 (AGENTS.md R2 와 짝):
//   예전 app.data.* 동적테이블은 backend 가 owner_id 로 사용자 행을 *자동 격리*했어요.
//   raw-db 는 자동 격리가 *없어요*. 사용자별 데이터는 앱이 직접 `WHERE owner_id = $1` 로 필터하고,
//   insert 때 owner_id 를 직접 넣어야 해요. 안 하면 이 템플릿으로 만든 모든 앱이 사용자 간 데이터를 유출해요.
//   → 그래서 사용자-스코프 CRUD 는 항상 아래 ownedTable() 로 하세요. owner_id 격리가 기본으로 박혀 있어요.
//
// 서버 전용: currentUserId() 가 makeAxhub() (next/headers) 를 쓰므로 "use client" 에서 import 하면 빌드가 깨져요.
import { Pool, type QueryResultRow } from 'pg'
import { makeAxhub } from './axhub-server'

// ── Pool 싱글톤 ──────────────────────────────────────────────────────────────
// AxHubClient 와 달리 raw-db 는 *앱 고정* DB (사용자 JWT 무관) 이라 모듈 레벨 싱글톤이 맞아요.
// Next.js dev 의 hot-reload 가 모듈을 다시 평가해 Pool 이 중복 생성되는 걸 globalThis 캐시로 막아요.
const globalForPg = globalThis as unknown as { __axhubPgPool?: Pool }

function getPool(): Pool {
  if (globalForPg.__axhubPgPool) return globalForPg.__axhubPgPool
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL 이 설정되지 않았어요. `axhub` 에서 이 앱의 raw DB 를 켜면(enable) ' +
        '배포 시 자동 주입돼요. 로컬에서 직접 실행 중이라면 .env.local 에 DATABASE_URL 을 채워 주세요.',
    )
  }
  const pool = new Pool({ connectionString })
  globalForPg.__axhubPgPool = pool
  return pool
}

// ── 저수준 query ─────────────────────────────────────────────────────────────
// 항상 parameterized ($1,$2 는 postgres 네이티브 placeholder). 사용자 입력을 sql 문자열에 절대 이어붙이지 마세요.
//
//   const { rows } = await query<{ id: string; title: string }>(
//     'SELECT id, title FROM todos WHERE owner_id = $1 ORDER BY created_at DESC LIMIT $2',
//     [ownerId, 50],
//   )
//
// ⚠️ 이 저수준 query 는 owner_id 격리를 *자동으로 안 해요* — 사용자-스코프 데이터는 ownedTable() 을 쓰거나,
//    직접 쓸 땐 반드시 owner_id 를 WHERE 와 INSERT 양쪽에 넣는 건 호출자 책임이에요.
export async function query<Row extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<{ rows: Row[]; rowCount: number }> {
  const res = await getPool().query<Row>(sql, params)
  return { rows: res.rows, rowCount: res.rowCount ?? 0 }
}

// 식별자(테이블/컬럼명)는 parameterize 가 안 돼서 SQL 에 직접 박혀요 → injection 방지로 엄격 검증.
// 소문자 시작, 소문자/숫자/밑줄만 (postgres unquoted identifier 안전 부분집합).
const IDENT = /^[a-z_][a-z0-9_]*$/
function assertIdent(name: string, kind: string): string {
  if (!IDENT.test(name)) {
    throw new Error(`잘못된 ${kind} 이름: ${JSON.stringify(name)} (허용: ^[a-z_][a-z0-9_]*$)`)
  }
  return name
}

// ── owner-스코프 테이블 헬퍼 (기본 경로 — owner_id 격리가 박혀 있어요) ──────────
// 모든 메서드가 owner_id 를 강제로 주입/필터해요: insert 는 owner_id=ownerId 로 세팅하고,
// list/get/update/delete 는 `owner_id = $n` 을 걸어요. 그래서 남의 행에 절대 못 닿아요.
//
//   const ownerId = await currentUserId()
//   const todos = ownedTable<{ id: string; title: string; done: boolean }>('todos', ownerId)
//   await todos.insert({ title: '장보기', done: false })   // owner_id 자동 — 넣지 마세요
//   const { rows } = await todos.list({ orderBy: 'created_at desc', limit: 50 })  // 내 행만
//   const one = await todos.get(someId)                     // 내 행일 때만 반환 (아니면 null)
//   await todos.update(someId, { done: true })
//   await todos.delete(someId)
export function ownedTable<Row extends QueryResultRow = QueryResultRow>(tableName: string, ownerId: string) {
  const table = assertIdent(tableName, '테이블')

  // insert/update 의 객체 키는 컬럼 식별자로 SQL 에 박혀요 → 전부 검증. 값은 항상 $n 로.
  // owner_id 는 헬퍼가 강제로 넣으므로 호출자가 values/patch 로 덮어쓰지 못하게 막아요 (격리 우회 방지).
  function columns(values: Record<string, unknown>): string[] {
    const keys = Object.keys(values)
    for (const k of keys) {
      assertIdent(k, '컬럼')
      if (k === 'owner_id') {
        throw new Error('owner_id 는 ownedTable 이 자동으로 설정해요 — values/patch 에 직접 넣지 마세요.')
      }
    }
    return keys
  }

  return {
    // owner_id = ownerId 로 필터. opts.orderBy 는 "col dir" 형식 (col 은 식별자 검증, dir 은 asc/desc 만).
    async list(opts?: { orderBy?: string; limit?: number; offset?: number }): Promise<{ rows: Row[]; rowCount: number }> {
      const params: unknown[] = [ownerId]
      let sql = `SELECT * FROM ${table} WHERE owner_id = $1`
      if (opts?.orderBy) {
        const [col, dir = 'asc'] = opts.orderBy.trim().split(/\s+/)
        assertIdent(col, '컬럼')
        const direction = dir.toLowerCase() === 'desc' ? 'DESC' : 'ASC'
        sql += ` ORDER BY ${col} ${direction}`
      }
      if (typeof opts?.limit === 'number') {
        params.push(opts.limit)
        sql += ` LIMIT $${params.length}`
      }
      if (typeof opts?.offset === 'number') {
        params.push(opts.offset)
        sql += ` OFFSET $${params.length}`
      }
      return query<Row>(sql, params)
    },

    // id + owner_id 둘 다 매칭될 때만 (남의 id 를 넘겨도 못 읽어요). 없으면 null.
    async get(id: string): Promise<Row | null> {
      const { rows } = await query<Row>(`SELECT * FROM ${table} WHERE id = $1 AND owner_id = $2`, [id, ownerId])
      return rows[0] ?? null
    },

    // owner_id = ownerId 를 강제로 함께 insert. 생성된 행을 반환.
    async insert(values: Record<string, unknown>): Promise<Row> {
      const keys = columns(values)
      const cols = ['owner_id', ...keys]
      const vals = [ownerId, ...keys.map((k) => values[k])]
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
      const { rows } = await query<Row>(
        `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
        vals,
      )
      return rows[0]
    },

    // id + owner_id 매칭될 때만 patch 적용 (남의 행은 못 고쳐요). 없으면 null.
    async update(id: string, patch: Record<string, unknown>): Promise<Row | null> {
      const keys = columns(patch)
      if (keys.length === 0) return this.get(id)
      const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
      const params = [...keys.map((k) => patch[k]), id, ownerId]
      const { rows } = await query<Row>(
        `UPDATE ${table} SET ${sets} WHERE id = $${keys.length + 1} AND owner_id = $${keys.length + 2} RETURNING *`,
        params,
      )
      return rows[0] ?? null
    },

    // id + owner_id 매칭될 때만 삭제. 삭제된 행 수 반환 (0 = 내 행이 아니었음).
    async delete(id: string): Promise<number> {
      const { rowCount } = await query(`DELETE FROM ${table} WHERE id = $1 AND owner_id = $2`, [id, ownerId])
      return rowCount
    },
  }
}

// ── 현재 로그인 사용자 id ─────────────────────────────────────────────────────
// ownedTable(..., ownerId) 에 넘길 owner id 를 AX Hub identity 에서 가져와요.
// @ax-hub/sdk 의 MeResponse 는 flat 하게 userId 를 노출해요 (me.userId — me.user.id 아님).
// 요청 스코프(Server Component / Route Handler / Server Action) 안에서만 호출하세요 (로그인 쿠키 필요).
export async function currentUserId(): Promise<string> {
  const sdk = await makeAxhub()
  const me = await sdk.identity.me()
  return me.userId
}
