// 구매 요청 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import type postgres from 'postgres'
import { db, ensureSchema } from './db'
import { HIGH_VALUE_THRESHOLD, type PurchaseRequest, type PurchaseStatus } from './purchase'

export type Purchase = {
  id: string
  user_key: string
  user_name: string
  user_email: string
  item: string
  quantity: number
  unit_price: number
  total: number
  reason: string
  status: PurchaseStatus
  reject_reason: string | null
  decided_by: string | null
  decided_at: Date | null
  created_at: Date
}

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean; total: number }

// 한 쪽 읽기 + 조건에 맞는 전체 건수. 금액은 bigint 지만 상한(수량 1만 × 단가 10억)이
// JS 숫자로 정확한 범위라 float8 로 읽어요.
async function readPage(sql: postgres.Sql, where: postgres.PendingQuery<postgres.Row[]>, order: postgres.PendingQuery<postgres.Row[]>, page: number): Promise<Page<Purchase>> {
  const [rows, [{ total }]] = await Promise.all([
    sql<Purchase[]>`
      SELECT id::text, user_key, user_name, user_email, item, quantity,
             unit_price::float8 AS unit_price, total::float8 AS total,
             reason, status, reject_reason, decided_by, decided_at, created_at
        FROM purchase_requests
       WHERE ${where}
       ORDER BY ${order}
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    sql<{ total: number }[]>`SELECT count(*)::int AS total FROM purchase_requests WHERE ${where}`,
  ])
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE, total }
}

function likeOf(q: string): string {
  return '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
}

export type MySummary = Record<PurchaseStatus, number> & { approvedTotal: number }

/** 내 요청 상태별 건수와 승인된 총액. */
export async function getMySummary(userKey: string): Promise<MySummary> {
  await ensureSchema()
  const [row] = await db()<MySummary[]>`
    SELECT count(*) FILTER (WHERE status = 'pending')::int  AS pending,
           count(*) FILTER (WHERE status = 'approved')::int AS approved,
           count(*) FILTER (WHERE status = 'rejected')::int AS rejected,
           coalesce(sum(total) FILTER (WHERE status = 'approved'), 0)::float8 AS "approvedTotal"
      FROM purchase_requests
     WHERE user_key = ${userKey}`
  return row
}

// ponytail: OFFSET 페이징 — 요청 수천 건 규모에선 충분해요. 수만 건이 되면 커서로 바꿔요.
/** 내 요청. status 가 있으면 그 상태만, q 가 있으면 품목에 그 글자가 들어간 것만. 최근 순. */
export async function listMyRequests(
  userKey: string,
  status: PurchaseStatus | null,
  q: string,
  page: number,
): Promise<Page<Purchase>> {
  await ensureSchema()
  const sql = db()
  const where = sql`
    user_key = ${userKey}
    ${status ? sql`AND status = ${status}` : sql``}
    ${q ? sql`AND item ILIKE ${likeOf(q)}` : sql``}`
  return readPage(sql, where, sql`id DESC`, page)
}

export type AdminView = 'pending' | 'done'

/**
 * 결재함. pending = 대기(먼저 올라온 순), done = 처리 완료(최근 처리 순).
 * q 는 품목 · 요청자 이름 · 이메일, highOnly 면 고액(총액 100만 원 이상)만.
 */
export async function listForAdmin(view: AdminView, q: string, highOnly: boolean, page: number): Promise<Page<Purchase>> {
  await ensureSchema()
  const sql = db()
  const like = likeOf(q)
  const where = sql`
    ${view === 'pending' ? sql`status = 'pending'` : sql`status <> 'pending'`}
    ${highOnly ? sql`AND total >= ${HIGH_VALUE_THRESHOLD}` : sql``}
    ${q ? sql`AND (item ILIKE ${like} OR user_name ILIKE ${like} OR user_email ILIKE ${like})` : sql``}`
  const order = view === 'pending' ? sql`id ASC` : sql`decided_at DESC, id DESC`
  return readPage(sql, where, order, page)
}

export type PendingSummary = { count: number; high: number; amount: number }

/** 결재 대기 건수 · 그중 고액 건수 · 대기 금액 합계. */
export async function getPendingSummary(): Promise<PendingSummary> {
  await ensureSchema()
  const [row] = await db()<PendingSummary[]>`
    SELECT count(*)::int AS count,
           count(*) FILTER (WHERE total >= ${HIGH_VALUE_THRESHOLD})::int AS high,
           coalesce(sum(total), 0)::float8 AS amount
      FROM purchase_requests
     WHERE status = 'pending'`
  return row
}

type Requester = { userKey: string; name: string; email: string }

/** 구매 요청 저장. 총액은 DB 가 수량 × 단가로 계산해요. */
export async function createPurchase(who: Requester, req: PurchaseRequest): Promise<void> {
  await ensureSchema()
  await db()`
    INSERT INTO purchase_requests (user_key, user_name, user_email, item, quantity, unit_price, reason)
    VALUES (${who.userKey}, ${who.name}, ${who.email}, ${req.item}, ${req.quantity}, ${req.unitPrice}, ${req.reason})`
}

export const SELF_DECISION = '본인 요청은 다른 관리자가 처리해야 해요.'

/** 승인·반려. 대기 중인 요청만 바꿀 수 있어요. 문제가 있으면 사용자에게 보여 줄 문구를, 없으면 null. */
export async function decidePurchase(
  id: string,
  decision: 'approved' | 'rejected',
  rejectReason: string | null,
  decider: { userKey: string; name: string },
): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (sql) => {
    // 관리자 두 명이 동시에 눌러도 한 번만 처리되게 줄을 잠그고 상태를 다시 봐요.
    const [row] = await sql<{ user_key: string; status: PurchaseStatus }[]>`
      SELECT user_key, status FROM purchase_requests WHERE id = ${id} FOR UPDATE`
    if (!row) return '없는 요청이에요. 화면을 새로고침해 주세요.'
    // 자기 요청을 스스로 승인하지 못하게 — 화면에서 버튼을 숨기는 것과 별개로 서버에서 막아요.
    if (row.user_key === decider.userKey) return SELF_DECISION
    if (row.status !== 'pending') return '이미 처리된 요청이에요.'
    await sql`
      UPDATE purchase_requests
         SET status = ${decision},
             reject_reason = ${decision === 'rejected' ? rejectReason : null},
             decided_by = ${decider.name},
             decided_at = now()
       WHERE id = ${id}`
    return null
  })
}
