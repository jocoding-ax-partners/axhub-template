'use server'

// 이벤트 · 참가 신청자 · 출석을 바꾸는 일은 모두 여기 Server Action 으로 해요.
// 모든 함수는 맨 앞에서 담당자인지 확인하고(requireManager), 값은 서버에서 다시 검사해요.
// 권한 없음 · 잘못된 값 · 못 찾음은 throw 하지 않고 안내 문구를 돌려줘요 (배포본은 throw 문구를 가려요).
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Sql, TransactionSql } from 'postgres'
import { applicantError, classifyRows, LIMITS, parseApplicantsCsv, type ClassifiedRow, type CsvRow } from '@/lib/applicants'
import { db, ensureSchema } from '@/lib/db'
import { requireManager } from '@/lib/manager'

export type FormState = {
  ok?: boolean
  message?: string
  fieldErrors?: Record<string, string>
  values?: Record<string, string>
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const isId = (v: string) => /^\d{1,18}$/.test(v)

const BAD_REQUEST = '잘못된 요청이에요. 화면을 새로고침한 뒤 다시 시도해 주세요.'

function idOf(v: unknown): string | null {
  const id = String(v ?? '')
  return isId(id) ? id : null
}

// datetime-local 값("2026-10-20T14:00")을 한국 시간으로 해석해요.
// 2026-02-30 처럼 없는 날짜가 다음 달로 넘어가지 않게, 만든 뒤 각 자리를 다시 맞춰 봐요.
function kstDateTime(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v)
  if (!m) return null
  const [y, mo, d, h, mi] = m.slice(1).map(Number)
  const utc = new Date(Date.UTC(y, mo - 1, d, h, mi))
  const same = utc.getUTCFullYear() === y && utc.getUTCMonth() === mo - 1 && utc.getUTCDate() === d && utc.getUTCHours() === h && utc.getUTCMinutes() === mi
  return same ? new Date(utc.getTime() - 9 * 60 * 60 * 1000) : null
}

function refresh(eventId?: string) {
  revalidatePath('/')
  if (eventId) revalidatePath(`/events/${eventId}`)
}

// ── 이벤트 ─────────────────────────────────────────────────────────────────────

export async function createEvent(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireManager()
  if (!auth.ok) return { message: auth.message }
  const values = { name: str(form, 'name'), starts_at: str(form, 'starts_at'), venue: str(form, 'venue'), capacity: str(form, 'capacity') }
  const fieldErrors: Record<string, string> = {}

  if (!values.name) fieldErrors.name = '이벤트 이름을 입력해 주세요.'
  else if (values.name.length > 200) fieldErrors.name = '이름은 200자까지 쓸 수 있어요.'

  const startsAt = kstDateTime(values.starts_at)
  if (!values.starts_at) fieldErrors.starts_at = '일시를 골라 주세요.'
  else if (!startsAt) fieldErrors.starts_at = '없는 날짜나 시간이에요. 일시를 다시 골라 주세요.'

  if (!values.venue) fieldErrors.venue = '장소를 입력해 주세요.'
  else if (values.venue.length > 200) fieldErrors.venue = '장소는 200자까지 쓸 수 있어요.'

  const capacity = Number(values.capacity)
  if (!/^\d+$/.test(values.capacity) || capacity < 1 || capacity > 100_000) fieldErrors.capacity = '정원은 1~100,000 사이 숫자로 입력해 주세요.'

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values }

  await ensureSchema()
  const [row] = await db()<{ id: string }[]>`
    INSERT INTO events (name, starts_at, venue, capacity, created_by)
    VALUES (${values.name}, ${startsAt!}, ${values.venue}, ${capacity}, ${auth.userKey})
    RETURNING id::text`
  refresh()
  redirect(`/events/${row.id}`)
}

// 목록의 버튼(지우기 · 출석)은 실패하면 안내 문구를 돌려줘요 — components/forms.tsx 의 ActionForm 이 보여줘요.
export async function deleteEvent(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireManager()
  if (!auth.ok) return { message: auth.message }
  const eventId = idOf(form.get('event_id'))
  if (!eventId) return { message: BAD_REQUEST }
  await ensureSchema()
  await db()`DELETE FROM events WHERE id = ${eventId}`
  refresh()
  redirect('/')
}

// ── 참가 신청자 ─────────────────────────────────────────────────────────────────

// 이벤트의 정원과 이미 신청한 이메일. lock=true 면 등록이 끝날 때까지 이벤트를 잠가
// 동시에 여러 명이 올려도 정원을 넘지 않아요.
async function seatsOf(sql: Sql | TransactionSql, eventId: string, lock: boolean) {
  const [ev] = lock
    ? await sql<{ capacity: number }[]>`SELECT capacity FROM events WHERE id = ${eventId} FOR UPDATE`
    : await sql<{ capacity: number }[]>`SELECT capacity FROM events WHERE id = ${eventId}`
  if (!ev) return null
  const emails = await sql<{ e: string }[]>`SELECT lower(email) AS e FROM attendees WHERE event_id = ${eventId}`
  return { capacity: ev.capacity, registered: new Set(emails.map((r) => r.e)), seatsLeft: ev.capacity - emails.length }
}

// 판정 → 등록 가능한 줄만 한 트랜잭션으로 넣어요.
async function addRows(eventId: string, rows: CsvRow[]) {
  await ensureSchema()
  return db().begin(async (tx) => {
    const seats = await seatsOf(tx, eventId, true)
    if (!seats) return null
    const classified = classifyRows(rows, seats.registered, seats.seatsLeft)
    const ok = classified.filter((r) => r.status === 'ok')
    const inserted = ok.length
      ? await tx`
          INSERT INTO attendees ${tx(ok.map((r) => ({ event_id: eventId, name: r.name, company: r.company, email: r.email })))}
          ON CONFLICT DO NOTHING RETURNING id`
      : []
    return { classified, added: inserted.length, capacity: seats.capacity }
  })
}

export async function addApplicant(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireManager()
  if (!auth.ok) return { message: auth.message }
  const eventId = idOf(form.get('event_id'))
  if (!eventId) return { message: BAD_REQUEST }
  const values = { name: str(form, 'name'), company: str(form, 'company'), email: str(form, 'email') }
  const err = applicantError(values)
  if (err) {
    const field = err.startsWith('이름') ? 'name' : err.startsWith('회사') ? 'company' : 'email'
    return { fieldErrors: { [field]: err }, values }
  }

  const result = await addRows(eventId, [{ ...values, line: 1 }])
  if (!result) return { message: '이벤트를 찾지 못했어요. 목록에서 다시 열어 주세요.', values }
  const [row] = result.classified
  if (row.status === 'registered') return { fieldErrors: { email: '이미 신청한 이메일이에요.' }, values }
  if (row.status === 'full') return { message: `정원(${result.capacity}명)이 다 찼어요. 더 받으려면 신청자를 정리해 주세요.`, values }

  refresh(eventId)
  return { ok: true, message: `${values.name} 님을 등록했어요.` }
}

export async function deleteApplicant(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireManager()
  if (!auth.ok) return { message: auth.message }
  const eventId = idOf(form.get('event_id'))
  const attendeeId = idOf(form.get('attendee_id'))
  if (!eventId || !attendeeId) return { message: BAD_REQUEST }
  await ensureSchema()
  const gone = await db()`DELETE FROM attendees WHERE id = ${attendeeId} AND event_id = ${eventId} RETURNING id`
  refresh(eventId)
  return gone.length ? { ok: true } : { message: '이미 지워진 신청자예요.' }
}

export async function toggleCheckIn(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireManager()
  if (!auth.ok) return { message: auth.message }
  const eventId = idOf(form.get('event_id'))
  const attendeeId = idOf(form.get('attendee_id'))
  if (!eventId || !attendeeId) return { message: BAD_REQUEST }
  await ensureSchema()
  const hit = await db()`
    UPDATE attendees SET checked_in_at = CASE WHEN checked_in_at IS NULL THEN now() ELSE NULL END
    WHERE id = ${attendeeId} AND event_id = ${eventId} RETURNING id`
  refresh(eventId)
  return hit.length ? { ok: true } : { message: '신청자를 찾지 못했어요. 이미 지워졌을 수 있어요.' }
}

// ── CSV 올리기 (미리보기 → 등록) ─────────────────────────────────────────────────
// 글자 읽기(UTF-8 / EUC-KR)는 브라우저가 하고, 서버는 받은 글자를 다시 나누고 검사해요.

export type ImportPreview = { error: string } | { rows: ClassifiedRow[]; capacity: number; seatsLeft: number }

function parseText(text: unknown): { rows: CsvRow[] } | { error: string } {
  if (typeof text !== 'string' || text.length === 0) return { error: '파일에 내용이 없어요.' }
  if (text.length > LIMITS.fileBytes) return { error: '파일이 너무 커요. 500KB 이하로 나눠서 올려 주세요.' }
  return parseApplicantsCsv(text)
}

export async function previewImport(eventIdRaw: string, text: string): Promise<ImportPreview> {
  const auth = await requireManager()
  if (!auth.ok) return { error: auth.message }
  const eventId = idOf(eventIdRaw)
  if (!eventId) return { error: BAD_REQUEST }
  const parsed = parseText(text)
  if ('error' in parsed) return parsed
  await ensureSchema()
  const seats = await seatsOf(db(), eventId, false)
  if (!seats) return { error: '이벤트를 찾지 못했어요.' }
  return { rows: classifyRows(parsed.rows, seats.registered, seats.seatsLeft), capacity: seats.capacity, seatsLeft: Math.max(0, seats.seatsLeft) }
}

export async function commitImport(eventIdRaw: string, text: string): Promise<{ ok: boolean; message: string }> {
  const auth = await requireManager()
  if (!auth.ok) return { ok: false, message: auth.message }
  const eventId = idOf(eventIdRaw)
  if (!eventId) return { ok: false, message: BAD_REQUEST }
  const parsed = parseText(text)
  if ('error' in parsed) return { ok: false, message: parsed.error }
  const result = await addRows(eventId, parsed.rows)
  if (!result) return { ok: false, message: '이벤트를 찾지 못했어요.' }
  refresh(eventId)

  const count = (s: ClassifiedRow['status']) => result.classified.filter((r) => r.status === s).length
  const skipped = [
    count('registered') && `이미 신청 ${count('registered')}건`,
    count('duplicate') && `파일 안 중복 ${count('duplicate')}건`,
    count('invalid') && `입력 오류 ${count('invalid')}건`,
    count('full') && `정원 초과 ${count('full')}건`,
  ].filter(Boolean)
  return {
    ok: result.added > 0,
    message: `${result.added}명을 등록했어요.` + (skipped.length ? ` 건너뜀: ${skipped.join(' · ')}.` : ''),
  }
}
