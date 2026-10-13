// 택배·우편 데이터 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import { db, ensureSchema } from './db'
import { STALE_DAYS, normalizeEmail, type NewParcel, type ParcelKind } from './parcel'

export type Parcel = {
  id: string
  kind: ParcelKind
  recipient_email: string
  recipient_name: string
  sender: string
  location: string
  memo: string
  arrived_at: Date
  registered_by_name: string
  received_at: Date | null
  received_by_key: string | null
  received_by_name: string | null
}

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30
/** 내 미수령 택배는 한 화면에 이만큼까지 보여요 (한 사람에게 이보다 많이 쌓일 일은 드물어요). */
export const MY_WAITING_MAX = 100

export type Page<T> = { rows: T[]; hasMore: boolean }

function toPage<T>(rows: T[]): Page<T> {
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE }
}

/** 화면에 필요한 열 — SELECT 마다 같은 모양(Parcel)으로 읽어요. */
const columns = () => db()`
  id::text, kind, recipient_email, recipient_name, sender, location, memo, arrived_at,
  registered_by_name, received_at, received_by_key, received_by_name`

/** 검색어 → 받는 사람 이름·이메일 · 보낸 곳 · 보관 위치에 그 글자가 들어간 것만. 빈 검색어면 조건 없음. */
function matching(q: string) {
  if (!q) return db()``
  const like = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
  return db()`AND (recipient_name ILIKE ${like} OR recipient_email ILIKE ${like} OR sender ILIKE ${like} OR location ILIKE ${like})`
}

// ponytail: OFFSET 페이징 — 사무실 택배 규모(하루 수십 건)에선 충분해요. 수만 건이 쌓이면 커서로 바꿔요.

/** 나에게 온 미수령 택배 — 먼저 도착한 것부터. */
export async function listMyWaiting(email: string): Promise<Parcel[]> {
  await ensureSchema()
  return db()<Parcel[]>`
    SELECT ${columns()} FROM parcels
     WHERE recipient_email = ${normalizeEmail(email)} AND received_at IS NULL
     ORDER BY arrived_at, parcels.id
     LIMIT ${MY_WAITING_MAX}`
}

/** 내가 받은 택배 기록 — 최근에 받은 것부터. */
export async function listMyReceived(email: string, page: number): Promise<Page<Parcel>> {
  await ensureSchema()
  const rows = await db()<Parcel[]>`
    SELECT ${columns()} FROM parcels
     WHERE recipient_email = ${normalizeEmail(email)} AND received_at IS NOT NULL
     ORDER BY received_at DESC, parcels.id DESC
     LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`
  return toPage(rows)
}

/** 담당자용 미수령 목록 — 도착일 순(오래된 것부터). */
export async function listWaiting(q: string, page: number): Promise<Page<Parcel> & { total: number }> {
  await ensureSchema()
  const [rows, [{ total }]] = await Promise.all([
    db()<Parcel[]>`
      SELECT ${columns()} FROM parcels
       WHERE received_at IS NULL ${matching(q)}
       ORDER BY arrived_at, parcels.id
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    db()<{ total: number }[]>`SELECT count(*)::int AS total FROM parcels WHERE received_at IS NULL ${matching(q)}`,
  ])
  return { ...toPage(rows), total }
}

/** 담당자용 수령 완료 목록 — 최근에 받은 것부터. */
export async function listReceived(q: string, page: number): Promise<Page<Parcel> & { total: number }> {
  await ensureSchema()
  const [rows, [{ total }]] = await Promise.all([
    db()<Parcel[]>`
      SELECT ${columns()} FROM parcels
       WHERE received_at IS NOT NULL ${matching(q)}
       ORDER BY received_at DESC, parcels.id DESC
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    db()<{ total: number }[]>`SELECT count(*)::int AS total FROM parcels WHERE received_at IS NOT NULL ${matching(q)}`,
  ])
  return { ...toPage(rows), total }
}

export type DeskSummary = { waiting: number; stale: number; arrivedToday: number }

/** 담당자 화면 위 숫자 — 미수령 · 그중 오래된 것 · 오늘 들어온 것. 날짜는 한국 시간 기준이에요. */
export async function deskSummary(): Promise<DeskSummary> {
  await ensureSchema()
  const [row] = await db()<DeskSummary[]>`
    WITH t AS (SELECT (now() AT TIME ZONE 'Asia/Seoul')::date AS today)
    SELECT count(*) FILTER (WHERE received_at IS NULL)::int AS waiting,
           count(*) FILTER (WHERE received_at IS NULL
                              AND (arrived_at AT TIME ZONE 'Asia/Seoul')::date <= t.today - ${STALE_DAYS}::int)::int AS stale,
           count(*) FILTER (WHERE (arrived_at AT TIME ZONE 'Asia/Seoul')::date = t.today)::int AS "arrivedToday"
      FROM parcels, t
     WHERE received_at IS NULL OR arrived_at >= now() - interval '2 days'`
  return row
}

type Person = { userKey: string; name: string }

/** 택배 등록. 도착 시각은 등록한 지금이에요. */
export async function createParcel(by: Person, p: NewParcel): Promise<void> {
  await ensureSchema()
  await db()`
    INSERT INTO parcels (kind, recipient_email, recipient_name, sender, location, memo, registered_by_key, registered_by_name)
    VALUES (${p.kind}, ${p.recipientEmail}, ${p.recipientName}, ${p.sender}, ${p.location}, ${p.memo}, ${by.userKey}, ${by.name})`
}

/**
 * 수령 처리. 받는 사람 본인(이메일 일치)이거나 담당자(asDesk)일 때만, 아직 안 받은 것만 바꿔요.
 * 조건을 UPDATE 의 WHERE 에 같이 넣어서 두 사람이 동시에 눌러도 한 번만 처리돼요.
 * 문제가 있으면 사용자에게 보여 줄 문구를, 없으면 null 을 돌려줘요.
 */
export async function receiveParcel(id: string, by: Person & { email: string; asDesk: boolean }): Promise<string | null> {
  await ensureSchema()
  const email = normalizeEmail(by.email)
  const updated = await db()`
    UPDATE parcels
       SET received_at = now(), received_by_key = ${by.userKey}, received_by_name = ${by.name}
     WHERE id = ${id}
       AND received_at IS NULL
       AND (${by.asDesk} OR (${email} <> '' AND recipient_email = ${email}))
    RETURNING id`
  if (updated.length > 0) return null
  const [found] = await db()<{ received_at: Date | null; recipient_email: string }[]>`
    SELECT received_at, recipient_email FROM parcels WHERE id = ${id}`
  if (!found) return '없는 택배예요. 등록이 취소됐을 수 있어요. 화면을 새로고침해 주세요.'
  if (found.received_at) return '이미 수령 처리된 택배예요.'
  return '나에게 온 택배만 수령 처리할 수 있어요.'
}

/** 잘못 등록한 택배 지우기 (담당자). 이미 받은 택배는 기록으로 남겨야 해서 지우지 않아요. */
export async function cancelParcel(id: string): Promise<string | null> {
  await ensureSchema()
  const deleted = await db()`DELETE FROM parcels WHERE id = ${id} AND received_at IS NULL RETURNING id`
  if (deleted.length > 0) return null
  const [found] = await db()`SELECT 1 FROM parcels WHERE id = ${id}`
  return found ? '이미 수령 처리된 택배는 지울 수 없어요.' : '없는 택배예요. 화면을 새로고침해 주세요.'
}
