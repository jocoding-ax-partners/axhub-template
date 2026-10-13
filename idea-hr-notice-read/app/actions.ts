'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·관리자 여부와 입력값을 여기서 다시 확인해요.
// 예상된 실패는 throw 하지 않고 { ok:false, message } 로 돌려줘요 (운영에선 throw 메시지가 가려져요).
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { me, type AxhubMe } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { isManager, isNoticeId, validateNotice } from '@/lib/notice'
import { confirmRead as saveRead, createNotice as saveNotice, deleteNotice as removeNotice } from '@/lib/notice-store'

/** 폼 결과. errors 는 칸별 안내, values 는 오류가 나도 입력한 내용을 지키려고 돌려줘요. */
export type FormState = {
  ok?: boolean
  message?: string
  errors?: Record<string, string>
  values?: Record<string, string>
}

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const NO_DB = '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.'

const person = (v: AxhubMe) => ({ userKey: v.user_id, name: v.name || v.email, email: v.email })

export async function createNotice(_prev: FormState, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isManager(visitor)) return { ok: false, message: '관리자만 공지를 올릴 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }

  const values = {
    title: String(form.get('title') ?? ''),
    body: String(form.get('body') ?? ''),
    important: form.get('important') ? 'on' : '',
  }
  const checked = validateNotice(values)
  if (!checked.ok) return { ok: false, message: '빨간 안내를 확인해 주세요.', errors: checked.errors, values }

  try {
    await saveNotice(person(visitor), checked.value)
  } catch {
    return { ok: false, message: SAVE_FAILED, values }
  }
  revalidatePath('/')
  revalidatePath('/admin')
  return { ok: true, message: '공지를 올렸어요. 직원 목록 맨 위에 보여요.' }
}

export async function confirmRead(_prev: FormState, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 확인할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const id = String(form.get('id') ?? '')
  if (!isNoticeId(id)) return { ok: false, message: '잘못된 공지예요. 화면을 새로고침해 주세요.' }

  try {
    if (!(await saveRead(id, person(visitor)))) return { ok: false, message: '지워진 공지예요. 목록으로 돌아가 주세요.' }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/')
  revalidatePath(`/notices/${id}`)
  revalidatePath('/admin', 'layout')
  return { ok: true, message: '확인했어요.' }
}

export async function deleteNotice(_prev: FormState, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isManager(visitor)) return { ok: false, message: '관리자만 공지를 지울 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const id = String(form.get('id') ?? '')
  if (!isNoticeId(id)) return { ok: false, message: '잘못된 공지예요. 화면을 새로고침해 주세요.' }

  try {
    if (!(await removeNotice(id))) return { ok: false, message: '이미 지워진 공지예요.' }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/')
  revalidatePath('/admin', 'layout')
  // redirect 는 try 밖에서 — 안에 두면 catch 가 이동 신호를 삼켜요.
  redirect('/admin')
}
