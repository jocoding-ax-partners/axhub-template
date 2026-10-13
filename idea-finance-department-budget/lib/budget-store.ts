// 예산 데이터 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import { db, ensureSchema } from './db'
import { WARN_RATE, type Expense } from './budget'

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean }

function toPage<T>(rows: T[]): Page<T> {
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE }
}

/** 검색어를 ILIKE 패턴으로 — %, _ 는 글자 그대로 찾아요. */
function likeOf(q: string): string {
  return '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
}

const offset = (page: number) => (page - 1) * PAGE_SIZE

// ── 현황 ──────────────────────────────────────────────────────────────────────

/** 부서 한 줄의 그해 숫자. budget 이 null 이면 그해 예산을 아직 등록하지 않은 부서예요. */
export type DeptStatus = { id: string; name: string; budget: number | null; spent: number }

export type Totals = { budget: number; spent: number; departments: number; warn: number }

/** 그해 부서별 예산·집행액. q 가 있으면 부서 이름에 그 글자가 들어간 것만. */
export async function listStatus(year: number, q: string, page: number): Promise<Page<DeptStatus>> {
  await ensureSchema()
  const match = q ? db()`WHERE d.name ILIKE ${likeOf(q)}` : db()``
  // ponytail: OFFSET 페이징 — 부서 수 규모(수백)에선 충분해요.
  const rows = await db()<DeptStatus[]>`
    SELECT d.id::text, d.name, b.amount::float8 AS budget, coalesce(s.spent, 0)::float8 AS spent
      FROM departments d
      LEFT JOIN budgets b ON b.department_id = d.id AND b.year = ${year}
      LEFT JOIN LATERAL (
        SELECT sum(e.amount) AS spent
          FROM expenses e
         WHERE e.department_id = d.id
           AND e.spent_on >= make_date(${year}, 1, 1) AND e.spent_on < make_date(${year} + 1, 1, 1)
      ) s ON true
      ${match}
     ORDER BY lower(d.name), d.id
     LIMIT ${PAGE_SIZE + 1} OFFSET ${offset(page)}`
  return toPage(rows)
}

/** 그해 전체 합계 — 검색·쪽과 상관없이 모든 부서를 더해요. */
export async function getTotals(year: number): Promise<Totals> {
  await ensureSchema()
  const [row] = await db()<Totals[]>`
    WITH per AS (
      SELECT b.amount AS budget,
             (SELECT coalesce(sum(e.amount), 0)
                FROM expenses e
               WHERE e.department_id = b.department_id
                 AND e.spent_on >= make_date(${year}, 1, 1) AND e.spent_on < make_date(${year} + 1, 1, 1)) AS spent
        FROM budgets b
       WHERE b.year = ${year}
    )
    SELECT coalesce(sum(budget), 0)::float8 AS budget,
           coalesce(sum(spent), 0)::float8 AS spent,
           count(*)::int AS departments,
           count(*) FILTER (WHERE (budget = 0 AND spent > 0) OR (budget > 0 AND spent * 100 >= budget * ${WARN_RATE}))::int AS warn
      FROM per`
  return row
}

// ── 집행 건 ───────────────────────────────────────────────────────────────────

export type Department = { id: string; name: string }

/** 집행 건을 넣을 수 있는 부서 — 관리자는 전부, 그 밖에는 담당자로 지정된 부서만. */
// ponytail: 부서 500개 상한, 넘으면 검색형 선택으로
export async function listEntryDepartments(email: string, admin: boolean): Promise<Department[]> {
  await ensureSchema()
  if (admin) {
    return db()<Department[]>`SELECT id::text, name FROM departments ORDER BY lower(name), departments.id LIMIT 500`
  }
  if (!email) return []
  return db()<Department[]>`
    SELECT d.id::text, d.name
      FROM departments d JOIN department_managers m ON m.department_id = d.id
     WHERE m.email = ${email}
     ORDER BY lower(d.name), d.id
     LIMIT 500`
}

export type ExpenseRow = {
  id: string
  department: string
  spent_on: string
  description: string
  amount: number
  user_key: string
  user_name: string
  created_at: Date
}

/** 그해 집행 건 (최근 집행일 순). q 는 내용·부서·입력자 이름에서 찾아요. */
export async function listExpenses(year: number, q: string, page: number): Promise<Page<ExpenseRow>> {
  await ensureSchema()
  const like = likeOf(q)
  const match = q ? db()`AND (e.description ILIKE ${like} OR d.name ILIKE ${like} OR e.user_name ILIKE ${like})` : db()``
  const rows = await db()<ExpenseRow[]>`
    SELECT e.id::text, d.name AS department, e.spent_on::text, e.description, e.amount::float8 AS amount,
           e.user_key, e.user_name, e.created_at
      FROM expenses e JOIN departments d ON d.id = e.department_id
     WHERE e.spent_on >= make_date(${year}, 1, 1) AND e.spent_on < make_date(${year} + 1, 1, 1) ${match}
     ORDER BY e.spent_on DESC, e.id DESC
     LIMIT ${PAGE_SIZE + 1} OFFSET ${offset(page)}`
  return toPage(rows)
}

type Actor = { userKey: string; name: string; email: string; admin: boolean }

/** 집행 건 입력. 문제가 있으면 사용자에게 보여 줄 문구를, 없으면 null 을 돌려줘요. */
export async function createExpense(who: Actor, departmentId: string, e: Expense): Promise<string | null> {
  await ensureSchema()
  // 권한(관리자 또는 그 부서 담당자)과 그해 예산 등록 여부를 INSERT 와 같은 문장에서 확인해요.
  const [found] = await db()<{ allowed: boolean; has_budget: boolean }[]>`
    SELECT (${who.admin} OR EXISTS (
              SELECT 1 FROM department_managers m WHERE m.department_id = d.id AND m.email = ${who.email}
            )) AS allowed,
           EXISTS (SELECT 1 FROM budgets b WHERE b.department_id = d.id AND b.year = ${e.year}) AS has_budget
      FROM departments d WHERE d.id = ${departmentId}`
  if (!found) return '없는 부서예요. 화면을 새로고침해 주세요.'
  if (!found.allowed) return '이 부서의 담당자만 집행 건을 넣을 수 있어요.'
  if (!found.has_budget) return `이 부서의 ${e.year}년 예산이 아직 등록되지 않았어요. 관리자에게 먼저 등록해 달라고 해 주세요.`
  await db()`
    INSERT INTO expenses (department_id, spent_on, description, amount, user_key, user_name)
    VALUES (${departmentId}, ${e.spentOn}, ${e.description}, ${e.amount}, ${who.userKey}, ${who.name})`
  return null
}

/** 집행 건 삭제 — 입력한 본인이나 관리자만. */
export async function deleteExpense(who: Actor, id: string): Promise<string | null> {
  await ensureSchema()
  const [row] = await db()<{ user_key: string }[]>`SELECT user_key FROM expenses WHERE id = ${id}`
  if (!row) return '이미 지워진 집행 건이에요. 화면을 새로고침해 주세요.'
  if (!who.admin && row.user_key !== who.userKey) return '본인이 넣은 집행 건만 지울 수 있어요.'
  await db()`DELETE FROM expenses WHERE id = ${id}`
  return null
}

// ── 관리자: 부서 · 예산 · 담당자 ───────────────────────────────────────────────

export type AdminDept = DeptStatus & { managers: string[] }

export async function listAdminDepartments(year: number, q: string, page: number): Promise<Page<AdminDept>> {
  const status = await listStatus(year, q, page)
  if (status.rows.length === 0) return { rows: [], hasMore: status.hasMore }
  const ids = status.rows.map((r) => r.id)
  const managers = await db()<{ department_id: string; email: string }[]>`
    SELECT department_id::text, email FROM department_managers
     WHERE department_id = ANY(${ids}::bigint[])
     ORDER BY email`
  return {
    hasMore: status.hasMore,
    rows: status.rows.map((r) => ({ ...r, managers: managers.filter((m) => m.department_id === r.id).map((m) => m.email) })),
  }
}

const UNIQUE_VIOLATION = '23505'
const FK_VIOLATION = '23503'
const codeOf = (e: unknown) => (e as { code?: string }).code

export async function createDepartment(name: string): Promise<string | null> {
  await ensureSchema()
  try {
    await db()`INSERT INTO departments (name) VALUES (${name})`
  } catch (e) {
    if (codeOf(e) === UNIQUE_VIOLATION) return `'${name}' 부서가 이미 있어요.`
    throw e
  }
  return null
}

export async function deleteDepartment(id: string): Promise<string | null> {
  await ensureSchema()
  try {
    const rows = await db()`DELETE FROM departments WHERE id = ${id} RETURNING id`
    if (rows.length === 0) return '이미 지워진 부서예요. 화면을 새로고침해 주세요.'
  } catch (e) {
    if (codeOf(e) === FK_VIOLATION) return '집행 건이 남아 있는 부서는 지울 수 없어요. 집행 내역에서 먼저 지워 주세요.'
    throw e
  }
  return null
}

/** 그해 예산 저장 — 이미 있으면 금액을 고쳐요. */
export async function saveBudget(departmentId: string, year: number, amount: number, by: string): Promise<string | null> {
  await ensureSchema()
  try {
    await db()`
      INSERT INTO budgets (department_id, year, amount, updated_by)
      VALUES (${departmentId}, ${year}, ${amount}, ${by})
      ON CONFLICT (department_id, year) DO UPDATE
        SET amount = EXCLUDED.amount, updated_by = EXCLUDED.updated_by, updated_at = now()`
  } catch (e) {
    if (codeOf(e) === FK_VIOLATION) return '없는 부서예요. 화면을 새로고침해 주세요.'
    throw e
  }
  return null
}

export async function addManager(departmentId: string, email: string): Promise<string | null> {
  await ensureSchema()
  try {
    const rows = await db()`
      INSERT INTO department_managers (department_id, email) VALUES (${departmentId}, ${email})
      ON CONFLICT DO NOTHING RETURNING email`
    if (rows.length === 0) return `${email} 은 이미 이 부서 담당자예요.`
  } catch (e) {
    if (codeOf(e) === FK_VIOLATION) return '없는 부서예요. 화면을 새로고침해 주세요.'
    throw e
  }
  return null
}

export async function removeManager(departmentId: string, email: string): Promise<void> {
  await ensureSchema()
  await db()`DELETE FROM department_managers WHERE department_id = ${departmentId} AND email = ${email}`
}
