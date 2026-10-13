// 공지 데이터 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import { db, ensureSchema } from './db'
import type { NoticeInput } from './notice'

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean }

function toPage<T>(rows: T[]): Page<T> {
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE }
}

const offset = (page: number) => (page - 1) * PAGE_SIZE

/** ILIKE 검색어 — %, _ 는 글자 그대로 찾게 이스케이프해요. */
const likeOf = (q: string) => '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'

export type Person = { userKey: string; name: string; email: string }

/**
 * 앱에 들어온 사람을 명단(members)에 남겨요. 확인률의 분모예요.
 * 매 요청 쓰지 않게 이름·이메일이 바뀌었거나 마지막 기록이 1시간 넘었을 때만 고쳐요.
 */
export async function touchMember(p: Person): Promise<void> {
  await ensureSchema()
  await db()`
    INSERT INTO members (user_key, name, email) VALUES (${p.userKey}, ${p.name}, ${p.email})
    ON CONFLICT (user_key) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, last_seen = now()
     WHERE members.name IS DISTINCT FROM EXCLUDED.name
        OR members.email IS DISTINCT FROM EXCLUDED.email
        OR members.last_seen < now() - interval '1 hour'`
}

// ── 직원 화면 ────────────────────────────────────────────────────────────────

export type MyNotice = {
  id: string
  title: string
  important: boolean
  author_name: string
  created_at: Date
  read_at: Date | null
}

/**
 * 공지 목록 — 안 읽은 공지 먼저, 그 안에서 중요 공지 먼저, 그다음 최신순.
 * q 가 있으면 제목·본문에 그 글자가 들어간 것만.
 * ponytail: OFFSET 페이징 — 공지 수천 건까지는 충분해요. 더 커지면 커서로 바꿔요.
 */
export async function listMyNotices(userKey: string, q: string, page: number): Promise<Page<MyNotice> & { unread: number }> {
  await ensureSchema()
  const like = likeOf(q)
  const match = q ? db()`AND (n.title ILIKE ${like} OR n.body ILIKE ${like})` : db()``
  const [rows, [{ unread }]] = await Promise.all([
    db()<MyNotice[]>`
      SELECT n.id::text, n.title, n.important, n.author_name, n.created_at, r.read_at
        FROM notices n
        LEFT JOIN notice_reads r ON r.notice_id = n.id AND r.user_key = ${userKey}
       WHERE true ${match}
       ORDER BY (r.read_at IS NOT NULL), n.important DESC, n.created_at DESC, n.id DESC
       LIMIT ${PAGE_SIZE + 1} OFFSET ${offset(page)}`,
    db()<{ unread: number }[]>`
      SELECT count(*)::int AS unread
        FROM notices n
       WHERE NOT EXISTS (SELECT 1 FROM notice_reads r WHERE r.notice_id = n.id AND r.user_key = ${userKey})`,
  ])
  return { ...toPage(rows), unread }
}

export type NoticeDetail = MyNotice & { body: string }

export async function getNotice(id: string, userKey: string): Promise<NoticeDetail | null> {
  await ensureSchema()
  const [row] = await db()<NoticeDetail[]>`
    SELECT n.id::text, n.title, n.body, n.important, n.author_name, n.created_at, r.read_at
      FROM notices n
      LEFT JOIN notice_reads r ON r.notice_id = n.id AND r.user_key = ${userKey}
     WHERE n.id = ${id}`
  return row ?? null
}

/** "확인했어요". 이미 눌렀으면 처음 시각을 그대로 둬요. 공지가 없으면 false. */
export async function confirmRead(id: string, who: Person): Promise<boolean> {
  await touchMember(who)
  const [found] = await db()`SELECT 1 FROM notices WHERE id = ${id}`
  if (!found) return false
  await db()`
    INSERT INTO notice_reads (notice_id, user_key) VALUES (${id}, ${who.userKey})
    ON CONFLICT DO NOTHING`
  return true
}

// ── 관리자 화면 ──────────────────────────────────────────────────────────────

export async function createNotice(author: Person, input: NoticeInput): Promise<string> {
  await ensureSchema()
  const [row] = await db()<{ id: string }[]>`
    INSERT INTO notices (title, body, important, author_key, author_name)
    VALUES (${input.title}, ${input.body}, ${input.important}, ${author.userKey}, ${author.name})
    RETURNING id::text`
  return row.id
}

/** 공지 삭제. 확인 기록도 함께 지워져요 (ON DELETE CASCADE). 없으면 false. */
export async function deleteNotice(id: string): Promise<boolean> {
  await ensureSchema()
  const rows = await db()`DELETE FROM notices WHERE id = ${id} RETURNING id`
  return rows.length > 0
}

/** 확인률의 분모 — 앱에 들어온 적이 있는 사람 수. */
export async function countMembers(): Promise<number> {
  await ensureSchema()
  const [{ total }] = await db()<{ total: number }[]>`SELECT count(*)::int AS total FROM members`
  return total
}

export type NoticeStat = { id: string; title: string; important: boolean; author_name: string; created_at: Date; reads: number }

/** 공지별 확인 수 (최신순). q 가 있으면 제목에 그 글자가 들어간 것만. */
export async function listNoticeStats(q: string, page: number): Promise<Page<NoticeStat> & { total: number }> {
  await ensureSchema()
  const like = likeOf(q)
  const match = q ? db()`WHERE n.title ILIKE ${like}` : db()``
  const [rows, [{ total }]] = await Promise.all([
    db()<NoticeStat[]>`
      SELECT n.id::text, n.title, n.important, n.author_name, n.created_at,
             (SELECT count(*) FROM notice_reads r WHERE r.notice_id = n.id)::int AS reads
        FROM notices n ${match}
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT ${PAGE_SIZE + 1} OFFSET ${offset(page)}`,
    db()<{ total: number }[]>`SELECT count(*)::int AS total FROM notices n ${match}`,
  ])
  return { ...toPage(rows), total }
}

export type NoticeSummary = { id: string; title: string; important: boolean; author_name: string; created_at: Date; reads: number }

export async function getNoticeSummary(id: string): Promise<NoticeSummary | null> {
  await ensureSchema()
  const [row] = await db()<NoticeSummary[]>`
    SELECT n.id::text, n.title, n.important, n.author_name, n.created_at,
           (SELECT count(*) FROM notice_reads r WHERE r.notice_id = n.id)::int AS reads
      FROM notices n
     WHERE n.id = ${id}`
  return row ?? null
}

export type PersonRow = { user_key: string; name: string; email: string; read_at: Date | null }

/** 확인한 사람(read) 또는 아직 안 본 사람(unread). q 는 이름·이메일 검색. */
export async function listPeople(
  id: string,
  which: 'read' | 'unread',
  q: string,
  page: number,
): Promise<Page<PersonRow> & { count: number }> {
  await ensureSchema()
  const like = likeOf(q)
  const match = q ? db()`AND (m.name ILIKE ${like} OR m.email ILIKE ${like})` : db()``
  if (which === 'read') {
    const [rows, [{ count }]] = await Promise.all([
      db()<PersonRow[]>`
        SELECT m.user_key, m.name, m.email, r.read_at
          FROM notice_reads r JOIN members m ON m.user_key = r.user_key
         WHERE r.notice_id = ${id} ${match}
         ORDER BY r.read_at DESC, m.user_key
         LIMIT ${PAGE_SIZE + 1} OFFSET ${offset(page)}`,
      db()<{ count: number }[]>`
        SELECT count(*)::int AS count
          FROM notice_reads r JOIN members m ON m.user_key = r.user_key
         WHERE r.notice_id = ${id} ${match}`,
    ])
    return { ...toPage(rows), count }
  }
  const unread = db()`NOT EXISTS (SELECT 1 FROM notice_reads r WHERE r.notice_id = ${id} AND r.user_key = m.user_key)`
  const [rows, [{ count }]] = await Promise.all([
    db()<PersonRow[]>`
      SELECT m.user_key, m.name, m.email, NULL::timestamptz AS read_at
        FROM members m
       WHERE ${unread} ${match}
       ORDER BY m.name, m.email, m.user_key
       LIMIT ${PAGE_SIZE + 1} OFFSET ${offset(page)}`,
    db()<{ count: number }[]>`SELECT count(*)::int AS count FROM members m WHERE ${unread} ${match}`,
  ])
  return { ...toPage(rows), count }
}
