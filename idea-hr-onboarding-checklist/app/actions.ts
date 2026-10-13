'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·관리자 여부와 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { me, type AxhubMe } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { MEMO_MAX, isAdmin, validateHire, validateTitle } from '@/lib/onboarding'
import * as store from '@/lib/onboarding-store'

export type FormState = { ok: boolean; message: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const NO_DB = '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.'
const GONE = '이미 지워졌거나 없는 항목이에요. 화면을 새로고침해 주세요.'

/** 로그인했고 DB 가 있으면 방문자를, 아니면 보여 줄 문구를 돌려줘요. */
async function signedIn(): Promise<AxhubMe | FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 이용할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  return visitor
}

const isState = (v: AxhubMe | FormState): v is FormState => 'ok' in v
const actorOf = (v: AxhubMe) => ({ userKey: v.user_id, name: v.name || v.email })
const idOf = (form: FormData, key = 'id') => {
  const v = String(form.get(key) ?? '')
  return /^\d{1,18}$/.test(v) ? v : null
}
const hireInput = (form: FormData) =>
  validateHire({
    name: String(form.get('name') ?? ''),
    department: String(form.get('department') ?? ''),
    startDate: String(form.get('start_date') ?? ''),
  })

export async function addHire(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await signedIn()
  if (isState(visitor)) return visitor
  const checked = hireInput(form)
  if (!checked.ok) return { ok: false, message: checked.error }

  let id: string
  try {
    id = await store.createHire(actorOf(visitor), checked.value)
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/')
  // 등록하면 바로 그 사람의 체크리스트 화면으로 가요.
  redirect(`/hires/${id}?created=1`)
}

export async function updateHire(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await signedIn()
  if (isState(visitor)) return visitor
  const id = idOf(form)
  if (!id) return { ok: false, message: GONE }
  const checked = hireInput(form)
  if (!checked.ok) return { ok: false, message: checked.error }

  try {
    if (!(await store.updateHire(id, checked.value))) return { ok: false, message: GONE }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/')
  revalidatePath(`/hires/${id}`)
  return { ok: true, message: '입사자 정보를 고쳤어요.' }
}

export async function deleteHire(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await signedIn()
  if (isState(visitor)) return visitor
  if (!isAdmin(visitor)) return { ok: false, message: '관리자만 입사자를 지울 수 있어요.' }
  const id = idOf(form)
  if (!id) return { ok: false, message: GONE }

  try {
    if (!(await store.deleteHire(id))) return { ok: false, message: GONE }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/')
  redirect('/?deleted=1')
}

export async function setItemDone(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await signedIn()
  if (isState(visitor)) return visitor
  const id = idOf(form)
  if (!id) return { ok: false, message: GONE }
  const done = String(form.get('done') ?? '')
  if (done !== 'true' && done !== 'false') return { ok: false, message: '완료 여부를 다시 눌러 주세요.' }

  let hireId: string | null
  try {
    hireId = await store.setItemDone(id, done === 'true', actorOf(visitor))
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  if (!hireId) return { ok: false, message: GONE }
  revalidatePath('/')
  revalidatePath(`/hires/${hireId}`)
  return { ok: true, message: done === 'true' ? '완료로 표시했어요.' : '완료 표시를 풀었어요.' }
}

export async function saveItemMemo(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await signedIn()
  if (isState(visitor)) return visitor
  const id = idOf(form)
  if (!id) return { ok: false, message: GONE }
  const memo = String(form.get('memo') ?? '').trim()
  if (memo.length > MEMO_MAX) return { ok: false, message: `메모는 ${MEMO_MAX}자 안으로 적어 주세요.` }

  let hireId: string | null
  try {
    hireId = await store.saveItemMemo(id, memo, actorOf(visitor))
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  if (!hireId) return { ok: false, message: GONE }
  revalidatePath(`/hires/${hireId}`)
  return { ok: true, message: memo ? '메모를 저장했어요.' : '메모를 지웠어요.' }
}

export async function addTemplate(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await signedIn()
  if (isState(visitor)) return visitor
  if (!isAdmin(visitor)) return { ok: false, message: '관리자만 기본 체크리스트를 바꿀 수 있어요.' }
  const checked = validateTitle(String(form.get('title') ?? ''))
  if (!checked.ok) return { ok: false, message: checked.error }

  try {
    const problem = await store.addTemplate(checked.value)
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/settings')
  return { ok: true, message: `"${checked.value}" 항목을 추가했어요.` }
}

export async function deleteTemplate(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await signedIn()
  if (isState(visitor)) return visitor
  if (!isAdmin(visitor)) return { ok: false, message: '관리자만 기본 체크리스트를 바꿀 수 있어요.' }
  const id = idOf(form)
  if (!id) return { ok: false, message: GONE }

  try {
    if (!(await store.deleteTemplate(id))) return { ok: false, message: GONE }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/settings')
  return { ok: true, message: '항목을 지웠어요.' }
}
