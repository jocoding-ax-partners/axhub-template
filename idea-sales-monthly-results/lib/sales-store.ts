// 계약 데이터 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import { db, ensureSchema } from './db'
import { TREND_MONTHS, canDelete, lastMonths, monthRange, shiftMonth, type Contract } from './sales'
import type { AxhubMe } from './axhub-server'

export type RepTotal = { user_key: string; user_name: string; user_email: string; count: number; amount: number }
export type MonthTotal = { month: string; count: number; amount: number; reps: number }

export type ContractRow = {
  id: string
  user_key: string
  user_name: string
  user_email: string
  contract_date: string
  customer: string
  amount: number
}

/** 고른 달의 담당자별 합계. 금액이 큰 순서예요. 이름은 그 달 가장 최근에 넣은 계약 때 값을 써요. */
export async function listRepTotals(month: string): Promise<RepTotal[]> {
  await ensureSchema()
  const { from, to } = monthRange(month)
  // ponytail: 담당자 수 상한 500 — 영업팀 규모에선 넘지 않아요. 넘으면 이 표도 쪽 나누기를 붙여요.
  return db()<RepTotal[]>`
    SELECT user_key,
           (array_agg(user_name ORDER BY id DESC))[1] AS user_name,
           (array_agg(user_email ORDER BY id DESC))[1] AS user_email,
           count(*)::int AS count,
           sum(amount)::float8 AS amount
      FROM contracts
     WHERE contract_date >= ${from} AND contract_date < ${to}
     GROUP BY user_key
     ORDER BY amount DESC, user_name
     LIMIT 500`
}

/** 고른 달까지 최근 TREND_MONTHS 개월의 팀 합계. 계약이 없는 달도 0 으로 채워요. */
export async function listMonthTotals(month: string): Promise<MonthTotal[]> {
  await ensureSchema()
  const months = lastMonths(month, TREND_MONTHS)
  const rows = await db()<MonthTotal[]>`
    SELECT to_char(contract_date, 'YYYY-MM') AS month, count(*)::int AS count, sum(amount)::float8 AS amount,
           count(DISTINCT user_key)::int AS reps
      FROM contracts
     WHERE contract_date >= ${`${months[0]}-01`} AND contract_date < ${`${shiftMonth(month, 1)}-01`}
     GROUP BY 1`
  return months.map((m) => rows.find((r) => r.month === m) ?? { month: m, count: 0, amount: 0, reps: 0 })
}

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean }

// ponytail: OFFSET 페이징 — 한 달 계약 수 규모에선 충분해요. 수만 건이 되면 커서로 바꿔요.
/** 고른 달의 계약 목록. q 가 있으면 고객사·담당자 이름·이메일에 그 글자가 들어간 것만. */
export async function listContracts(month: string, q: string, page: number): Promise<Page<ContractRow> & { total: number }> {
  await ensureSchema()
  const { from, to } = monthRange(month)
  const like = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
  const match = q ? db()`AND (customer ILIKE ${like} OR user_name ILIKE ${like} OR user_email ILIKE ${like})` : db()``
  const [rows, [{ total }]] = await Promise.all([
    db()<ContractRow[]>`
      SELECT id::text, user_key, user_name, user_email, contract_date::text, customer, amount::float8
        FROM contracts
       WHERE contract_date >= ${from} AND contract_date < ${to} ${match}
       ORDER BY contract_date DESC, contracts.id DESC
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    db()<{ total: number }[]>`
      SELECT count(*)::int AS total FROM contracts
       WHERE contract_date >= ${from} AND contract_date < ${to} ${match}`,
  ])
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE, total }
}

/** 계약 저장. 담당자는 저장한 사람이에요. */
export async function createContract(who: { userKey: string; name: string; email: string }, c: Contract): Promise<void> {
  await ensureSchema()
  await db()`
    INSERT INTO contracts (user_key, user_name, user_email, contract_date, customer, amount)
    VALUES (${who.userKey}, ${who.name}, ${who.email}, ${c.date}, ${c.customer}, ${c.amount})`
}

/** 계약 삭제. 넣은 본인이나 관리자만. 문제가 있으면 문구를, 없으면 null. */
export async function deleteContract(id: string, visitor: AxhubMe): Promise<string | null> {
  await ensureSchema()
  const [found] = await db()<{ user_key: string }[]>`SELECT user_key FROM contracts WHERE id = ${id}`
  if (!found) return '이미 지워진 계약이에요. 화면을 새로고침해 주세요.'
  // 화면에서 버튼을 숨기는 것과 별개로 서버에서 다시 막아요.
  if (!canDelete(visitor, found.user_key)) return '내가 넣은 계약만 지울 수 있어요.'
  await db()`DELETE FROM contracts WHERE id = ${id}`
  return null
}
