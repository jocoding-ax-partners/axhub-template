// 휴가 데이터 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import type postgres from 'postgres'
import { db, ensureSchema } from './db'
import { ANNUAL_QUOTA, usesAnnual, type LeaveKind, type LeaveRequest, type LeaveStatus } from './leave'

type Sql = postgres.Sql | postgres.TransactionSql

export type MyLeave = {
  id: string
  kind: LeaveKind
  start_date: string
  end_date: string
  days: number
  reason: string
  status: LeaveStatus
  reject_reason: string | null
  decided_by: string | null
  decided_at: Date | null
  created_at: Date
}

export type PendingLeave = {
  id: string
  user_key: string
  user_name: string
  user_email: string
  kind: LeaveKind
  start_date: string
  end_date: string
  days: number
  reason: string
  created_at: Date
  /** 신청한 해에 이미 승인된 연차(반차 포함) */
  used: number
}

export type AnnualUsage = { used: number; pending: number }

export type EmployeeUsage = { user_key: string; user_name: string; user_email: string; used: number; pending: number; sick: number }

/** 한 사람의 그해 연차(반차 포함) 사용량 — 승인된 것과 대기 중인 것. */
async function annualUsage(sql: Sql, userKey: string, year: number): Promise<AnnualUsage> {
  const [row] = await sql<AnnualUsage[]>`
    SELECT coalesce(sum(days) FILTER (WHERE status = 'approved'), 0)::float8 AS used,
           coalesce(sum(days) FILTER (WHERE status = 'pending'), 0)::float8 AS pending
      FROM leave_requests
     WHERE user_key = ${userKey}
       AND kind IN ('annual', 'half')
       AND extract(year FROM start_date) = ${year}`
  return row
}

// 같은 사람의 신청·승인이 동시에 들어와도 남은 연차 계산이 엇갈리지 않게 사람 단위로 줄을 세워요.
async function lockUser(sql: postgres.TransactionSql, userKey: string) {
  await sql`SELECT pg_advisory_xact_lock(hashtext(${'leave:' + userKey}))`
}

export async function getAnnualUsage(userKey: string, year: number): Promise<AnnualUsage> {
  await ensureSchema()
  return annualUsage(db(), userKey, year)
}

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean }

function toPage<T>(rows: T[]): Page<T> {
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE }
}

// ponytail: OFFSET 페이징 — 한 사람의 신청 수·대기 건수 규모에선 충분해요. 수만 건이 되면 커서로 바꿔요.
export async function listMyLeaves(userKey: string, page: number): Promise<Page<MyLeave>> {
  await ensureSchema()
  const rows = await db()<MyLeave[]>`
    SELECT id::text, kind, start_date::text, end_date::text, days::float8, reason, status,
           reject_reason, decided_by, decided_at, created_at
      FROM leave_requests
     WHERE user_key = ${userKey}
     ORDER BY start_date DESC, leave_requests.id DESC
     LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`
  return toPage(rows)
}

/** 대기 중인 신청. q 가 있으면 신청자 이름·이메일에 그 글자가 들어간 것만. */
export async function listPending(q: string, page: number): Promise<Page<PendingLeave> & { total: number }> {
  await ensureSchema()
  const like = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
  const match = q ? db()`AND (r.user_name ILIKE ${like} OR r.user_email ILIKE ${like})` : db()``
  const [rows, [{ total }]] = await Promise.all([
    db()<PendingLeave[]>`
      SELECT r.id::text, r.user_key, r.user_name, r.user_email, r.kind, r.start_date::text, r.end_date::text,
             r.days::float8, r.reason, r.created_at,
             (SELECT coalesce(sum(a.days), 0)
                FROM leave_requests a
               WHERE a.user_key = r.user_key
                 AND a.status = 'approved'
                 AND a.kind IN ('annual', 'half')
                 AND extract(year FROM a.start_date) = extract(year FROM r.start_date))::float8 AS used
        FROM leave_requests r
       WHERE r.status = 'pending' ${match}
       ORDER BY r.created_at, r.id
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    db()<{ total: number }[]>`SELECT count(*)::int AS total FROM leave_requests r WHERE r.status = 'pending' ${match}`,
  ])
  return { ...toPage(rows), total }
}

/** 그해 신청 기록이 있는 직원별 연차 현황. 이름은 가장 최근 신청 때 값을 써요. */
export async function listEmployeeUsage(year: number): Promise<EmployeeUsage[]> {
  await ensureSchema()
  return db()<EmployeeUsage[]>`
    SELECT user_key,
           (array_agg(user_name ORDER BY id DESC))[1] AS user_name,
           (array_agg(user_email ORDER BY id DESC))[1] AS user_email,
           coalesce(sum(days) FILTER (WHERE status = 'approved' AND kind IN ('annual', 'half')), 0)::float8 AS used,
           coalesce(sum(days) FILTER (WHERE status = 'pending' AND kind IN ('annual', 'half')), 0)::float8 AS pending,
           coalesce(sum(days) FILTER (WHERE status = 'approved' AND kind = 'sick'), 0)::float8 AS sick
      FROM leave_requests
     WHERE extract(year FROM start_date) = ${year}
     GROUP BY user_key
     ORDER BY 2
     LIMIT 500`
}

type Applicant = { userKey: string; name: string; email: string }

/** 휴가 신청. 문제가 있으면 사용자에게 보여 줄 문구를, 없으면 null 을 돌려줘요. */
export async function createLeave(who: Applicant, req: LeaveRequest): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (sql) => {
    await lockUser(sql, who.userKey)

    const overlap = await sql`
      SELECT 1 FROM leave_requests
       WHERE user_key = ${who.userKey}
         AND status IN ('pending', 'approved')
         AND start_date <= ${req.end} AND end_date >= ${req.start}
       LIMIT 1`
    if (overlap.length > 0) return '이미 신청한 휴가와 날짜가 겹쳐요.'

    if (usesAnnual(req.kind)) {
      // 대기 중인 신청까지 합쳐서 봐요 — 다 승인돼도 연차가 모자라지 않게.
      const { used, pending } = await annualUsage(sql, who.userKey, req.year)
      const left = ANNUAL_QUOTA - used - pending
      if (req.days > left) return `${req.year}년 남은 연차(대기 중 신청 포함)는 ${left}일이에요. 기간을 줄여 주세요.`
    }

    await sql`
      INSERT INTO leave_requests (user_key, user_name, user_email, kind, start_date, end_date, days, reason)
      VALUES (${who.userKey}, ${who.name}, ${who.email}, ${req.kind}, ${req.start}, ${req.end}, ${req.days}, ${req.reason})`
    return null
  })
}

export const SELF_DECISION = '본인 신청은 다른 관리자가 처리해야 해요.'

/** 승인·반려. 대기 중인 신청만 바꿀 수 있어요. 문제가 있으면 문구를, 없으면 null. */
export async function decideLeave(
  id: string,
  decision: 'approved' | 'rejected',
  rejectReason: string | null,
  decider: { userKey: string; name: string },
): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (sql) => {
    const [found] = await sql<{ user_key: string }[]>`SELECT user_key FROM leave_requests WHERE id = ${id}`
    if (!found) return '없는 신청이에요. 화면을 새로고침해 주세요.'
    // 자기 휴가를 스스로 승인하지 못하게 — 화면에서 버튼을 숨기는 것과 별개로 서버에서 막아요.
    if (found.user_key === decider.userKey) return SELF_DECISION
    await lockUser(sql, found.user_key)

    const [row] = await sql<{ kind: LeaveKind; days: number; year: number; status: LeaveStatus }[]>`
      SELECT kind, days::float8, extract(year FROM start_date)::int AS year, status
        FROM leave_requests WHERE id = ${id} FOR UPDATE`
    if (row.status !== 'pending') return '이미 처리된 신청이에요.'

    if (decision === 'approved' && usesAnnual(row.kind)) {
      const { used } = await annualUsage(sql, found.user_key, row.year)
      if (used + row.days > ANNUAL_QUOTA) return `승인하면 ${row.year}년 연차가 ${ANNUAL_QUOTA}일을 넘어요. 반려해 주세요.`
    }

    await sql`
      UPDATE leave_requests
         SET status = ${decision},
             reject_reason = ${decision === 'rejected' ? rejectReason : null},
             decided_by = ${decider.name},
             decided_at = now()
       WHERE id = ${id}`
    return null
  })
}
