// 교육·신청 데이터 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import { db, ensureSchema } from './db'
import type { TrainingValue } from './training'

export type Training = {
  id: string
  title: string
  description: string
  starts_at: Date
  location: string
  capacity: number
  /** 지금 신청한 사람 수 */
  signed: number
  /** 지금 보는 사람이 신청했는지 */
  mine: boolean
}

export type Signup = { user_key: string; user_name: string; user_email: string; created_at: Date }

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean; total: number }

/** 검색어 → ILIKE 패턴. %, _ 는 글자 그대로 찾게 이스케이프해요. */
const likeOf = (q: string) => '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'

/** 주소창의 id 가 숫자인지. 아니면 DB 에 묻지 않아요. */
export const isId = (id: string) => /^\d{1,18}$/.test(id)

// 교육 목록에서 쓰는 열. signed 는 신청 줄 수, mine 은 보는 사람의 신청 여부예요.
const trainingCols = (userKey: string) => db()`
  t.id::text, t.title, t.description, t.starts_at, t.location, t.capacity,
  (SELECT count(*)::int FROM training_signups s WHERE s.training_id = t.id) AS signed,
  EXISTS (SELECT 1 FROM training_signups s WHERE s.training_id = t.id AND s.user_key = ${userKey}) AS mine`

// ponytail: OFFSET 페이징 — 사내 교육 수 규모에선 충분해요. 수만 건이 되면 커서로 바꿔요.
async function paged<T>(rows: Promise<T[]>, total: Promise<{ total: number }[]>): Promise<Page<T>> {
  const [r, [t]] = await Promise.all([rows, total])
  return { rows: r.slice(0, PAGE_SIZE), hasMore: r.length > PAGE_SIZE, total: t.total }
}

/** 아직 시작하지 않은 교육 — 가까운 일시부터. q 가 있으면 제목·장소에 그 글자가 들어간 것만. */
export async function listUpcoming(userKey: string, q: string, page: number): Promise<Page<Training>> {
  await ensureSchema()
  const match = q ? db()`AND (t.title ILIKE ${likeOf(q)} OR t.location ILIKE ${likeOf(q)})` : db()``
  return paged(
    db()<Training[]>`
      SELECT ${trainingCols(userKey)} FROM trainings t
       WHERE t.starts_at > now() ${match}
       ORDER BY t.starts_at, t.id
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    db()<{ total: number }[]>`SELECT count(*)::int AS total FROM trainings t WHERE t.starts_at > now() ${match}`,
  )
}

/** 내가 신청한 교육 — 지난 교육까지, 최근 일시부터. */
export async function listMine(userKey: string, page: number): Promise<Page<Training>> {
  await ensureSchema()
  return paged(
    db()<Training[]>`
      SELECT ${trainingCols(userKey)} FROM trainings t
        JOIN training_signups m ON m.training_id = t.id AND m.user_key = ${userKey}
       ORDER BY (t.starts_at <= now()), abs(extract(epoch FROM t.starts_at - now())), t.id
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    db()<{ total: number }[]>`SELECT count(*)::int AS total FROM training_signups WHERE user_key = ${userKey}`,
  )
}

/** 관리자용 전체 목록 — 다가오는 교육(가까운 순) 다음에 지난 교육(최근 순). */
export async function listAll(q: string, page: number): Promise<Page<Training>> {
  await ensureSchema()
  const match = q ? db()`WHERE t.title ILIKE ${likeOf(q)} OR t.location ILIKE ${likeOf(q)}` : db()``
  return paged(
    db()<Training[]>`
      SELECT ${trainingCols('')} FROM trainings t ${match}
       ORDER BY (t.starts_at <= now()), abs(extract(epoch FROM t.starts_at - now())), t.id
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    db()<{ total: number }[]>`SELECT count(*)::int AS total FROM trainings t ${match}`,
  )
}

export async function getTraining(id: string): Promise<Training | null> {
  if (!isId(id)) return null
  await ensureSchema()
  const [row] = await db()<Training[]>`SELECT ${trainingCols('')} FROM trainings t WHERE t.id = ${id}`
  return row ?? null
}

/** 한 교육의 신청자 — 먼저 신청한 순서. q 가 있으면 이름·이메일로 찾아요. */
export async function listSignups(id: string, q: string, page: number): Promise<Page<Signup>> {
  await ensureSchema()
  const match = q ? db()`AND (user_name ILIKE ${likeOf(q)} OR user_email ILIKE ${likeOf(q)})` : db()``
  return paged(
    db()<Signup[]>`
      SELECT user_key, user_name, user_email, created_at FROM training_signups
       WHERE training_id = ${id} ${match}
       ORDER BY created_at, user_key
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    db()<{ total: number }[]>`SELECT count(*)::int AS total FROM training_signups WHERE training_id = ${id} ${match}`,
  )
}

/** CSV 용 전체 명단. 신청 수는 정원(최대 CAPACITY_MAX)을 넘지 않아요. */
export async function allSignups(id: string): Promise<Signup[]> {
  await ensureSchema()
  return db()<Signup[]>`
    SELECT user_key, user_name, user_email, created_at FROM training_signups
     WHERE training_id = ${id}
     ORDER BY created_at, user_key
     LIMIT 5000`
}

// ── 쓰기 ───────────────────────────────────────────────────────────────────
// 아래 함수들은 문제가 있으면 사용자에게 보여 줄 문구를, 없으면 null 을 돌려줘요.

const GONE = '없는 교육이에요. 화면을 새로고침해 주세요.'

export async function createTraining(v: TrainingValue, createdBy: string): Promise<string> {
  await ensureSchema()
  const [row] = await db()<{ id: string }[]>`
    INSERT INTO trainings (title, description, starts_at, location, capacity, created_by)
    VALUES (${v.title}, ${v.description}, ${v.startsAt}, ${v.location}, ${v.capacity}, ${createdBy})
    RETURNING id::text`
  return row.id
}

export async function updateTraining(id: string, v: TrainingValue): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (tx) => {
    // 교육 줄을 잠가요 — 신청(signUp)도 같은 줄을 잠그니 정원 확인과 신청이 엇갈리지 않아요.
    const [t] = await tx`SELECT 1 FROM trainings WHERE id = ${id} FOR UPDATE`
    if (!t) return GONE
    const [{ n }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM training_signups WHERE training_id = ${id}`
    if (v.capacity < n) return `이미 ${n}명이 신청해서 정원을 ${n}명보다 줄일 수 없어요.`
    await tx`
      UPDATE trainings
         SET title = ${v.title}, description = ${v.description}, starts_at = ${v.startsAt},
             location = ${v.location}, capacity = ${v.capacity}, updated_at = now()
       WHERE id = ${id}`
    return null
  })
}

export async function deleteTraining(id: string): Promise<string | null> {
  await ensureSchema()
  const rows = await db()`DELETE FROM trainings WHERE id = ${id}`
  return rows.count === 0 ? GONE : null
}

type Person = { userKey: string; name: string; email: string }

export async function signUp(id: string, who: Person): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (tx) => {
    // 교육 줄을 잠가 동시에 눌러도 정원을 넘지 않게 한 명씩 줄을 세워요.
    const [t] = await tx<{ capacity: number; started: boolean }[]>`
      SELECT capacity, starts_at <= now() AS started FROM trainings WHERE id = ${id} FOR UPDATE`
    if (!t) return GONE
    if (t.started) return '이미 시작한 교육이라 신청할 수 없어요.'
    const [{ n, mine }] = await tx<{ n: number; mine: boolean }[]>`
      SELECT count(*)::int AS n, coalesce(bool_or(user_key = ${who.userKey}), false) AS mine
        FROM training_signups WHERE training_id = ${id}`
    if (mine) return '이미 신청한 교육이에요.'
    if (n >= t.capacity) return '정원이 다 차서 마감됐어요.'
    await tx`
      INSERT INTO training_signups (training_id, user_key, user_name, user_email)
      VALUES (${id}, ${who.userKey}, ${who.name}, ${who.email})`
    return null
  })
}

export async function cancelSignup(id: string, userKey: string): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (tx) => {
    const [t] = await tx<{ started: boolean }[]>`SELECT starts_at <= now() AS started FROM trainings WHERE id = ${id} FOR UPDATE`
    if (!t) return GONE
    if (t.started) return '이미 시작한 교육은 취소할 수 없어요.'
    const rows = await tx`DELETE FROM training_signups WHERE training_id = ${id} AND user_key = ${userKey}`
    return rows.count === 0 ? '신청한 기록이 없어요. 화면을 새로고침해 주세요.' : null
  })
}
