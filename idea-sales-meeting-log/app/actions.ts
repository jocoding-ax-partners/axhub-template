'use server'

// 저장·수정·삭제는 전부 여기 (Server Action). 브라우저 검사(required·maxLength)는 편의일 뿐이라
// 모든 값을 서버에서 다시 검사하고, 권한도 SQL 조건으로 한 번 더 확인해요.
//
// 권한
//   - 로그인한 사람은 모두 고객사를 보고, 등록하고, 미팅 기록을 남길 수 있어요.
//   - 고객사 정보 수정·고객사 삭제: 담당자(등록한 사람) 또는 앱 관리자
//   - 미팅 기록 삭제: 기록을 남긴 사람, 그 고객사 담당자, 또는 앱 관리자

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db, ensureSchema } from '@/lib/db'
import { isValidDate } from '@/lib/dates'
import { currentUser, type CurrentUser } from '@/lib/user'

/** 폼 결과. errors 는 칸별 안내, values 는 오류가 나도 입력한 내용을 지키려고 돌려줘요. */
export type FormState = {
  ok?: boolean
  message?: string
  errors?: Record<string, string>
  values?: Record<string, string>
}

const LIMITS = {
  name: 100,
  contact_name: 50,
  contact_info: 100,
  attendees: 200,
  notes: 5000,
  next_action: 500,
} as const

type Field = keyof typeof LIMITS

function read(form: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? '').trim()]))
}

function checkLengths(values: Record<string, string>, errors: Record<string, string>) {
  for (const [k, max] of Object.entries(LIMITS)) {
    if (k in values && values[k].length > max) errors[k] = `${max}자 이내로 적어 주세요.`
  }
}

/** 로그인 · id 확인 — 예상된 실패는 throw 하지 않고 메시지로 돌려줘요 (운영에선 throw 메시지가 가려져요). */
async function guard(form: FormData, keys: string[]): Promise<{ user: CurrentUser; ids: string[] } | FormState> {
  const user = await currentUser()
  if (!user) return { message: '로그인이 필요해요.' }
  const ids = keys.map((k) => String(form.get(k) ?? ''))
  if (!ids.every((v) => /^\d{1,18}$/.test(v))) return { message: '잘못된 요청이에요.' }
  await ensureSchema()
  return { user, ids }
}

const COMPANY_FIELDS: Field[] = ['name', 'contact_name', 'contact_info']

function validateCompany(values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.name) errors.name = '회사명을 입력해 주세요.'
  checkLengths(values, errors)
  return errors
}

export async function createCompany(_prev: FormState, form: FormData): Promise<FormState> {
  const values = read(form, COMPANY_FIELDS)
  const g = await guard(form, [])
  if (!('user' in g)) return { ...g, values }
  const { user } = g
  const errors = validateCompany(values)
  if (Object.keys(errors).length) return { errors, values }

  const [row] = await db()<{ id: string }[]>`
    INSERT INTO companies (name, contact_name, contact_info, owner_key, owner_name)
    VALUES (${values.name}, ${values.contact_name}, ${values.contact_info}, ${user.key}, ${user.name})
    RETURNING id::text`
  revalidatePath('/')
  redirect(`/companies/${row.id}`)
}

export async function updateCompany(_prev: FormState, form: FormData): Promise<FormState> {
  const values = read(form, COMPANY_FIELDS)
  const g = await guard(form, ['id'])
  if (!('user' in g)) return { ...g, values }
  const { user, ids: [id] } = g
  const errors = validateCompany(values)
  if (Object.keys(errors).length) return { errors, values }

  const rows = await db()`
    UPDATE companies
    SET name = ${values.name}, contact_name = ${values.contact_name}, contact_info = ${values.contact_info}
    WHERE id = ${id} AND (${user.admin} OR owner_key = ${user.key})
    RETURNING id`
  if (rows.length === 0) return { message: '고칠 권한이 없거나 이미 지워진 고객사예요.', values }
  revalidatePath('/')
  revalidatePath(`/companies/${id}`)
  return { ok: true, message: '저장했어요.', values }
}

export async function deleteCompany(_prev: FormState, form: FormData): Promise<FormState> {
  const g = await guard(form, ['id'])
  if (!('user' in g)) return g
  const { user, ids: [id] } = g
  const rows = await db()`
    DELETE FROM companies WHERE id = ${id} AND (${user.admin} OR owner_key = ${user.key}) RETURNING id`
  if (rows.length === 0) return { message: '지울 권한이 없거나 이미 지워진 고객사예요.' }
  revalidatePath('/')
  redirect('/')
}

const MEETING_FIELDS = ['met_on', 'attendees', 'notes', 'next_action', 'next_contact_on']

export async function createMeeting(_prev: FormState, form: FormData): Promise<FormState> {
  const values = read(form, MEETING_FIELDS)
  const g = await guard(form, ['company_id'])
  if (!('user' in g)) return { ...g, values }
  const { user, ids: [companyId] } = g

  const errors: Record<string, string> = {}
  if (!values.met_on) errors.met_on = '미팅 날짜를 골라 주세요.'
  else if (!isValidDate(values.met_on)) errors.met_on = '날짜 형식이 맞지 않아요.'
  if (!values.notes) errors.notes = '미팅 내용을 적어 주세요.'
  if (values.next_contact_on) {
    if (!isValidDate(values.next_contact_on)) errors.next_contact_on = '날짜 형식이 맞지 않아요.'
    else if (!errors.met_on && values.next_contact_on < values.met_on)
      errors.next_contact_on = '다음 연락일은 미팅 날짜와 같거나 그 뒤여야 해요.'
  }
  checkLengths(values, errors)
  if (Object.keys(errors).length) return { errors, values }

  // 고객사가 그사이 지워졌으면 아무것도 넣지 않아요 (WHERE EXISTS).
  const rows = await db()`
    INSERT INTO meetings (company_id, met_on, attendees, notes, next_action, next_contact_on, author_key, author_name)
    SELECT ${companyId}, ${values.met_on}::date, ${values.attendees}, ${values.notes}, ${values.next_action},
           ${values.next_contact_on || null}::date, ${user.key}, ${user.name}
    WHERE EXISTS (SELECT 1 FROM companies WHERE id = ${companyId})
    RETURNING id`
  if (rows.length === 0) return { message: '이미 지워진 고객사예요.', values }
  revalidatePath('/')
  revalidatePath(`/companies/${companyId}`)
  // 성공하면 칸을 비워요 — 미팅 날짜만 그대로 둬요.
  return { ok: true, message: '미팅 기록을 남겼어요.', values: { met_on: values.met_on } }
}

export async function deleteMeeting(_prev: FormState, form: FormData): Promise<FormState> {
  const g = await guard(form, ['id', 'company_id'])
  if (!('user' in g)) return g
  const { user, ids: [id, companyId] } = g
  const rows = await db()`
    DELETE FROM meetings m
    USING companies c
    WHERE m.id = ${id} AND m.company_id = ${companyId} AND c.id = m.company_id
      AND (${user.admin} OR m.author_key = ${user.key} OR c.owner_key = ${user.key})
    RETURNING m.id`
  if (rows.length === 0) return { message: '지울 권한이 없거나 이미 지워진 기록이에요.' }
  revalidatePath('/')
  revalidatePath(`/companies/${companyId}`)
  return { ok: true }
}
