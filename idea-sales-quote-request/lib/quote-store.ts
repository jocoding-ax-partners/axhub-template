// 견적 요청 데이터 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import { db, ensureSchema } from './db'
import type { QuoteRequest, QuoteStatus } from './quote'

export type Quote = {
  id: string
  company: string
  contact_name: string
  contact_phone: string
  item: string
  quantity: number
  due_date: string
  status: QuoteStatus
  assignee_key: string | null
  assignee_name: string | null
  created_by_key: string
  created_by_name: string
  created_at: Date
  updated_by_name: string | null
  updated_at: Date | null
}

export type Member = { user_key: string; name: string; email: string }

type Person = { userKey: string; name: string; email: string }

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean }

/**
 * 목록 조건.
 *   mine        — 이 사람이 담당자이거나 직접 등록한 요청만 (팀장이 아닌 사람의 "내 요청")
 *   status      — 상태 하나만 (null 이면 전체)
 *   q           — 회사명 · 고객 담당자 · 연락처 · 품목에 이 글자가 들어간 것
 *   unassigned  — 담당자가 아직 없는 것만
 */
export type QuoteFilter = { mine: string | null; status: QuoteStatus | null; q: string; unassigned: boolean }

function where(f: QuoteFilter, withStatus: boolean) {
  const sql = db()
  const like = '%' + f.q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
  return sql`
    WHERE true
    ${f.mine ? sql`AND (r.assignee_key = ${f.mine} OR r.created_by_key = ${f.mine})` : sql``}
    ${withStatus && f.status ? sql`AND r.status = ${f.status}` : sql``}
    ${f.unassigned ? sql`AND r.assignee_key IS NULL` : sql``}
    ${
      f.q
        ? sql`AND (r.company ILIKE ${like} OR r.contact_name ILIKE ${like} OR r.contact_phone ILIKE ${like} OR r.item ILIKE ${like})`
        : sql``
    }`
}

// ponytail: OFFSET 페이징 — 팀 단위 견적 요청 규모(수천 건)에선 충분해요. 수만 건이 되면 커서로 바꿔요.
export async function listQuotes(f: QuoteFilter, page: number): Promise<Page<Quote>> {
  await ensureSchema()
  const rows = await db()<Quote[]>`
    SELECT r.id::text, r.company, r.contact_name, r.contact_phone, r.item, r.quantity, r.due_date::text, r.status,
           r.assignee_key, m.name AS assignee_name, r.created_by_key, r.created_by_name, r.created_at,
           r.updated_by_name, r.updated_at
      FROM quote_requests r
      LEFT JOIN members m ON m.user_key = r.assignee_key
     ${where(f, true)}
     ORDER BY r.id DESC
     LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE }
}

/** 같은 조건(상태 빼고)에서 상태별 건수 — 상태 탭의 숫자예요. */
export async function countByStatus(f: QuoteFilter): Promise<Record<QuoteStatus, number>> {
  await ensureSchema()
  const rows = await db()<{ status: QuoteStatus; n: number }[]>`
    SELECT r.status, count(*)::int AS n FROM quote_requests r ${where(f, false)} GROUP BY r.status`
  const counts: Record<QuoteStatus, number> = { received: 0, quoted: 0, won: 0, lost: 0 }
  for (const r of rows) counts[r.status] = r.n
  return counts
}

/**
 * 앱에 들어온 사람을 담당자 후보로 적어 둬요. 이름·이메일이 바뀌었거나 하루가 지났을 때만 실제로 써요
 * (화면을 열 때마다 줄을 다시 쓰지 않게).
 */
export async function touchMember(who: Person): Promise<void> {
  await ensureSchema()
  await db()`
    INSERT INTO members (user_key, name, email) VALUES (${who.userKey}, ${who.name}, ${who.email})
    ON CONFLICT (user_key) DO UPDATE
       SET name = EXCLUDED.name, email = EXCLUDED.email, last_seen_at = now()
     WHERE members.name IS DISTINCT FROM EXCLUDED.name
        OR members.email IS DISTINCT FROM EXCLUDED.email
        OR members.last_seen_at < now() - interval '1 day'`
}

/** 담당자 후보 — 이 앱에 들어온 적 있는 사람. */
export async function listMembers(): Promise<Member[]> {
  await ensureSchema()
  // ponytail: 최대 500명 — 영업팀 규모에선 넉넉해요. 넘으면 검색형 선택(ComboBox)으로 바꿔요.
  return db()<Member[]>`SELECT user_key, name, email FROM members ORDER BY name, email LIMIT 500`
}

export async function createQuote(who: Person, req: QuoteRequest): Promise<void> {
  await ensureSchema()
  await db().begin(async (sql) => {
    // 등록한 사람도 담당자 후보가 돼요.
    await sql`
      INSERT INTO members (user_key, name, email) VALUES (${who.userKey}, ${who.name}, ${who.email})
      ON CONFLICT (user_key) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, last_seen_at = now()`
    await sql`
      INSERT INTO quote_requests (company, contact_name, contact_phone, item, quantity, due_date, created_by_key, created_by_name)
      VALUES (${req.company}, ${req.contactName}, ${req.contactPhone}, ${req.item}, ${req.quantity}, ${req.dueDate},
              ${who.userKey}, ${who.name})`
  })
}

/** 담당자 배정 · 상태 변경 (팀장). 문제가 있으면 사용자에게 보여 줄 문구를, 없으면 null 을 돌려줘요. */
export async function updateQuote(
  id: string,
  change: { assigneeKey: string | null; status: QuoteStatus },
  by: { name: string },
): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (sql) => {
    if (change.assigneeKey) {
      const [m] = await sql`SELECT 1 FROM members WHERE user_key = ${change.assigneeKey}`
      if (!m) return '담당자 목록에 없는 사람이에요. 화면을 새로고침해 주세요.'
    }
    const updated = await sql`
      UPDATE quote_requests
         SET assignee_key = ${change.assigneeKey}, status = ${change.status},
             updated_by_name = ${by.name}, updated_at = now()
       WHERE id = ${id}
         AND (assignee_key IS DISTINCT FROM ${change.assigneeKey} OR status <> ${change.status})
       RETURNING 1`
    if (updated.length > 0) return null
    const [exists] = await sql`SELECT 1 FROM quote_requests WHERE id = ${id}`
    return exists ? '바뀐 내용이 없어요.' : '없는 요청이에요. 화면을 새로고침해 주세요.'
  })
}
