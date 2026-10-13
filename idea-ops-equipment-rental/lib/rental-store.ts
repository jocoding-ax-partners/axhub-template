// 장비 · 대여 데이터 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import { db, ensureSchema } from './db'
import type { EquipmentInput, Filter } from './rental'

export type EquipmentRow = {
  id: string
  name: string
  kind: string
  asset_no: string
  /** 지금 대여 중이면 그 대여의 id, 아니면 null */
  rental_id: string | null
  borrower_key: string | null
  borrower_name: string | null
  borrower_email: string | null
  due_date: string | null
  rented_at: Date | null
}

export type MyRental = {
  id: string
  name: string
  kind: string
  asset_no: string
  due_date: string
  rented_at: Date
  returned_at: Date | null
  returned_by: string | null
}

export type Summary = { total: number; rented: number; overdue: number }

export type Result<T = null> = { ok: true; value: T } | { ok: false; error: string }

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean }

function toPage<T>(rows: T[]): Page<T> {
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE }
}

const likeOf = (q: string) => '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'

/** 쓰고 있는 장비 수 · 대여 중 · 반납 지연 (today = KST 오늘). */
export async function getSummary(today: string): Promise<Summary> {
  await ensureSchema()
  const [row] = await db()<Summary[]>`
    SELECT count(*)::int AS total,
           count(r.id)::int AS rented,
           count(*) FILTER (WHERE r.due_date < ${today})::int AS overdue
      FROM equipment e
      LEFT JOIN rentals r ON r.equipment_id = e.id AND r.returned_at IS NULL
     WHERE e.retired_at IS NULL`
  return row
}

/**
 * 장비 목록 + 지금 빌린 사람. q 가 있으면 이름 · 종류 · 자산 번호 · 빌린 사람에 그 글자가 들어간 것만.
 * ponytail: OFFSET 페이징 — 팀 장비 수백~수천 대 규모에선 충분해요. 수만 대가 되면 커서로 바꿔요.
 */
export async function listEquipment(
  q: string,
  filter: Filter,
  page: number,
  today: string,
): Promise<Page<EquipmentRow> & { total: number }> {
  await ensureSchema()
  const sql = db()
  const like = likeOf(q)
  const match = q
    ? sql`AND (e.name ILIKE ${like} OR e.kind ILIKE ${like} OR e.asset_no ILIKE ${like}
              OR r.user_name ILIKE ${like} OR r.user_email ILIKE ${like})`
    : sql``
  const only =
    filter === 'available'
      ? sql`AND r.id IS NULL`
      : filter === 'rented'
        ? sql`AND r.id IS NOT NULL`
        : filter === 'overdue'
          ? sql`AND r.due_date < ${today}`
          : sql``
  const [rows, [{ total }]] = await Promise.all([
    sql<EquipmentRow[]>`
      SELECT e.id::text, e.name, e.kind, e.asset_no,
             r.id::text AS rental_id, r.user_key AS borrower_key, r.user_name AS borrower_name,
             r.user_email AS borrower_email, r.due_date::text, r.rented_at
        FROM equipment e
        LEFT JOIN rentals r ON r.equipment_id = e.id AND r.returned_at IS NULL
       WHERE e.retired_at IS NULL ${only} ${match}
       ORDER BY lower(e.kind), lower(e.name), lower(e.asset_no), e.id
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    sql<{ total: number }[]>`
      SELECT count(*)::int AS total
        FROM equipment e
        LEFT JOIN rentals r ON r.equipment_id = e.id AND r.returned_at IS NULL
       WHERE e.retired_at IS NULL ${only} ${match}`,
  ])
  return { ...toPage(rows), total }
}

/** 내 대여 — 아직 반납하지 않은 것이 먼저, 그다음 최근에 빌린 순서. */
export async function listMyRentals(userKey: string, page: number): Promise<Page<MyRental>> {
  await ensureSchema()
  const rows = await db()<MyRental[]>`
    SELECT r.id::text, e.name, e.kind, e.asset_no, r.due_date::text, r.rented_at, r.returned_at, r.returned_by
      FROM rentals r
      JOIN equipment e ON e.id = r.equipment_id
     WHERE r.user_key = ${userKey}
     ORDER BY (r.returned_at IS NULL) DESC, r.rented_at DESC, r.id DESC
     LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`
  return toPage(rows)
}

type Person = { userKey: string; name: string; email: string }

/** 대여. 같은 장비를 동시에 눌러도 장비 줄을 잠가 한 명만 성공해요. 성공하면 장비 이름을 돌려줘요. */
export async function rentEquipment(equipmentId: string, who: Person, due: string): Promise<Result<string>> {
  await ensureSchema()
  return db().begin(async (sql): Promise<Result<string>> => {
    const [item] = await sql<{ name: string }[]>`
      SELECT name FROM equipment WHERE id = ${equipmentId} AND retired_at IS NULL FOR UPDATE`
    if (!item) return { ok: false, error: '없는 장비예요. 화면을 새로고침해 주세요.' }
    const busy = await sql`SELECT 1 FROM rentals WHERE equipment_id = ${equipmentId} AND returned_at IS NULL`
    if (busy.length > 0) return { ok: false, error: '방금 다른 사람이 빌린 장비예요. 화면을 새로고침해 주세요.' }
    await sql`
      INSERT INTO rentals (equipment_id, user_key, user_name, user_email, due_date)
      VALUES (${equipmentId}, ${who.userKey}, ${who.name}, ${who.email}, ${due})`
    return { ok: true, value: item.name }
  })
}

/** 반납. 빌린 본인 또는 관리자만. 성공하면 장비 이름을 돌려줘요. */
export async function returnRental(
  rentalId: string,
  actor: { userKey: string; name: string; isAdmin: boolean },
): Promise<Result<string>> {
  await ensureSchema()
  return db().begin(async (sql): Promise<Result<string>> => {
    const [row] = await sql<{ user_key: string; returned: boolean; name: string }[]>`
      SELECT r.user_key, r.returned_at IS NOT NULL AS returned, e.name
        FROM rentals r JOIN equipment e ON e.id = r.equipment_id
       WHERE r.id = ${rentalId}
         FOR UPDATE OF r`
    if (!row) return { ok: false, error: '없는 대여예요. 화면을 새로고침해 주세요.' }
    if (row.returned) return { ok: false, error: '이미 반납된 장비예요.' }
    if (row.user_key !== actor.userKey && !actor.isAdmin) return { ok: false, error: '빌린 사람이나 관리자만 반납할 수 있어요.' }
    await sql`UPDATE rentals SET returned_at = now(), returned_by = ${actor.name} WHERE id = ${rentalId}`
    return { ok: true, value: row.name }
  })
}

/** 장비 등록. 쓰고 있는 장비와 자산 번호가 겹치면(대소문자 무시) 문구를 돌려줘요. */
export async function addEquipment(input: EquipmentInput): Promise<Result> {
  await ensureSchema()
  try {
    await db()`INSERT INTO equipment (name, kind, asset_no) VALUES (${input.name}, ${input.kind}, ${input.assetNo})`
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return { ok: false, error: `자산 번호 ${input.assetNo} 는 이미 등록돼 있어요.` }
    throw e
  }
  return { ok: true, value: null }
}

/** 장비를 목록에서 빼요. 지난 대여 기록은 남겨요. 빌려 간 장비는 반납된 뒤에만 뺄 수 있어요. */
export async function retireEquipment(equipmentId: string): Promise<Result<string>> {
  await ensureSchema()
  return db().begin(async (sql): Promise<Result<string>> => {
    const [item] = await sql<{ name: string }[]>`
      SELECT name FROM equipment WHERE id = ${equipmentId} AND retired_at IS NULL FOR UPDATE`
    if (!item) return { ok: false, error: '이미 목록에서 빠진 장비예요. 화면을 새로고침해 주세요.' }
    const busy = await sql`SELECT 1 FROM rentals WHERE equipment_id = ${equipmentId} AND returned_at IS NULL`
    if (busy.length > 0) return { ok: false, error: '빌려 간 장비예요. 반납된 뒤에 뺄 수 있어요.' }
    await sql`UPDATE equipment SET retired_at = now() WHERE id = ${equipmentId}`
    return { ok: true, value: item.name }
  })
}
