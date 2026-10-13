'use server'

// 화면의 폼·버튼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·권한과 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { me, type AxhubMe } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { isManager, isStage, validateDeal } from '@/lib/pipeline'
import {
  createDeal as insertDeal,
  deleteDeal as removeDeal,
  moveDeal as saveMove,
  updateDeal as saveDeal,
} from '@/lib/pipeline-store'

export type FormState = { ok: boolean; message: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const BAD_ID = '잘못된 거래예요. 화면을 새로고침해 주세요.'

/** 쓰기 전에 공통으로 확인 — 문제가 있으면 문구를, 없으면 방문자를 돌려줘요. */
async function writer(): Promise<AxhubMe | string> {
  const visitor = await me()
  if (!visitor.authenticated) return '로그인한 뒤 쓸 수 있어요.'
  if (!isDbConfigured()) return '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.'
  return visitor
}

const who = (v: AxhubMe) => ({ userKey: v.user_id, name: v.name || v.email })
const validId = (id: string) => /^\d{1,18}$/.test(id)

function readDeal(form: FormData) {
  return validateDeal({
    company: String(form.get('company') ?? ''),
    amount: String(form.get('amount') ?? ''),
    owner: String(form.get('owner') ?? ''),
    expectedClose: String(form.get('expected_close') ?? ''),
    stage: String(form.get('stage') ?? ''),
  })
}

function refresh(id?: string) {
  revalidatePath('/')
  revalidatePath('/deals')
  if (id) revalidatePath(`/deals/${id}`)
}

export async function createDeal(_prev: FormState | null, form: FormData): Promise<FormState> {
  const v = await writer()
  if (typeof v === 'string') return { ok: false, message: v }
  const checked = readDeal(form)
  if (!checked.ok) return { ok: false, message: checked.error }
  try {
    await insertDeal(who(v), checked.value)
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  return { ok: true, message: `${checked.value.company} 거래를 추가했어요.` }
}

export async function updateDeal(_prev: FormState | null, form: FormData): Promise<FormState> {
  const v = await writer()
  if (typeof v === 'string') return { ok: false, message: v }
  const id = String(form.get('id') ?? '')
  const seen = String(form.get('updated_at') ?? '')
  if (!validId(id) || Number.isNaN(Date.parse(seen))) return { ok: false, message: BAD_ID }
  const checked = readDeal(form)
  if (!checked.ok) return { ok: false, message: checked.error }
  try {
    const problem = await saveDeal(id, seen, checked.value, who(v))
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh(id)
  return { ok: true, message: '저장했어요.' }
}

/** 보드에서 카드 옮기기 (버튼 · 드래그). from 은 보드가 보고 있던 단계예요. */
export async function moveDeal(id: string, from: string, to: string): Promise<FormState> {
  const v = await writer()
  if (typeof v === 'string') return { ok: false, message: v }
  if (!validId(id) || !isStage(from) || !isStage(to)) return { ok: false, message: BAD_ID }
  if (from === to) return { ok: true, message: '' }
  try {
    const problem = await saveMove(id, from, to, who(v))
    refresh(id)
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  return { ok: true, message: '' }
}

export async function deleteDeal(id: string): Promise<FormState> {
  const v = await writer()
  if (typeof v === 'string') return { ok: false, message: v }
  if (!validId(id)) return { ok: false, message: BAD_ID }
  try {
    const problem = await removeDeal(id, v.user_id, isManager(v))
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  return { ok: true, message: '거래를 지웠어요.' }
}
