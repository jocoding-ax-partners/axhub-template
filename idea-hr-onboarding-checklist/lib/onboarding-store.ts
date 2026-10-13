// 온보딩 데이터 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import { db, ensureSchema } from './db'
import { TEMPLATE_MAX, type Hire } from './onboarding'

export type HireRow = {
  id: string
  name: string
  department: string
  start_date: string
  total: number
  done: number
}

export type HireDetail = {
  id: string
  name: string
  department: string
  start_date: string
  created_by_name: string
  created_at: Date
}

export type HireItem = {
  id: string
  title: string
  done: boolean
  memo: string
  updated_by: string | null
  updated_at: Date | null
}

export type Template = { id: string; title: string }

export type Summary = { total: number; inProgress: number; completed: number }

type Actor = { userKey: string; name: string }

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean; total: number }

const likeOf = (q: string) => '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'

/**
 * 입사자 목록 — 입사일이 늦은 순서. q 가 있으면 이름·부서에 그 글자가 들어간 사람만.
 * ponytail: OFFSET 페이징 — 입사자 수천 명 규모까진 충분해요. 수만 명이 되면 커서로 바꿔요.
 */
export async function listHires(q: string, page: number): Promise<Page<HireRow>> {
  await ensureSchema()
  const like = likeOf(q)
  const match = q ? db()`WHERE h.name ILIKE ${like} OR h.department ILIKE ${like}` : db()``
  const [rows, [{ total }]] = await Promise.all([
    db()<HireRow[]>`
      SELECT h.id::text, h.name, h.department, h.start_date::text,
             (SELECT count(*) FROM hire_items i WHERE i.hire_id = h.id)::int AS total,
             (SELECT count(*) FROM hire_items i WHERE i.hire_id = h.id AND i.done)::int AS done
        FROM hires h
        ${match}
       ORDER BY h.start_date DESC, h.id DESC
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    db()<{ total: number }[]>`SELECT count(*)::int AS total FROM hires h ${match}`,
  ])
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE, total }
}

/** 전체 입사자 수 · 진행 중(아직 남은 항목이 있음) · 모두 완료. */
export async function getSummary(): Promise<Summary> {
  await ensureSchema()
  const [row] = await db()<Summary[]>`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE s.total = 0 OR s.done < s.total)::int AS "inProgress",
           count(*) FILTER (WHERE s.total > 0 AND s.done = s.total)::int AS completed
      FROM (SELECT h.id,
                   (SELECT count(*) FROM hire_items i WHERE i.hire_id = h.id) AS total,
                   (SELECT count(*) FROM hire_items i WHERE i.hire_id = h.id AND i.done) AS done
              FROM hires h) s`
  return row
}

export async function getHire(id: string): Promise<{ hire: HireDetail; items: HireItem[] } | null> {
  await ensureSchema()
  const [hire] = await db()<HireDetail[]>`
    SELECT id::text, name, department, start_date::text, created_by_name, created_at FROM hires WHERE id = ${id}`
  if (!hire) return null
  const items = await db()<HireItem[]>`
    SELECT id::text, title, done, memo, updated_by, updated_at
      FROM hire_items WHERE hire_id = ${id}
     ORDER BY position, hire_items.id`
  return { hire, items }
}

/** 입사자 등록 + 지금의 기본 체크리스트 복사를 한 트랜잭션으로 — 중간에 실패하면 둘 다 취소돼요. */
export async function createHire(who: Actor, h: Hire): Promise<string> {
  await ensureSchema()
  return db().begin(async (sql) => {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO hires (name, department, start_date, created_by_key, created_by_name)
      VALUES (${h.name}, ${h.department}, ${h.startDate}, ${who.userKey}, ${who.name})
      RETURNING id::text`
    await sql`
      INSERT INTO hire_items (hire_id, position, title)
      SELECT ${row.id}, row_number() OVER (ORDER BY id), title FROM checklist_templates`
    return row.id
  })
}

/** 입사자 정보 고치기. 없는 입사자면 false. */
export async function updateHire(id: string, h: Hire): Promise<boolean> {
  await ensureSchema()
  const rows = await db()`
    UPDATE hires SET name = ${h.name}, department = ${h.department}, start_date = ${h.startDate}
     WHERE id = ${id} RETURNING 1`
  return rows.length > 0
}

/** 입사자 삭제 — 체크리스트 항목도 같이 지워져요 (ON DELETE CASCADE). */
export async function deleteHire(id: string): Promise<boolean> {
  await ensureSchema()
  const rows = await db()`DELETE FROM hires WHERE id = ${id} RETURNING 1`
  return rows.length > 0
}

/** 항목 완료 체크. 메모는 건드리지 않아요 (다른 사람이 동시에 메모를 고쳐도 덮어쓰지 않게). 입사자 id 를 돌려줘요. */
export async function setItemDone(itemId: string, done: boolean, who: Actor): Promise<string | null> {
  await ensureSchema()
  const [row] = await db()<{ hire_id: string }[]>`
    UPDATE hire_items SET done = ${done}, updated_by = ${who.name}, updated_at = now()
     WHERE id = ${itemId} RETURNING hire_id::text`
  return row?.hire_id ?? null
}

/** 항목 메모 저장. 완료 여부는 건드리지 않아요. 입사자 id 를 돌려줘요. */
export async function saveItemMemo(itemId: string, memo: string, who: Actor): Promise<string | null> {
  await ensureSchema()
  const [row] = await db()<{ hire_id: string }[]>`
    UPDATE hire_items SET memo = ${memo}, updated_by = ${who.name}, updated_at = now()
     WHERE id = ${itemId} RETURNING hire_id::text`
  return row?.hire_id ?? null
}

export async function listTemplates(): Promise<Template[]> {
  await ensureSchema()
  return db()<Template[]>`SELECT id::text, title FROM checklist_templates ORDER BY checklist_templates.id LIMIT ${TEMPLATE_MAX}`
}

/** 기본 항목 추가. 문제가 있으면 사용자에게 보여 줄 문구를, 없으면 null. */
export async function addTemplate(title: string): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (sql) => {
    // 관리자 두 명이 동시에 눌러도 개수 상한·중복 검사가 엇갈리지 않게 줄을 세워요.
    await sql`SELECT pg_advisory_xact_lock(hashtext('onboarding:templates'))`
    const [{ count, dup }] = await sql<{ count: number; dup: boolean }[]>`
      SELECT count(*)::int AS count, coalesce(bool_or(title = ${title}), false) AS dup FROM checklist_templates`
    if (dup) return '이미 있는 항목이에요.'
    if (count >= TEMPLATE_MAX) return `기본 항목은 ${TEMPLATE_MAX}개까지 둘 수 있어요.`
    await sql`INSERT INTO checklist_templates (title) VALUES (${title})`
    return null
  })
}

export async function deleteTemplate(id: string): Promise<boolean> {
  await ensureSchema()
  const rows = await db()`DELETE FROM checklist_templates WHERE id = ${id} RETURNING 1`
  return rows.length > 0
}
