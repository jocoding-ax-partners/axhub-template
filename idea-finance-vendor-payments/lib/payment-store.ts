// 지급 건 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import { db, ensureSchema } from './db'
import { weekRange, type PaymentFilter, type PaymentValue } from './payment'

export type PaymentRow = {
  id: string
  vendor: string
  amount: number
  due_date: string
  memo: string
  paid_date: string | null
  paid_by: string | null
  created_by_key: string
  created_by_name: string
  created_at: Date
}

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean }

function toPage<T>(rows: T[], size = PAGE_SIZE): Page<T> {
  return { rows: rows.slice(0, size), hasMore: rows.length > size }
}

// 목록에 쓰는 열. 금액(bigint)은 숫자로 받아요 — 한 건 상한(1,000억)이라 정밀도 문제가 없어요.
const columns = () => db()`
  id::text, vendor, amount::float8 AS amount, due_date::text, memo, paid_date::text, paid_by,
  created_by_key, created_by_name, created_at`

/** 검색어 → ILIKE 패턴. %·_ 는 글자 그대로 찾게 이스케이프해요. */
function likeOf(q: string): string {
  return '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
}

// ── 홈 ────────────────────────────────────────────────────────────────────

export type HomeSummary = {
  week_count: number
  week_total: number
  overdue_count: number
  overdue_total: number
  paid_count: number
  paid_total: number
}

/**
 * 홈 숫자 세 가지.
 *   이번 주 지급 예정 = 아직 안 낸 건 중 예정일이 오늘 ~ 이번 주 일요일
 *   지급 지연        = 아직 안 낸 건 중 예정일이 오늘보다 앞
 *   이번 주 지급 완료 = 지급일이 이번 주 월요일 ~ 일요일
 * 두 목록이 겹치지 않게 "예정" 은 오늘부터 세요 (월요일 예정 건을 수요일에 보면 "지연" 에 있어요).
 */
export async function getHomeSummary(today: string): Promise<HomeSummary> {
  await ensureSchema()
  const { monday, sunday } = weekRange(today)
  const [row] = await db()<HomeSummary[]>`
    SELECT count(*) FILTER (WHERE paid_date IS NULL AND due_date >= ${today})::int AS week_count,
           coalesce(sum(amount) FILTER (WHERE paid_date IS NULL AND due_date >= ${today}), 0)::float8 AS week_total,
           count(*) FILTER (WHERE paid_date IS NULL AND due_date < ${today})::int AS overdue_count,
           coalesce(sum(amount) FILTER (WHERE paid_date IS NULL AND due_date < ${today}), 0)::float8 AS overdue_total,
           count(*) FILTER (WHERE paid_date IS NOT NULL)::int AS paid_count,
           coalesce(sum(amount) FILTER (WHERE paid_date IS NOT NULL), 0)::float8 AS paid_total
      FROM vendor_payments
     WHERE (paid_date IS NULL AND due_date <= ${sunday})
        OR (paid_date BETWEEN ${monday} AND ${sunday})`
  return row
}

/** 홈 목록 한 칸에 보여 줄 최대 줄 수. 더 있으면 "지급 일정" 화면으로 안내해요. */
export const HOME_LIMIT = 20

/** 이번 주(오늘 ~ 일요일) 지급 예정 — 예정일 빠른 순. */
export async function listThisWeek(today: string): Promise<Page<PaymentRow>> {
  await ensureSchema()
  const { sunday } = weekRange(today)
  const rows = await db()<PaymentRow[]>`
    SELECT ${columns()} FROM vendor_payments
     WHERE paid_date IS NULL AND due_date BETWEEN ${today} AND ${sunday}
     ORDER BY due_date, vendor_payments.id
     LIMIT ${HOME_LIMIT + 1}`
  return toPage(rows, HOME_LIMIT)
}

/** 지급 지연 — 오래 밀린 순. */
export async function listOverdue(today: string): Promise<Page<PaymentRow>> {
  await ensureSchema()
  const rows = await db()<PaymentRow[]>`
    SELECT ${columns()} FROM vendor_payments
     WHERE paid_date IS NULL AND due_date < ${today}
     ORDER BY due_date, vendor_payments.id
     LIMIT ${HOME_LIMIT + 1}`
  return toPage(rows, HOME_LIMIT)
}

// ── 지급 일정 (전체 목록) ──────────────────────────────────────────────────

// ponytail: OFFSET 페이징 — 지급 건 수천 건 규모에선 충분해요. 수십만 건이 되면 커서로 바꿔요.
/** 거르기(미지급 · 지연 · 완료 · 전체) + 검색(거래처 · 메모) + 쪽. */
export async function listPayments(filter: PaymentFilter, q: string, page: number, today: string): Promise<Page<PaymentRow> & { total: number }> {
  await ensureSchema()
  const sql = db()
  const like = likeOf(q)
  const match = q ? sql`AND (vendor ILIKE ${like} OR memo ILIKE ${like})` : sql``
  const where = {
    unpaid: sql`paid_date IS NULL`,
    overdue: sql`paid_date IS NULL AND due_date < ${today}`,
    paid: sql`paid_date IS NOT NULL`,
    all: sql`true`,
  }[filter]
  // 미지급·지연은 급한 것(예정일 빠른 것)부터, 완료·전체는 최근 것부터.
  const order = {
    unpaid: sql`due_date, id`,
    overdue: sql`due_date, id`,
    paid: sql`paid_date DESC, id DESC`,
    all: sql`due_date DESC, id DESC`,
  }[filter]
  const [rows, [{ total }]] = await Promise.all([
    sql<PaymentRow[]>`
      SELECT ${columns()} FROM vendor_payments
       WHERE ${where} ${match}
       ORDER BY ${order}
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    sql<{ total: number }[]>`SELECT count(*)::int AS total FROM vendor_payments WHERE ${where} ${match}`,
  ])
  return { ...toPage(rows), total }
}

/** 등록 폼의 거래처 자동완성 — 최근에 쓴 거래처부터. */
export async function listVendorNames(): Promise<string[]> {
  await ensureSchema()
  const rows = await db()<{ vendor: string }[]>`
    SELECT vendor FROM vendor_payments GROUP BY vendor ORDER BY max(created_at) DESC LIMIT 200`
  return rows.map((r) => r.vendor)
}

// ── 거래처 ────────────────────────────────────────────────────────────────

export type VendorSummary = {
  vendor: string
  count: number
  unpaid_total: number
  unpaid_count: number
  overdue_count: number
  paid_total: number
  last_paid_date: string | null
  next_due_date: string | null
}

const vendorColumns = (today: string) => db()`
  count(*)::int AS count,
  coalesce(sum(amount) FILTER (WHERE paid_date IS NULL), 0)::float8 AS unpaid_total,
  count(*) FILTER (WHERE paid_date IS NULL)::int AS unpaid_count,
  count(*) FILTER (WHERE paid_date IS NULL AND due_date < ${today})::int AS overdue_count,
  coalesce(sum(amount) FILTER (WHERE paid_date IS NOT NULL), 0)::float8 AS paid_total,
  max(paid_date)::text AS last_paid_date,
  (min(due_date) FILTER (WHERE paid_date IS NULL))::text AS next_due_date`

/** 거래처별 합계 — 가나다 순. q 가 있으면 이름에 그 글자가 들어간 거래처만. */
export async function listVendors(q: string, page: number, today: string): Promise<Page<VendorSummary> & { total: number }> {
  await ensureSchema()
  const sql = db()
  const match = q ? sql`WHERE vendor ILIKE ${likeOf(q)}` : sql``
  const [rows, [{ total }]] = await Promise.all([
    sql<VendorSummary[]>`
      SELECT vendor, ${vendorColumns(today)}
        FROM vendor_payments ${match}
       GROUP BY vendor
       ORDER BY vendor
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    sql<{ total: number }[]>`SELECT count(DISTINCT vendor)::int AS total FROM vendor_payments ${match}`,
  ])
  return { ...toPage(rows), total }
}

/** 한 거래처의 합계. 지급 건이 하나도 없으면 null. */
export async function getVendor(vendor: string, today: string): Promise<VendorSummary | null> {
  await ensureSchema()
  const [row] = await db()<VendorSummary[]>`
    SELECT vendor, ${vendorColumns(today)} FROM vendor_payments WHERE vendor = ${vendor} GROUP BY vendor`
  return row ?? null
}

/** 한 거래처의 지급 이력 — 지급일(안 냈으면 예정일)이 늦은 순. */
export async function listVendorHistory(vendor: string, page: number): Promise<Page<PaymentRow>> {
  await ensureSchema()
  const rows = await db()<PaymentRow[]>`
    SELECT ${columns()} FROM vendor_payments
     WHERE vendor = ${vendor}
     ORDER BY coalesce(paid_date, due_date) DESC, vendor_payments.id DESC
     LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`
  return toPage(rows)
}

// ── 쓰기 ──────────────────────────────────────────────────────────────────
// 고치기·지우기·지급 처리는 문제가 있으면 사용자에게 보여 줄 문구를, 없으면 null 을 돌려줘요.

export type Actor = { userKey: string; name: string; manager: boolean }

export async function createPayment(who: Actor, v: PaymentValue): Promise<void> {
  await ensureSchema()
  await db()`
    INSERT INTO vendor_payments (vendor, amount, due_date, memo, created_by_key, created_by_name)
    VALUES (${v.vendor}, ${v.amount}, ${v.dueDate}, ${v.memo}, ${who.userKey}, ${who.name})`
}

/** 조건에 맞는 줄이 없어 바꾸지 못했을 때, 왜 못 바꿨는지 알려 줄 문구. */
async function whyNotEditable(id: string): Promise<string> {
  const [row] = await db()<{ paid: boolean }[]>`SELECT paid_date IS NOT NULL AS paid FROM vendor_payments WHERE id = ${id}`
  if (!row) return '없는 지급 건이에요. 화면을 새로고침해 주세요.'
  if (row.paid) return '이미 지급 완료된 건은 고치거나 지울 수 없어요. 관리자가 지급을 취소한 뒤 해 주세요.'
  return '내가 등록한 건만 고치거나 지울 수 있어요.'
}

// 등록한 사람 본인이거나 관리자일 때만 — 화면에서 버튼을 숨기는 것과 별개로 SQL 조건으로 막아요.
const editableBy = (who: Actor) => (who.manager ? db()`` : db()`AND created_by_key = ${who.userKey}`)

/** 아직 안 낸 건 고치기. */
export async function updatePayment(id: string, v: PaymentValue, who: Actor): Promise<string | null> {
  await ensureSchema()
  const done = await db()`
    UPDATE vendor_payments
       SET vendor = ${v.vendor}, amount = ${v.amount}, due_date = ${v.dueDate}, memo = ${v.memo}, updated_at = now()
     WHERE id = ${id} AND paid_date IS NULL ${editableBy(who)}
     RETURNING id`
  return done.length > 0 ? null : whyNotEditable(id)
}

/** 아직 안 낸 건 지우기. */
export async function deletePayment(id: string, who: Actor): Promise<string | null> {
  await ensureSchema()
  const done = await db()`
    DELETE FROM vendor_payments WHERE id = ${id} AND paid_date IS NULL ${editableBy(who)} RETURNING id`
  return done.length > 0 ? null : whyNotEditable(id)
}

/** 지급 완료로 바꾸기. 두 사람이 동시에 눌러도 한 번만 기록돼요 (paid_date IS NULL 조건). */
export async function markPaid(id: string, paidDate: string, who: Actor): Promise<string | null> {
  await ensureSchema()
  const done = await db()`
    UPDATE vendor_payments
       SET paid_date = ${paidDate}, paid_by = ${who.name}, paid_at = now(), updated_at = now()
     WHERE id = ${id} AND paid_date IS NULL
     RETURNING id`
  if (done.length > 0) return null
  const [row] = await db()`SELECT 1 FROM vendor_payments WHERE id = ${id}`
  return row ? '이미 지급 완료된 건이에요.' : '없는 지급 건이에요. 화면을 새로고침해 주세요.'
}

/** 지급 완료를 되돌려 다시 미지급으로. 잘못 눌렀을 때 써요. */
export async function cancelPaid(id: string): Promise<string | null> {
  await ensureSchema()
  const done = await db()`
    UPDATE vendor_payments
       SET paid_date = NULL, paid_by = NULL, paid_at = NULL, updated_at = now()
     WHERE id = ${id} AND paid_date IS NOT NULL
     RETURNING id`
  if (done.length > 0) return null
  const [row] = await db()`SELECT 1 FROM vendor_payments WHERE id = ${id}`
  return row ? '아직 지급하지 않은 건이에요.' : '없는 지급 건이에요. 화면을 새로고침해 주세요.'
}
