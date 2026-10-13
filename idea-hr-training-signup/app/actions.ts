'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·관리자 여부와 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { isManager, validateTraining, type TrainingInput } from '@/lib/training'
import * as store from '@/lib/training-store'

export type FormState = {
  ok?: boolean
  message?: string
  /** 칸별 오류 문구 — 폼이 그 칸 아래에 보여줘요. */
  fieldErrors?: Record<string, string>
  /** 실패했을 때 입력값을 그대로 돌려줘 다시 채워요. */
  values?: Record<string, string>
}

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const NO_DB = '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.'
const BAD_ID = '잘못된 교육이에요. 화면을 새로고침해 주세요.'

function refresh(id?: string) {
  revalidatePath('/')
  revalidatePath('/admin')
  if (id) revalidatePath(`/admin/${id}`)
}

// ── 직원: 신청 · 취소 ────────────────────────────────────────────────────────

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 신청할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const id = String(form.get('id') ?? '')
  if (!store.isId(id)) return { ok: false, message: BAD_ID }
  try {
    const problem = await store.signUp(id, { userKey: visitor.user_id, name: visitor.name || visitor.email, email: visitor.email })
    if (problem) {
      refresh(id) // 마감·시작처럼 화면이 낡아서 생긴 문제면 새 상태를 보여줘요.
      return { ok: false, message: problem }
    }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh(id)
  return { ok: true, message: '신청했어요.' }
}

export async function cancelSignup(_prev: FormState, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 취소할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const id = String(form.get('id') ?? '')
  if (!store.isId(id)) return { ok: false, message: BAD_ID }
  try {
    const problem = await store.cancelSignup(id, visitor.user_id)
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh(id)
  return { ok: true, message: '신청을 취소했어요.' }
}

// ── 관리자: 교육 등록 · 수정 · 삭제 ──────────────────────────────────────────

/** 등록(id 없음)과 수정(id 있음)을 같이 맡아요. */
export async function saveTraining(_prev: FormState, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isManager(visitor)) return { ok: false, message: '관리자만 교육을 등록·수정할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }

  const id = String(form.get('id') ?? '')
  if (id && !store.isId(id)) return { ok: false, message: BAD_ID }
  const input: TrainingInput = {
    title: String(form.get('title') ?? ''),
    description: String(form.get('description') ?? ''),
    starts_at: String(form.get('starts_at') ?? ''),
    location: String(form.get('location') ?? ''),
    capacity: String(form.get('capacity') ?? ''),
  }
  const checked = validateTraining(input, { isNew: !id })
  if (!checked.ok) return { ok: false, message: '빨간 칸을 확인해 주세요.', fieldErrors: checked.errors, values: input }

  try {
    if (id) {
      const problem = await store.updateTraining(id, checked.value)
      if (problem) return { ok: false, message: problem, values: input }
    } else {
      await store.createTraining(checked.value, visitor.name || visitor.email)
    }
  } catch {
    return { ok: false, message: SAVE_FAILED, values: input }
  }
  refresh(id || undefined)
  // 수정은 고친 값을 그대로 두고, 등록은 칸을 비워 다음 교육을 바로 적게 해요.
  return id ? { ok: true, message: '교육 정보를 고쳤어요.', values: input } : { ok: true, message: `"${checked.value.title}" 교육을 등록했어요.` }
}

export async function deleteTraining(_prev: FormState, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isManager(visitor)) return { ok: false, message: '관리자만 교육을 지울 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const id = String(form.get('id') ?? '')
  if (!store.isId(id)) return { ok: false, message: BAD_ID }
  try {
    const problem = await store.deleteTraining(id)
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  redirect('/admin')
}
