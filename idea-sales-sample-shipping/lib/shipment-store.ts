// 발송 기록 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
// "오늘" 은 늘 한국 시간이라 화면이 kstToday() 로 구해서 넘겨줘요 (DB 서버 시간대에 기대지 않아요).
import { db, ensureSchema } from './db'
import type { ShipmentValue } from './shipment'

export type Shipment = {
  id: string
  customer: string
  contact: string
  items: string
  sent_on: string
  follow_up_on: string | null
  memo: string
  done: boolean
  done_at: Date | null
  done_by: string | null
  created_by: string
  created_by_name: string
  created_at: Date
  updated_at: Date | null
}

const columns = () => db()`
  id::text, customer, contact, items, sent_on::text, follow_up_on::text, memo,
  done_at IS NOT NULL AS done, done_at, done_by, created_by, created_by_name, created_at, updated_at`

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean }

function toPage<T>(rows: T[]): Page<T> {
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE }
}

const offset = (page: number) => (page - 1) * PAGE_SIZE

/** ILIKE '%…%' 용 — 사용자가 친 % _ \ 를 글자 그대로 찾게 해요. */
const likeOf = (q: string) => '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'

/** mine 이 있으면 그 사람이 기록한 건만. */
const mineFilter = (mine: string | null) => (mine ? db()`AND created_by = ${mine}` : db()``)

export type Summary = { due: number; upcoming: number; sentThisMonth: number }

/** 홈 요약 숫자 — 연락할 때가 된 건 · 앞으로 연락할 건 · 이번 달 보낸 건. */
export async function getSummary(today: string, mine: string | null): Promise<Summary> {
  await ensureSchema()
  const [row] = await db()<Summary[]>`
    SELECT count(*) FILTER (WHERE done_at IS NULL AND follow_up_on <= ${today})::int AS due,
           count(*) FILTER (WHERE done_at IS NULL AND follow_up_on > ${today})::int AS upcoming,
           count(*) FILTER (WHERE sent_on >= date_trunc('month', ${today}::date))::int AS "sentThisMonth"
      FROM shipments
     WHERE true ${mineFilter(mine)}`
  return row
}

/** 후속 연락 예정일이 오늘이거나 지났고 아직 완료하지 않은 건 — 오래 밀린 것부터. */
// ponytail: OFFSET 페이징 — 팀 발송 기록 규모(수천 건)에선 충분해요. 수십만 건이 되면 커서로 바꿔요.
export async function listDue(today: string, mine: string | null, page: number): Promise<Page<Shipment>> {
  await ensureSchema()
  const rows = await db()<Shipment[]>`
    SELECT ${columns()} FROM shipments
     WHERE done_at IS NULL AND follow_up_on <= ${today} ${mineFilter(mine)}
     ORDER BY follow_up_on, shipments.id
     LIMIT ${PAGE_SIZE + 1} OFFSET ${offset(page)}`
  return toPage(rows)
}

/** 최근에 보낸 건 몇 개 (홈 아래쪽). */
export async function listRecent(mine: string | null, limit: number): Promise<Shipment[]> {
  await ensureSchema()
  return db()<Shipment[]>`
    SELECT ${columns()} FROM shipments
     WHERE true ${mineFilter(mine)}
     ORDER BY sent_on DESC, shipments.id DESC
     LIMIT ${limit}`
}

/** 전체 발송 기록. q 가 있으면 고객사 · 담당자 · 보낸 것 · 메모에 그 글자가 들어간 것만. */
export async function listShipments(q: string, mine: string | null, page: number): Promise<Page<Shipment> & { total: number }> {
  await ensureSchema()
  const like = likeOf(q)
  const match = q
    ? db()`AND (customer ILIKE ${like} OR contact ILIKE ${like} OR items ILIKE ${like} OR memo ILIKE ${like})`
    : db()``
  const [rows, [{ total }]] = await Promise.all([
    db()<Shipment[]>`
      SELECT ${columns()} FROM shipments
       WHERE true ${match} ${mineFilter(mine)}
       ORDER BY sent_on DESC, shipments.id DESC
       LIMIT ${PAGE_SIZE + 1} OFFSET ${offset(page)}`,
    db()<{ total: number }[]>`SELECT count(*)::int AS total FROM shipments WHERE true ${match} ${mineFilter(mine)}`,
  ])
  return { ...toPage(rows), total }
}

export type CustomerSummary = { name: string; count: number; first_sent: string; last_sent: string; open: number; due: number }

/**
 * 고객사 목록 — 이름(대소문자 무시)으로 묶어요. 보여 주는 이름은 가장 최근 발송 때 적은 그대로예요.
 * q 가 있으면 고객사 이름에 그 글자가 들어간 곳만.
 */
export async function listCustomers(q: string, today: string, page: number): Promise<Page<CustomerSummary> & { total: number }> {
  await ensureSchema()
  const match = q ? db()`WHERE customer ILIKE ${likeOf(q)}` : db()``
  const [rows, [{ total }]] = await Promise.all([
    db()<CustomerSummary[]>`
      SELECT (array_agg(customer ORDER BY sent_on DESC, id DESC))[1] AS name,
             count(*)::int AS count,
             min(sent_on)::text AS first_sent,
             max(sent_on)::text AS last_sent,
             count(*) FILTER (WHERE done_at IS NULL AND follow_up_on IS NOT NULL)::int AS open,
             count(*) FILTER (WHERE done_at IS NULL AND follow_up_on <= ${today})::int AS due
        FROM shipments ${match}
       GROUP BY lower(customer)
       ORDER BY max(sent_on) DESC, lower(customer)
       LIMIT ${PAGE_SIZE + 1} OFFSET ${offset(page)}`,
    db()<{ total: number }[]>`SELECT count(DISTINCT lower(customer))::int AS total FROM shipments ${match}`,
  ])
  return { ...toPage(rows), total }
}

/** 한 고객사의 발송 이력 — 최근 것부터. */
export async function listCustomerHistory(
  name: string,
  today: string,
  page: number,
): Promise<Page<Shipment> & { summary: CustomerSummary | null }> {
  await ensureSchema()
  const [rows, [summary]] = await Promise.all([
    db()<Shipment[]>`
      SELECT ${columns()} FROM shipments
       WHERE lower(customer) = lower(${name})
       ORDER BY sent_on DESC, shipments.id DESC
       LIMIT ${PAGE_SIZE + 1} OFFSET ${offset(page)}`,
    db()<CustomerSummary[]>`
      SELECT (array_agg(customer ORDER BY sent_on DESC, id DESC))[1] AS name,
             count(*)::int AS count,
             min(sent_on)::text AS first_sent,
             max(sent_on)::text AS last_sent,
             count(*) FILTER (WHERE done_at IS NULL AND follow_up_on IS NOT NULL)::int AS open,
             count(*) FILTER (WHERE done_at IS NULL AND follow_up_on <= ${today})::int AS due
        FROM shipments
       WHERE lower(customer) = lower(${name})
       GROUP BY lower(customer)`,
  ])
  return { ...toPage(rows), summary: summary ?? null }
}

/** 입력칸 자동완성용 — 최근에 보낸 고객사 이름. */
export async function listCustomerNames(limit = 200): Promise<string[]> {
  await ensureSchema()
  const rows = await db()<{ name: string }[]>`
    SELECT (array_agg(customer ORDER BY sent_on DESC, id DESC))[1] AS name
      FROM shipments
     GROUP BY lower(customer)
     ORDER BY max(sent_on) DESC
     LIMIT ${limit}`
  return rows.map((r) => r.name)
}

export async function getShipment(id: string): Promise<Shipment | null> {
  await ensureSchema()
  const [row] = await db()<Shipment[]>`SELECT ${columns()} FROM shipments WHERE id = ${id}`
  return row ?? null
}

type Actor = { userKey: string; name: string; isAdmin: boolean }

const NOT_FOUND = '없는 발송 기록이에요. 화면을 새로고침해 주세요.'
const NOT_ALLOWED = '기록한 사람이나 관리자만 바꿀 수 있어요.'

/** 이 사람이 바꿀 수 있는 건만 고르는 조건 (lib/shipment.ts 의 canManage 와 같은 규칙). */
const manageable = (who: Actor) => (who.isAdmin ? db()`` : db()`AND created_by = ${who.userKey}`)

/** 바꾸기에 실패했을 때 이유 — 없어서인지, 권한이 없어서인지. */
async function whyNot(id: string): Promise<string> {
  const [row] = await db()`SELECT 1 FROM shipments WHERE id = ${id}`
  return row ? NOT_ALLOWED : NOT_FOUND
}

export async function createShipment(who: Actor, v: ShipmentValue): Promise<string> {
  await ensureSchema()
  const [row] = await db()<{ id: string }[]>`
    INSERT INTO shipments (customer, contact, items, sent_on, follow_up_on, memo, created_by, created_by_name)
    VALUES (${v.customer}, ${v.contact}, ${v.items}, ${v.sentOn}, ${v.followUpOn}, ${v.memo}, ${who.userKey}, ${who.name})
    RETURNING id::text`
  return row.id
}

/**
 * 고치기. 후속 연락 예정일을 바꾸면 "연락 완료" 표시는 풀려요 — 새로 잡은 연락은 아직 안 한 거라서요.
 * 문제가 있으면 사용자에게 보여 줄 문구를, 없으면 null.
 */
export async function updateShipment(id: string, who: Actor, v: ShipmentValue): Promise<string | null> {
  await ensureSchema()
  // SET 안의 follow_up_on 은 바꾸기 전 값이에요 (Postgres 는 SET 의 오른쪽을 옛 줄로 계산해요).
  const updated = await db()`
    UPDATE shipments
       SET customer = ${v.customer}, contact = ${v.contact}, items = ${v.items}, sent_on = ${v.sentOn},
           memo = ${v.memo}, follow_up_on = ${v.followUpOn},
           done_at = CASE WHEN follow_up_on IS NOT DISTINCT FROM ${v.followUpOn}::date THEN done_at END,
           done_by = CASE WHEN follow_up_on IS NOT DISTINCT FROM ${v.followUpOn}::date THEN done_by END,
           updated_at = now()
     WHERE id = ${id} ${manageable(who)}
     RETURNING 1`
  return updated.length > 0 ? null : whyNot(id)
}

export async function deleteShipment(id: string, who: Actor): Promise<string | null> {
  await ensureSchema()
  const deleted = await db()`DELETE FROM shipments WHERE id = ${id} ${manageable(who)} RETURNING 1`
  return deleted.length > 0 ? null : whyNot(id)
}

/** 후속 연락 완료 표시 · 취소. 후속 연락 예정일이 있는 건만 돼요. */
export async function setFollowUpDone(id: string, done: boolean, who: Actor): Promise<string | null> {
  await ensureSchema()
  const [row] = await db()<{ follow_up_on: string | null; done: boolean }[]>`
    SELECT follow_up_on::text, done_at IS NOT NULL AS done FROM shipments WHERE id = ${id} ${manageable(who)}`
  if (!row) return whyNot(id)
  if (!row.follow_up_on) return '후속 연락 예정일이 없는 건이에요. 먼저 예정일을 잡아 주세요.'
  if (row.done === done) return done ? '이미 연락 완료로 표시했어요.' : '아직 완료로 표시하지 않은 건이에요.'
  const updated = await db()`
    UPDATE shipments
       SET done_at = ${done ? db()`now()` : null}, done_by = ${done ? who.name : null}
     WHERE id = ${id} AND (done_at IS NOT NULL) = ${!done}
     RETURNING id`
  return updated.length ? null : '다른 사람이 먼저 바꿨어요. 새로고침한 뒤 다시 해 주세요.'
}
