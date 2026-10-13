// 비품 데이터 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import { db, ensureSchema } from './db'
import { exceedsStockMax, formatCount, likePattern, type RequestStatus, type RequestValue, type SupplyValue } from './supply'

export type SupplyRow = {
  id: string
  name: string
  stock: number
  min_stock: number
  short: boolean
  /** 아직 지급 안 된 신청 수량 합 */
  pending_qty: number
}

export type MyRequest = {
  id: string
  supply_name: string
  qty: number
  note: string
  status: RequestStatus
  reject_reason: string | null
  decided_by: string | null
  decided_at: Date | null
  created_at: Date
}

export type PendingRequest = {
  id: string
  supply_name: string
  stock: number
  min_stock: number
  user_key: string
  user_name: string
  user_email: string
  qty: number
  note: string
  created_at: Date
}

export type Summary = { supplies: number; short: number; pending: number }

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean }

function toPage<T>(rows: T[]): Page<T> {
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE }
}

/** 23505 = 같은 값이 이미 있음 (비품 이름 중복). */
function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505'
}

const DUPLICATE_NAME = '같은 이름의 비품이 이미 있어요.'

export async function getSummary(): Promise<Summary> {
  await ensureSchema()
  const [row] = await db()<Summary[]>`
    SELECT (SELECT count(*)::int FROM supplies) AS supplies,
           (SELECT count(*)::int FROM supplies WHERE stock < min_stock) AS short,
           (SELECT count(*)::int FROM supply_requests WHERE status = 'pending') AS pending`
  return row
}

// ponytail: OFFSET 페이징 — 사무실 비품 수백 개 규모에선 충분해요. 수만 개가 되면 커서로 바꿔요.
/** 비품 목록 — 부족한 비품이 맨 위, 그다음 이름 순. q 가 있으면 이름에 그 글자가 들어간 것만. */
export async function listSupplies(q: string, page: number): Promise<Page<SupplyRow> & { total: number }> {
  await ensureSchema()
  const match = q ? db()`WHERE s.name ILIKE ${likePattern(q)}` : db()``
  const [rows, [{ total }]] = await Promise.all([
    db()<SupplyRow[]>`
      SELECT s.id::text, s.name, s.stock, s.min_stock, s.stock < s.min_stock AS short,
             coalesce((SELECT sum(r.qty) FROM supply_requests r WHERE r.supply_id = s.id AND r.status = 'pending'), 0)::int AS pending_qty
        FROM supplies s
        ${match}
       ORDER BY (s.stock < s.min_stock) DESC, lower(s.name), s.id
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    db()<{ total: number }[]>`SELECT count(*)::int AS total FROM supplies s ${match}`,
  ])
  return { ...toPage(rows), total }
}

export async function listMyRequests(userKey: string, page: number): Promise<Page<MyRequest>> {
  await ensureSchema()
  const rows = await db()<MyRequest[]>`
    SELECT r.id::text, s.name AS supply_name, r.qty, r.note, r.status, r.reject_reason, r.decided_by, r.decided_at, r.created_at
      FROM supply_requests r JOIN supplies s ON s.id = r.supply_id
     WHERE r.user_key = ${userKey}
     ORDER BY r.id DESC
     LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`
  return toPage(rows)
}

/** 지급 대기 중인 신청 — 먼저 들어온 순. q 는 신청자 이름·이메일 또는 비품 이름. */
export async function listPending(q: string, page: number): Promise<Page<PendingRequest> & { total: number }> {
  await ensureSchema()
  const like = likePattern(q)
  const match = q ? db()`AND (r.user_name ILIKE ${like} OR r.user_email ILIKE ${like} OR s.name ILIKE ${like})` : db()``
  const [rows, [{ total }]] = await Promise.all([
    db()<PendingRequest[]>`
      SELECT r.id::text, s.name AS supply_name, s.stock, s.min_stock, r.user_key, r.user_name, r.user_email, r.qty, r.note, r.created_at
        FROM supply_requests r JOIN supplies s ON s.id = r.supply_id
       WHERE r.status = 'pending' ${match}
       ORDER BY r.created_at, r.id
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    db()<{ total: number }[]>`
      SELECT count(*)::int AS total
        FROM supply_requests r JOIN supplies s ON s.id = r.supply_id
       WHERE r.status = 'pending' ${match}`,
  ])
  return { ...toPage(rows), total }
}

// ── 쓰기 — 문제가 있으면 사용자에게 보여 줄 문구를, 없으면 null 을 돌려줘요 ────────────

export async function createSupply(v: SupplyValue): Promise<string | null> {
  await ensureSchema()
  const rows = await db()`
    INSERT INTO supplies (name, stock, min_stock) VALUES (${v.name}, ${v.stock}, ${v.minStock})
    ON CONFLICT DO NOTHING
    RETURNING id`
  return rows.length ? null : DUPLICATE_NAME
}

/** 이름 · 최소 재고 고치기. 재고 수는 입고와 지급으로만 바뀌어요. */
export async function updateSupply(id: string, v: Pick<SupplyValue, 'name' | 'minStock'>): Promise<string | null> {
  await ensureSchema()
  try {
    const rows = await db()`
      UPDATE supplies SET name = ${v.name}, min_stock = ${v.minStock}, updated_at = now()
       WHERE id = ${id} RETURNING id`
    return rows.length ? null : '없는 비품이에요. 화면을 새로고침해 주세요.'
  } catch (e) {
    if (isUniqueViolation(e)) return DUPLICATE_NAME
    throw e
  }
}

/** 입고 — 재고에 qty 를 더해요. */
export async function receiveStock(id: string, qty: number): Promise<{ error: string } | { name: string; stock: number }> {
  await ensureSchema()
  return db().begin(async (sql) => {
    const [row] = await sql<{ name: string; stock: number }[]>`SELECT name, stock FROM supplies WHERE id = ${id} FOR UPDATE`
    if (!row) return { error: '없는 비품이에요. 화면을 새로고침해 주세요.' }
    if (exceedsStockMax(row.stock, qty)) return { error: '재고가 너무 커져요. 수량을 확인해 주세요.' }
    const [after] = await sql<{ stock: number }[]>`
      UPDATE supplies SET stock = stock + ${qty}, updated_at = now() WHERE id = ${id} RETURNING stock`
    return { name: row.name, stock: after.stock }
  })
}

type Person = { userKey: string; name: string; email: string }

export async function createRequest(who: Person, supplyId: string, v: RequestValue): Promise<string | null> {
  await ensureSchema()
  const rows = await db()`
    INSERT INTO supply_requests (supply_id, user_key, user_name, user_email, qty, note)
    SELECT id, ${who.userKey}, ${who.name}, ${who.email}, ${v.qty}, ${v.note} FROM supplies WHERE id = ${supplyId}
    RETURNING id`
  return rows.length ? null : '없는 비품이에요. 화면을 새로고침해 주세요.'
}

export const SELF_DECISION = '본인 신청은 다른 관리자가 처리해야 해요.'

/**
 * 지급 · 반려. 대기 중인 신청만 바꿀 수 있어요.
 * 지급은 신청 상태 변경과 재고 차감을 한 트랜잭션으로 해요 — 재고가 모자라면 아무것도 바뀌지 않아요.
 */
export async function decideRequest(
  id: string,
  decision: 'issued' | 'rejected',
  rejectReason: string | null,
  decider: { userKey: string; name: string },
): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (sql) => {
    // 신청 줄 → 비품 줄 순서로 잠가요 (동시에 지급해도 재고가 음수가 되지 않게).
    const [req] = await sql<{ supply_id: string; user_key: string; qty: number; status: RequestStatus }[]>`
      SELECT supply_id::text, user_key, qty, status FROM supply_requests WHERE id = ${id} FOR UPDATE`
    if (!req) return '없는 신청이에요. 화면을 새로고침해 주세요.'
    if (req.status !== 'pending') return '이미 처리된 신청이에요.'
    // 자기 신청을 스스로 처리하지 못하게 — 화면에서 버튼을 숨기는 것과 별개로 서버에서 막아요.
    if (req.user_key === decider.userKey) return SELF_DECISION

    if (decision === 'issued') {
      const [s] = await sql<{ stock: number }[]>`SELECT stock FROM supplies WHERE id = ${req.supply_id} FOR UPDATE`
      if (s.stock < req.qty) return `재고가 모자라요. 지금 재고는 ${formatCount(s.stock)}개예요. 입고한 뒤 지급해 주세요.`
      await sql`UPDATE supplies SET stock = stock - ${req.qty}, updated_at = now() WHERE id = ${req.supply_id}`
    }

    await sql`
      UPDATE supply_requests
         SET status = ${decision},
             reject_reason = ${decision === 'rejected' ? rejectReason : null},
             decided_by = ${decider.name},
             decided_at = now()
       WHERE id = ${id}`
    return null
  })
}
