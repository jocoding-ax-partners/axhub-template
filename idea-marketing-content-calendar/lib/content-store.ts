// 콘텐츠 데이터 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import { db, ensureSchema } from './db'
import { monthRange, type Channel, type ContentValue, type Status } from './content'

/** 달력 칸에 그릴 만큼만. */
export type CalendarItem = { id: string; title: string; channel: Channel; publish_date: string; owner: string; status: Status }

export type ContentRow = CalendarItem & {
  memo: string
  created_by_key: string
  created_by_name: string
  created_at: Date
  updated_by_name: string
  updated_at: Date
  version: number
}

/** 한 달에 그릴 수 있는 최대 건수. 넘으면 화면이 "목록에서 보세요" 라고 알려요. */
export const MONTH_MAX = 1000

/** 그 달의 콘텐츠 (발행 예정일 순). */
export async function listMonth(month: string): Promise<{ rows: CalendarItem[]; truncated: boolean }> {
  await ensureSchema()
  const { from, to } = monthRange(month)
  const rows = await db()<CalendarItem[]>`
    SELECT id::text, title, channel, publish_date::text, owner, status
      FROM contents c
     WHERE publish_date BETWEEN ${from} AND ${to}
     ORDER BY publish_date, c.id
     LIMIT ${MONTH_MAX + 1}`
  return { rows: rows.slice(0, MONTH_MAX), truncated: rows.length > MONTH_MAX }
}

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type ListFilter = { q: string; channel: Channel | null; status: Status | null; date: string | null; page: number }

/**
 * 목록 보기. q 는 제목·담당자에서 찾아요. 발행 예정일이 늦은 것부터.
 * ponytail: OFFSET 페이징 — 팀 하나의 콘텐츠 수(수천 건)에선 충분해요. 수십만 건이 되면 커서로 바꿔요.
 */
export async function listContents(f: ListFilter): Promise<{ rows: CalendarItem[]; hasMore: boolean; total: number }> {
  await ensureSchema()
  const sql = db()
  const like = '%' + f.q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
  const where = sql`
    WHERE true
      ${f.q ? sql`AND (title ILIKE ${like} OR owner ILIKE ${like})` : sql``}
      ${f.channel ? sql`AND channel = ${f.channel}` : sql``}
      ${f.status ? sql`AND status = ${f.status}` : sql``}
      ${f.date ? sql`AND publish_date = ${f.date}` : sql``}`
  const [rows, [{ total }]] = await Promise.all([
    sql<CalendarItem[]>`
      SELECT id::text, title, channel, publish_date::text, owner, status
        FROM contents c ${where}
       ORDER BY publish_date DESC, c.id DESC
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(f.page - 1) * PAGE_SIZE}`,
    sql<{ total: number }[]>`SELECT count(*)::int AS total FROM contents ${where}`,
  ])
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE, total }
}

export async function getContent(id: string): Promise<ContentRow | null> {
  await ensureSchema()
  const [row] = await db()<ContentRow[]>`
    SELECT id::text, title, channel, publish_date::text, owner, status, memo,
           created_by_key, created_by_name, created_at, updated_by_name, updated_at, version
      FROM contents WHERE id = ${id}`
  return row ?? null
}

type Editor = { userKey: string; name: string }

/** 새 콘텐츠. 만든 줄의 id 를 돌려줘요. */
export async function createContent(who: Editor, v: ContentValue): Promise<string> {
  await ensureSchema()
  const [row] = await db()<{ id: string }[]>`
    INSERT INTO contents (title, channel, publish_date, owner, status, memo, created_by_key, created_by_name, updated_by_name)
    VALUES (${v.title}, ${v.channel}, ${v.publishDate}, ${v.owner}, ${v.status}, ${v.memo}, ${who.userKey}, ${who.name}, ${who.name})
    RETURNING id::text`
  return row.id
}

export const CHANGED_ELSEWHERE = '그사이 다른 사람이 이 콘텐츠를 고쳤어요. 화면을 새로고침한 뒤 다시 고쳐 주세요.'
export const NOT_FOUND = '없는 콘텐츠예요. 이미 지워졌을 수 있어요.'

/** 고치기. 화면을 연 뒤 다른 사람이 먼저 고쳤으면(version 이 다르면) 저장하지 않고 문구를 돌려줘요. */
export async function updateContent(id: string, version: number, who: Editor, v: ContentValue): Promise<string | null> {
  await ensureSchema()
  const updated = await db()`
    UPDATE contents
       SET title = ${v.title}, channel = ${v.channel}, publish_date = ${v.publishDate}, owner = ${v.owner},
           status = ${v.status}, memo = ${v.memo}, updated_by_name = ${who.name}, updated_at = now(), version = version + 1
     WHERE id = ${id} AND version = ${version}`
  if (updated.count > 0) return null
  const [exists] = await db()`SELECT 1 FROM contents WHERE id = ${id}`
  return exists ? CHANGED_ELSEWHERE : NOT_FOUND
}

/** 지우기. 지울 수 있는지(등록자·관리자)는 부르는 쪽이 getContent 로 먼저 확인해요. */
export async function deleteContent(id: string): Promise<boolean> {
  await ensureSchema()
  const deleted = await db()`DELETE FROM contents WHERE id = ${id}`
  return deleted.count > 0
}
