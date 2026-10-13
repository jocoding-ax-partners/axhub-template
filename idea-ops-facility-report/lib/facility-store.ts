// 고장 신고 읽기·쓰기 (서버 전용). 화면(app/*)·Server Action(app/actions.ts)·사진 주소(app/photos)는 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import { db, ensureSchema } from './db'
import { likePattern, type ReportInput, type ReportStatus, type ReportUpdate } from './facility'

export type Report = {
  id: string
  reporter_key: string
  reporter_name: string
  reporter_email: string
  location: string
  description: string
  has_photo: boolean
  status: ReportStatus
  memo: string
  handled_by: string | null
  handled_at: Date | null
  version: number
  created_at: Date
}

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean }

function toPage<T>(rows: T[]): Page<T> {
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE }
}

const offset = (page: number) => (page - 1) * PAGE_SIZE

// 목록에 필요한 칸. 사진 열쇠(photo_key)는 화면에 내보내지 않고 있는지만 알려요.
const columns = () => db()`
  id::text, reporter_key, reporter_name, reporter_email, location, description,
  photo_key IS NOT NULL AS has_photo, status, memo, handled_by, handled_at, version, created_at`

// ponytail: OFFSET 페이징 — 한 사람의 신고 수·한 상태의 신고 수 규모에선 충분해요. 수만 건이 되면 커서로 바꿔요.
export async function listMyReports(userKey: string, page: number): Promise<Page<Report>> {
  await ensureSchema()
  const rows = await db()<Report[]>`
    SELECT ${columns()}
      FROM facility_reports
     WHERE reporter_key = ${userKey}
     ORDER BY facility_reports.id DESC
     LIMIT ${PAGE_SIZE + 1} OFFSET ${offset(page)}`
  return toPage(rows)
}

/** 담당자 화면의 탭. 처리할 일(접수 · 처리 중)은 오래된 것부터, 완료 · 전체는 최근 것부터 보여요. */
export type AdminView = ReportStatus | 'all'

export type StatusCounts = Record<ReportStatus, number>

export async function countByStatus(): Promise<StatusCounts> {
  await ensureSchema()
  const rows = await db()<{ status: ReportStatus; n: number }[]>`
    SELECT status, count(*)::int AS n FROM facility_reports GROUP BY status`
  const counts: StatusCounts = { received: 0, in_progress: 0, done: 0 }
  for (const r of rows) counts[r.status] = r.n
  return counts
}

/** 담당자 목록. q 가 있으면 위치 · 내용 · 신고자 이름 · 이메일에 그 글자가 들어간 것만. */
export async function listForManager(view: AdminView, q: string, page: number): Promise<Page<Report> & { total: number }> {
  await ensureSchema()
  const sql = db()
  const like = likePattern(q)
  const where = sql`
    WHERE true
    ${view === 'all' ? sql`` : sql`AND status = ${view}`}
    ${q ? sql`AND (location ILIKE ${like} OR description ILIKE ${like} OR reporter_name ILIKE ${like} OR reporter_email ILIKE ${like})` : sql``}`
  const order = view === 'received' || view === 'in_progress' ? sql`ORDER BY facility_reports.id ASC` : sql`ORDER BY facility_reports.id DESC`
  const [rows, [{ total }]] = await Promise.all([
    sql<Report[]>`
      SELECT ${columns()}
        FROM facility_reports
        ${where}
        ${order}
       LIMIT ${PAGE_SIZE + 1} OFFSET ${offset(page)}`,
    sql<{ total: number }[]>`SELECT count(*)::int AS total FROM facility_reports ${where}`,
  ])
  return { ...toPage(rows), total }
}

type Reporter = { userKey: string; name: string; email: string }

export async function createReport(who: Reporter, input: ReportInput, photoKey: string | null): Promise<void> {
  await ensureSchema()
  await db()`
    INSERT INTO facility_reports (reporter_key, reporter_name, reporter_email, location, description, photo_key)
    VALUES (${who.userKey}, ${who.name}, ${who.email}, ${input.location}, ${input.description}, ${photoKey})`
}

/**
 * 담당자의 상태 · 메모 저장. 화면을 연 뒤 다른 담당자가 먼저 고쳤다면(version 이 다르면) 덮어쓰지 않아요.
 * 문제가 있으면 사용자에게 보여 줄 문구를, 없으면 null 을 돌려줘요.
 */
export async function updateReport(input: ReportUpdate, handler: string): Promise<string | null> {
  await ensureSchema()
  const sql = db()
  const updated = await sql`
    UPDATE facility_reports
       SET status = ${input.status}, memo = ${input.memo}, handled_by = ${handler}, handled_at = now(), version = version + 1
     WHERE id = ${input.id} AND version = ${input.version}
       AND (status <> ${input.status} OR memo <> ${input.memo})
     RETURNING id`
  if (updated.length > 0) return null
  const [row] = await sql<{ status: ReportStatus; memo: string; version: number }[]>`
    SELECT status, memo, version FROM facility_reports WHERE id = ${input.id}`
  if (!row) return '없는 신고예요. 화면을 새로고침해 주세요.'
  if (row.version !== input.version) return '다른 담당자가 먼저 고쳤어요. 화면을 새로고침한 뒤 다시 저장해 주세요.'
  return '바뀐 내용이 없어요. 상태나 메모를 고친 뒤 저장해 주세요.'
}

/** 사진 열쇠와 신고자. 사진 주소(app/photos/[id])가 권한을 확인할 때 써요. */
export async function getPhoto(id: string): Promise<{ reporter_key: string; photo_key: string | null } | null> {
  await ensureSchema()
  const [row] = await db()<{ reporter_key: string; photo_key: string | null }[]>`
    SELECT reporter_key, photo_key FROM facility_reports WHERE id = ${id}`
  return row ?? null
}
