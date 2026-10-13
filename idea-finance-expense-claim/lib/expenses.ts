// 경비 데이터 읽기 + 권한 판단 (서버 전용). 쓰기는 app/actions.ts 에 있어요.
import type { AxhubMe } from '@/lib/axhub-server'
import { db, ensureSchema } from '@/lib/db'
import type { ExpenseStatus } from '@/lib/expense-utils'

// 관리자 = axhub 가 알려 주는 관리자 플래그(is_admin).
// 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자면 true 예요. 일반 멤버는 직원으로 써요.
export function isAppAdmin(v: AxhubMe): boolean {
  return v.authenticated && v.is_admin
}

export type Expense = {
  id: string
  user_id: string
  user_name: string
  user_email: string
  spent_on: string
  category: string
  amount: number
  memo: string
  has_receipt: boolean
  status: ExpenseStatus
  reviewer_name: string
  reviewed_at: string | null // 마지막 승인·반려 시각 (ISO). 대기면 null
}

const COLS = (sql: ReturnType<typeof db>) => sql`
  id::text, user_id, user_name, user_email, spent_on::text, category, amount::int AS amount, memo,
  receipt_key IS NOT NULL AS has_receipt, status, reviewer_name, to_char(reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS reviewed_at`

// 내 경비 (최근 200건).
export async function listMyExpenses(userId: string): Promise<Expense[]> {
  await ensureSchema()
  const sql = db()
  return sql<Expense[]>`
    SELECT ${COLS(sql)}
    FROM expenses WHERE user_id = ${userId}
    ORDER BY spent_on DESC, expenses.id DESC LIMIT 200`
}

// 한 달 동안 사용한 모든 직원의 경비 (관리자 화면) — 한 쪽에 PAGE_SIZE 건씩. range = [그 달 1일, 다음 달 1일)
// page 는 1부터. hasNext 는 한 건 더 읽어 봐서 판단해요.
export const PAGE_SIZE = 30
export async function listMonthExpenses(
  [from, to]: [string, string],
  page: number,
): Promise<{ rows: Expense[]; hasNext: boolean }> {
  await ensureSchema()
  const sql = db()
  const rows = await sql<Expense[]>`
    SELECT ${COLS(sql)}
    FROM expenses WHERE spent_on >= ${from} AND spent_on < ${to}
    ORDER BY user_name, user_id, spent_on, expenses.id
    LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`
  return { rows: rows.slice(0, PAGE_SIZE), hasNext: rows.length > PAGE_SIZE }
}

// 그 달 전체 건수 · 대기 건수 (쪽 나눔과 상관없이 화면 위쪽 안내에 써요).
export async function monthCounts([from, to]: [string, string]): Promise<{ total: number; pending: number }> {
  await ensureSchema()
  const [r] = await db()<{ total: string; pending: string }[]>`
    SELECT count(*)::text AS total, count(*) FILTER (WHERE status = 'pending')::text AS pending
    FROM expenses WHERE spent_on >= ${from} AND spent_on < ${to}`
  return { total: Number(r.total), pending: Number(r.pending) }
}

// 월별 정산표 — 직원별 승인 금액 합계. count/sum 은 bigint 라 text 로 받아 Number 로 바꿔요.
export type SettlementRow = { user_id: string; user_name: string; user_email: string; count: number; total: number }
export async function settlement([from, to]: [string, string]): Promise<SettlementRow[]> {
  await ensureSchema()
  const rows = await db()<{ user_id: string; user_name: string; user_email: string; count: string; total: string }[]>`
    SELECT user_id, max(user_name) AS user_name, max(user_email) AS user_email,
           count(*)::text AS count, sum(amount)::text AS total
    FROM expenses
    WHERE status = 'approved' AND spent_on >= ${from} AND spent_on < ${to}
    GROUP BY user_id ORDER BY sum(amount) DESC, max(user_name)`
  return rows.map((r) => ({ ...r, count: Number(r.count), total: Number(r.total) }))
}

// 화면에 보일 직원 이름. 이름이 비어 있으면 이메일로.
export function personLabel(e: { user_name: string; user_email: string }): string {
  return e.user_name || e.user_email || '이름 없음'
}
