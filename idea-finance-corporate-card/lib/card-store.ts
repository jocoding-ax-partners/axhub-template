// 법인카드 사용 내역 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import { db, ensureSchema } from './db'
import { monthRange, type Expense } from './card'

export type ExpenseRow = {
  id: string
  user_key: string
  user_name: string
  user_email: string
  used_on: string
  merchant: string
  amount: number
  department: string
  purpose: string | null
}

export type DepartmentTotal = { department: string; count: number; total: number; missing: number }
export type MonthSummary = { departments: DepartmentTotal[]; count: number; total: number; missing: number }

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean }

function toPage<T>(rows: T[]): Page<T> {
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE }
}

/** 목록 조건. month 가 null 이면 달을 가리지 않아요 ("용도 미기재 모아 보기"). */
export type ListFilter = { month: string | null; q: string; missingOnly: boolean; page: number }

// 검색어가 있으면 가맹점 · 부서 · 용도 · 입력한 사람에 그 글자가 들어간 것만.
function where(f: ListFilter, userKey: string | null) {
  const sql = db()
  const like = '%' + f.q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
  const range = f.month ? monthRange(f.month) : null
  return sql`
    WHERE true
      ${userKey ? sql`AND user_key = ${userKey}` : sql``}
      ${range ? sql`AND used_on >= ${range.from} AND used_on < ${range.to}` : sql``}
      ${f.missingOnly ? sql`AND purpose IS NULL` : sql``}
      ${
        f.q
          ? sql`AND (merchant ILIKE ${like} OR department ILIKE ${like} OR purpose ILIKE ${like}
                     OR user_name ILIKE ${like} OR user_email ILIKE ${like})`
          : sql``
      }`
}

// ponytail: OFFSET 페이징 — 한 달 사용 건 규모에선 충분해요. 수만 건이 되면 (used_on, id) 커서로 바꿔요.
async function list(f: ListFilter, userKey: string | null): Promise<Page<ExpenseRow> & { total: number; sum: number }> {
  await ensureSchema()
  const sql = db()
  const [rows, [{ total, sum }]] = await Promise.all([
    sql<ExpenseRow[]>`
      SELECT id::text, user_key, user_name, user_email, used_on::text, merchant, amount::float8, department, purpose
        FROM card_expenses
        ${where(f, userKey)}
       ORDER BY used_on DESC, card_expenses.id DESC
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(f.page - 1) * PAGE_SIZE}`,
    sql<{ total: number; sum: number }[]>`
      SELECT count(*)::int AS total, coalesce(sum(amount), 0)::float8 AS sum FROM card_expenses ${where(f, userKey)}`,
  ])
  return { ...toPage(rows), total, sum }
}

/** 내가 입력한 사용 건. */
export function listMine(userKey: string, f: ListFilter) {
  return list(f, userKey)
}

/** 모든 사람의 사용 건 (관리자 화면). */
export function listAll(f: ListFilter) {
  return list(f, null)
}

/** 내가 입력했는데 용도를 아직 안 적은 건수 (달 상관없이). */
export async function countMyMissing(userKey: string): Promise<number> {
  await ensureSchema()
  const [{ n }] = await db()<{ n: number }[]>`
    SELECT count(*)::int AS n FROM card_expenses WHERE user_key = ${userKey} AND purpose IS NULL`
  return n
}

/** 입력 폼 도움말 — 지금까지 쓰인 부서 이름(자동완성)과 내가 마지막에 쓴 부서. */
export async function departmentHints(userKey: string): Promise<{ departments: string[]; mine: string }> {
  await ensureSchema()
  const sql = db()
  const [departments, last] = await Promise.all([
    sql<{ department: string }[]>`
      SELECT department FROM card_expenses GROUP BY department ORDER BY count(*) DESC, department LIMIT 50`,
    sql<{ department: string }[]>`
      SELECT department FROM card_expenses WHERE user_key = ${userKey} ORDER BY id DESC LIMIT 1`,
  ])
  return { departments: departments.map((r) => r.department), mine: last[0]?.department ?? '' }
}

/** 한 달의 부서별 합계와 전체 합계. 금액이 큰 부서부터. */
export async function monthSummary(month: string): Promise<MonthSummary> {
  await ensureSchema()
  const { from, to } = monthRange(month)
  const departments = await db()<DepartmentTotal[]>`
    SELECT department,
           count(*)::int AS count,
           sum(amount)::float8 AS total,
           count(*) FILTER (WHERE purpose IS NULL)::int AS missing
      FROM card_expenses
     WHERE used_on >= ${from} AND used_on < ${to}
     GROUP BY department
     ORDER BY total DESC, department`
  return {
    departments,
    count: departments.reduce((s, d) => s + d.count, 0),
    total: departments.reduce((s, d) => s + d.total, 0),
    missing: departments.reduce((s, d) => s + d.missing, 0),
  }
}

/** CSV 한 번에 내보낼 최대 줄 수. 넘는지 알려고 한 줄 더 읽어요 (EXPORT_MAX + 1). */
// ponytail: 한 달 최대 20,000건까지 — 그보다 많으면 부서별로 나눠 내려받게 바꿔요.
export const EXPORT_MAX = 20000

/** CSV 로 내려받을 한 달 전체 사용 건. EXPORT_MAX 보다 많으면 EXPORT_MAX + 1 줄을 돌려줘요. */
export async function exportMonth(month: string): Promise<ExpenseRow[]> {
  await ensureSchema()
  const { from, to } = monthRange(month)
  return db()<ExpenseRow[]>`
    SELECT id::text, user_key, user_name, user_email, used_on::text, merchant, amount::float8, department, purpose
      FROM card_expenses
     WHERE used_on >= ${from} AND used_on < ${to}
     ORDER BY used_on, card_expenses.id
     LIMIT ${EXPORT_MAX + 1}`
}

type Person = { userKey: string; name: string; email: string }

export async function createExpense(who: Person, e: Expense): Promise<void> {
  await ensureSchema()
  await db()`
    INSERT INTO card_expenses (user_key, user_name, user_email, used_on, merchant, amount, department, purpose)
    VALUES (${who.userKey}, ${who.name}, ${who.email}, ${e.usedOn}, ${e.merchant}, ${e.amount}, ${e.department}, ${e.purpose})`
}

const NOT_FOUND = '없는 사용 건이에요. 화면을 새로고침해 주세요.'

/** 용도 채우기 — 본인이 입력한 건만. 문제가 있으면 문구를, 없으면 null. */
export async function fillPurpose(userKey: string, id: string, purpose: string): Promise<string | null> {
  await ensureSchema()
  const sql = db()
  const done = await sql`
    UPDATE card_expenses SET purpose = ${purpose}, updated_at = now()
     WHERE id = ${id} AND user_key = ${userKey} AND purpose IS NULL
    RETURNING id`
  if (done.length > 0) return null
  const [row] = await sql<{ user_key: string }[]>`SELECT user_key FROM card_expenses WHERE id = ${id}`
  if (!row) return NOT_FOUND
  if (row.user_key !== userKey) return '용도는 입력한 사람만 채울 수 있어요.'
  return '이미 용도가 적혀 있어요.'
}

/** 사용 건 지우기 — 본인이 입력한 건만. 문제가 있으면 문구를, 없으면 null. */
export async function deleteExpense(userKey: string, id: string): Promise<string | null> {
  await ensureSchema()
  const sql = db()
  const done = await sql`DELETE FROM card_expenses WHERE id = ${id} AND user_key = ${userKey} RETURNING id`
  if (done.length > 0) return null
  const [row] = await sql`SELECT 1 FROM card_expenses WHERE id = ${id}`
  return row ? '본인이 입력한 건만 지울 수 있어요.' : NOT_FOUND
}
