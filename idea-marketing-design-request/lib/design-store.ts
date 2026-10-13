// 디자인 요청 데이터 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import type postgres from 'postgres'
import { db, ensureSchema } from './db'
import {
  RESULT_MAX,
  canEditResults,
  statusChangeError,
  type DesignKind,
  type DesignRequestInput,
  type DesignStatus,
} from './design'

export type RequestRow = {
  id: string
  requester_key: string
  requester_name: string
  requester_email: string
  kind: DesignKind
  size: string
  copy_text: string
  due_date: string
  status: DesignStatus
  designer_key: string | null
  designer_name: string | null
  created_at: Date
  updated_at: Date
  /** 올라온 결과물 수 */
  result_count: number
}

export type FileRow = {
  id: string
  role: 'reference' | 'result'
  file_name: string
  content_type: string
  size_bytes: number
  uploaded_by: string
  created_at: Date
}

/** 저장소에 이미 올린 파일 한 개 — DB 에 줄을 남기기 전 단계. */
export type StoredFile = { key: string; name: string; type: string; size: number }

export type Person = { userKey: string; name: string; email: string }

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean; total: number }

/** 요청 목록·상세가 같이 쓰는 SELECT. where · order 는 db()`…` 조각으로 받아요. */
function selectRequests(sql: postgres.Sql, where: postgres.PendingQuery<postgres.Row[]>, order: postgres.PendingQuery<postgres.Row[]>, limit: number, offset: number) {
  return sql<RequestRow[]>`
    SELECT r.id::text, r.requester_key, r.requester_name, r.requester_email, r.kind, r.size, r.copy_text,
           r.due_date::text, r.status, r.designer_key, r.designer_name, r.created_at, r.updated_at,
           (SELECT count(*) FROM design_files f WHERE f.request_id = r.id AND f.role = 'result')::int AS result_count
      FROM design_requests r
     WHERE ${where}
     ${order}
     LIMIT ${limit} OFFSET ${offset}`
}

/** 검색어 → ILIKE 패턴 (%, _, \ 는 글자 그대로 찾게 바꿔요). */
const likeOf = (q: string) => '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'

// ponytail: OFFSET 페이징 — 요청이 수만 건이 되면 커서(created_at, id)로 바꿔요.
async function pageOf(where: postgres.PendingQuery<postgres.Row[]>, order: postgres.PendingQuery<postgres.Row[]>, page: number): Promise<Page<RequestRow>> {
  await ensureSchema()
  const sql = db()
  const [rows, [{ total }]] = await Promise.all([
    selectRequests(sql, where, order, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE),
    sql<{ total: number }[]>`SELECT count(*)::int AS total FROM design_requests r WHERE ${where}`,
  ])
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE, total }
}

/** 내가 올린 요청 — 최근 것부터. q 가 있으면 문구 · 크기에 그 글자가 들어간 것만. */
export function listMyRequests(userKey: string, q: string, page: number): Promise<Page<RequestRow>> {
  const sql = db()
  const like = likeOf(q)
  const where = q
    ? sql`r.requester_key = ${userKey} AND (r.copy_text ILIKE ${like} OR r.size ILIKE ${like})`
    : sql`r.requester_key = ${userKey}`
  return pageOf(where, sql`ORDER BY r.created_at DESC, r.id DESC`, page)
}

/**
 * 전체 요청 (디자이너용). status 가 비면 전부 — 끝나지 않은 것부터 마감이 급한 순서.
 * 완료만 볼 땐 최근에 끝난 것부터. q 는 요청자 이름 · 이메일 · 문구 · 담당 디자이너에서 찾아요.
 */
export function listAllRequests(status: DesignStatus | '', q: string, page: number): Promise<Page<RequestRow>> {
  const sql = db()
  const like = likeOf(q)
  const byStatus = status ? sql`r.status = ${status}` : sql`TRUE`
  const byText = q
    ? sql`AND (r.requester_name ILIKE ${like} OR r.requester_email ILIKE ${like} OR r.copy_text ILIKE ${like} OR coalesce(r.designer_name, '') ILIKE ${like})`
    : sql``
  const order =
    status === 'done' ? sql`ORDER BY r.updated_at DESC, r.id DESC` : sql`ORDER BY (r.status = 'done'), r.due_date, r.id`
  return pageOf(sql`${byStatus} ${byText}`, order, page)
}

/** 단계별 요청 수. requesterKey 를 주면 그 사람이 올린 요청만 세요. */
export async function countByStatus(requesterKey?: string): Promise<Record<DesignStatus, number>> {
  await ensureSchema()
  const sql = db()
  const rows = await sql<{ status: DesignStatus; n: number }[]>`
    SELECT status, count(*)::int AS n FROM design_requests
     WHERE ${requesterKey ? sql`requester_key = ${requesterKey}` : sql`TRUE`}
     GROUP BY status`
  const out: Record<DesignStatus, number> = { received: 0, in_progress: 0, review: 0, done: 0 }
  for (const r of rows) out[r.status] = r.n
  return out
}

export async function getRequest(id: string): Promise<RequestRow | null> {
  if (!/^\d{1,18}$/.test(id)) return null
  await ensureSchema()
  const sql = db()
  const [row] = await selectRequests(sql, sql`r.id = ${id}`, sql``, 1, 0)
  return row ?? null
}

/** 요청에 붙은 파일 — 참고 자료 먼저, 올린 순서대로. */
export async function listFiles(requestId: string): Promise<FileRow[]> {
  await ensureSchema()
  return db()<FileRow[]>`
    SELECT id::text, role, file_name, content_type, size_bytes, uploaded_by, created_at
      FROM design_files
     WHERE request_id = ${requestId}
     ORDER BY role, design_files.id`
}

/** 파일 한 개와 그 요청의 요청자 (보기 권한 확인용). */
export async function getFileForView(fileId: string) {
  if (!/^\d{1,18}$/.test(fileId)) return null
  await ensureSchema()
  const [row] = await db()<{ storage_key: string; file_name: string; content_type: string; requester_key: string }[]>`
    SELECT f.storage_key, f.file_name, f.content_type, r.requester_key
      FROM design_files f JOIN design_requests r ON r.id = f.request_id
     WHERE f.id = ${fileId}`
  return row ?? null
}

async function insertFiles(sql: postgres.TransactionSql, requestId: string, role: FileRow['role'], files: StoredFile[], by: string) {
  for (const f of files) {
    await sql`
      INSERT INTO design_files (request_id, role, storage_key, file_name, content_type, size_bytes, uploaded_by)
      VALUES (${requestId}, ${role}, ${f.key}, ${f.name}, ${f.type}, ${f.size}, ${by})`
  }
}

/** 새 요청 + 참고 자료 파일 줄을 한 번에 저장해요. 새 요청 번호를 돌려줘요. */
export async function createRequest(who: Person, input: DesignRequestInput, references: StoredFile[]): Promise<string> {
  await ensureSchema()
  return db().begin(async (sql) => {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO design_requests (requester_key, requester_name, requester_email, kind, size, copy_text, due_date)
      VALUES (${who.userKey}, ${who.name}, ${who.email}, ${input.kind}, ${input.size}, ${input.copy}, ${input.due})
      RETURNING id::text`
    await insertFiles(sql, row.id, 'reference', references, who.name)
    return row.id
  })
}

type Outcome = { error: string } | { error: null; keys: string[] }

/** 요청 취소 — 요청자 본인, 아직 아무도 맡지 않은(접수) 요청만. 지운 파일 열쇠를 돌려줘요 (저장소 정리용). */
export async function cancelRequest(id: string, userKey: string): Promise<Outcome> {
  await ensureSchema()
  return db().begin(async (sql) => {
    const [row] = await sql<{ requester_key: string; status: DesignStatus }[]>`
      SELECT requester_key, status FROM design_requests WHERE id = ${id} FOR UPDATE`
    if (!row || row.requester_key !== userKey) return { error: '요청을 찾을 수 없어요. 화면을 새로고침해 주세요.' }
    if (row.status !== 'received') return { error: '디자이너가 이미 맡은 요청은 취소할 수 없어요. 디자이너에게 알려 주세요.' }
    const files = await sql<{ storage_key: string }[]>`SELECT storage_key FROM design_files WHERE request_id = ${id}`
    await sql`DELETE FROM design_requests WHERE id = ${id}`
    return { error: null, keys: files.map((f) => f.storage_key) }
  })
}

/** 요청을 맡아요. 접수 상태면 작업 중으로 바뀌어요. 다른 디자이너가 맡고 있었으면 내가 이어받아요. */
export async function takeRequest(id: string, designer: Person, expectedDesigner: string): Promise<string | null> {
  await ensureSchema()
  const [done] = await db()<{ id: string }[]>`
    UPDATE design_requests
       SET designer_key = ${designer.userKey}, designer_name = ${designer.name},
           status = CASE WHEN status = 'received' THEN 'in_progress' ELSE status END,
           updated_at = now()
     WHERE id = ${id}
       AND coalesce(designer_key, '') = ${expectedDesigner}
       AND coalesce(designer_key, '') <> ${designer.userKey}
    RETURNING id::text`
  if (done) return null
  const [row] = await db()<{ designer_key: string | null }[]>`SELECT designer_key FROM design_requests WHERE id = ${id}`
  if (!row) return '요청을 찾을 수 없어요. 요청자가 취소했을 수 있어요.'
  if (row.designer_key === designer.userKey) return '이미 내가 맡은 요청이에요.'
  return '그사이 다른 디자이너가 먼저 맡았어요. 화면을 새로고침해 확인해 주세요.'
}

/** 맡은 요청을 잠그고(FOR UPDATE) 내가 담당인지 확인해요. 문제가 있으면 문구를 돌려줘요. */
async function lockMine(sql: postgres.TransactionSql, id: string, designerKey: string) {
  const [row] = await sql<{ status: DesignStatus; designer_key: string | null }[]>`
    SELECT status, designer_key FROM design_requests WHERE id = ${id} FOR UPDATE`
  if (!row) return { error: '요청을 찾을 수 없어요. 요청자가 취소했을 수 있어요.' } as const
  if (row.designer_key !== designerKey) return { error: '내가 맡은 요청만 바꿀 수 있어요. 먼저 "내가 맡기" 를 눌러 주세요.' } as const
  const [{ n }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM design_files WHERE request_id = ${id} AND role = 'result'`
  return { error: null, status: row.status, results: n } as const
}

/** 진행 단계 바꾸기. from = 버튼을 누를 때 화면에 보이던 단계 — 그사이 바뀌었으면 덮어쓰지 않아요. */
export async function changeStatus(id: string, from: string, to: string, designerKey: string): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (sql) => {
    const mine = await lockMine(sql, id, designerKey)
    if (mine.error !== null) return mine.error
    if (mine.status !== from) return '그사이 단계가 바뀌었어요. 화면을 새로고침해 확인해 주세요.'
    const problem = statusChangeError(mine.status, to, mine.results)
    if (problem) return problem
    await sql`UPDATE design_requests SET status = ${to}, updated_at = now() WHERE id = ${id}`
    return null
  })
}

/** 결과물 파일 줄 추가. 저장소에는 이미 올라가 있어요 — 실패하면 부른 쪽이 지워요. */
export async function addResults(id: string, designer: Person, files: StoredFile[]): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (sql) => {
    const mine = await lockMine(sql, id, designer.userKey)
    if (mine.error !== null) return mine.error
    if (!canEditResults(mine.status)) return '완료된 요청이에요. "다시 작업하기" 를 누른 뒤 올려 주세요.'
    if (mine.results + files.length > RESULT_MAX) return `결과물은 요청 한 건에 ${RESULT_MAX}개까지 올릴 수 있어요. 지금 ${mine.results}개 있어요.`
    await insertFiles(sql, id, 'result', files, designer.name)
    await sql`UPDATE design_requests SET updated_at = now() WHERE id = ${id}`
    return null
  })
}

/** 결과물 한 개 지우기 — 맡은 디자이너만, 완료 전에만. 지운 파일 열쇠를 돌려줘요. */
export async function deleteResult(fileId: string, designerKey: string): Promise<Outcome> {
  await ensureSchema()
  return db().begin(async (sql) => {
    const [file] = await sql<{ request_id: string; storage_key: string }[]>`
      SELECT request_id::text, storage_key FROM design_files WHERE id = ${fileId} AND role = 'result'`
    if (!file) return { error: '파일을 찾을 수 없어요. 이미 지웠을 수 있어요.' }
    const mine = await lockMine(sql, file.request_id, designerKey)
    if (mine.error !== null) return { error: mine.error }
    if (!canEditResults(mine.status)) return { error: '완료된 요청의 결과물은 지울 수 없어요. "다시 작업하기" 를 누른 뒤 지워 주세요.' }
    if (mine.status === 'review' && mine.results <= 1)
      return { error: '검토 요청 중에는 마지막 결과물을 지울 수 없어요. 먼저 "작업 중" 으로 되돌려 주세요.' }
    await sql`DELETE FROM design_files WHERE id = ${fileId}`
    await sql`UPDATE design_requests SET updated_at = now() WHERE id = ${file.request_id}`
    return { error: null, keys: [file.storage_key] }
  })
}
