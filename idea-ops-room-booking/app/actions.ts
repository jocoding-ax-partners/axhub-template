'use server'

import { redirect } from 'next/navigation'
import { me } from '@/lib/axhub-server'
import { db, ensureSchema } from '@/lib/db'
import { isDay, isPast, toMin, validRange } from '@/lib/booking'
import type { ErrorCode, OkCode } from '@/components/Notice'

// 결과는 주소의 ?ok= / ?error= 에 코드로 돌려보내요 (화면의 <Notice> 가 코드를 정해진 문구로 바꿔 보여줘요).
type BackParams = Record<string, string> & { ok?: OkCode; error?: ErrorCode }
function back(path: string, params: BackParams): never {
  redirect(`${path}?${new URLSearchParams(params).toString()}`)
}

// 주소·폼으로 들어온 id 가 bigint 범위의 숫자인지
const isId = (v: string) => /^\d{1,18}$/.test(v)

// PostgreSQL 오류 코드 (postgres 라이브러리는 err.code 에 실어 줘요)
const pgCode = (e: unknown) => (e as { code?: string })?.code

/** 회의실 등록 — 관리자(앱 소유자·워크스페이스 관리자)만. */
export async function createRoom(form: FormData) {
  const visitor = await me()
  if (!visitor.is_admin) back('/rooms', { error: 'room_forbidden' })

  const name = String(form.get('name') ?? '').trim()
  const capacity = Number(form.get('capacity'))
  if (!name || name.length > 50) back('/rooms', { error: 'room_name' })
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000)
    back('/rooms', { error: 'room_capacity' })

  await ensureSchema()
  try {
    await db()`INSERT INTO rooms (name, capacity) VALUES (${name}, ${capacity})`
  } catch (e) {
    if (pgCode(e) === '23505') back('/rooms', { error: 'room_duplicate' })
    throw e
  }
  back('/rooms', { ok: 'room_created' })
}

/** 예약 — 로그인한 사람 누구나. 겹침은 DB 제약(bookings_no_overlap)이 막아요. */
export async function createBooking(form: FormData) {
  const visitor = await me()
  const day = String(form.get('day') ?? '')
  const room = String(form.get('room') ?? '')
  const startText = String(form.get('start') ?? '')
  const endText = String(form.get('end') ?? '')
  const title = String(form.get('title') ?? '').trim()
  const start = toMin(startText)
  const end = toMin(endText)
  // 오류가 나도 입력한 값이 폼에 그대로 남도록 함께 돌려보내요.
  const keep = { date: day, room, start: startText, end: endText, title: title.slice(0, 100) }

  if (!visitor.authenticated) back('/', { ...keep, error: 'login_to_book' })
  if (!isDay(day)) back('/', { error: 'bad_day' })
  if (!isId(room)) back('/', { date: day, error: 'bad_room' })
  if (!title || title.length > 100) back('/', { ...keep, error: 'bad_title' })
  if (!validRange(start, end))
    back('/', { ...keep, error: 'bad_range' })
  if (isPast(day, start)) back('/', { ...keep, error: 'past' })

  await ensureSchema()
  try {
    await db()`
      INSERT INTO bookings (room_id, user_key, user_name, title, day, start_min, end_min)
      VALUES (${room}, ${visitor.user_id}, ${visitor.name || visitor.email}, ${title}, ${day}, ${start}, ${end})`
  } catch (e) {
    const code = pgCode(e)
    if (code === '23P01')
      back('/', { ...keep, error: 'overlap' })
    if (code === '23503') back('/', { date: day, error: 'room_missing' })
    throw e
  }
  back('/', { date: day, ok: 'booked' })
}

/** 예약 취소 — 본인 예약만. */
export async function cancelBooking(form: FormData) {
  const visitor = await me()
  const id = String(form.get('id') ?? '')
  if (!visitor.authenticated) back('/my', { error: 'login_to_cancel' })
  if (!isId(id)) back('/my', { error: 'cancel_missing' })

  await ensureSchema()
  const rows = await db()`DELETE FROM bookings WHERE id = ${id} AND user_key = ${visitor.user_id} RETURNING id`
  back('/my', rows.length ? { ok: 'cancelled' } : { error: 'cancel_missing' })
}
