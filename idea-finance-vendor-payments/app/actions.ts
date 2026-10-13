'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·관리자 여부와 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { isManager, kstToday, validatePaidDate, validatePayment } from '@/lib/payment'
import * as store from '@/lib/payment-store'

export type FormState = { ok: boolean; message: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const BAD_ID = '잘못된 지급 건이에요. 화면을 새로고침해 주세요.'

/** 로그인·DB 확인 후 지금 사람을 돌려줘요. 안 되면 보여 줄 문구. */
async function actor(): Promise<store.Actor | string> {
  const visitor = await me()
  if (!visitor.authenticated) return '로그인한 뒤 할 수 있어요.'
  if (!isDbConfigured()) return '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.'
  return { userKey: visitor.user_id, name: visitor.name || visitor.email, manager: isManager(visitor) }
}

function idOf(form: FormData): string | null {
  const id = String(form.get('id') ?? '')
  return /^\d{1,18}$/.test(id) ? id : null
}

function paymentOf(form: FormData) {
  return validatePayment({
    vendor: String(form.get('vendor') ?? ''),
    amount: String(form.get('amount') ?? ''),
    dueDate: String(form.get('due_date') ?? ''),
    memo: String(form.get('memo') ?? ''),
  })
}

/** 홈 · 지급 일정 · 거래처 화면을 모두 새로 그려요. */
function refresh() {
  revalidatePath('/', 'layout')
}

/** 실행 → 문제 문구가 있으면 실패, 없으면 성공. DB 오류는 일반 문구로 바꿔요 (DB 주소·쿼리가 새지 않게). */
async function run(work: () => Promise<string | null | void>, success: string): Promise<FormState> {
  try {
    const problem = await work()
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  return { ok: true, message: success }
}

export async function createPayment(_prev: FormState | null, form: FormData): Promise<FormState> {
  const who = await actor()
  if (typeof who === 'string') return { ok: false, message: who }
  const checked = paymentOf(form)
  if (!checked.ok) return { ok: false, message: checked.error }
  return run(() => store.createPayment(who, checked.value), `${checked.value.vendor} 지급 건을 등록했어요.`)
}

export async function updatePayment(_prev: FormState | null, form: FormData): Promise<FormState> {
  const who = await actor()
  if (typeof who === 'string') return { ok: false, message: who }
  const id = idOf(form)
  if (!id) return { ok: false, message: BAD_ID }
  const checked = paymentOf(form)
  if (!checked.ok) return { ok: false, message: checked.error }
  return run(() => store.updatePayment(id, checked.value, who), '고쳤어요.')
}

export async function deletePayment(_prev: FormState | null, form: FormData): Promise<FormState> {
  const who = await actor()
  if (typeof who === 'string') return { ok: false, message: who }
  const id = idOf(form)
  if (!id) return { ok: false, message: BAD_ID }
  return run(() => store.deletePayment(id, who), '지웠어요.')
}

export async function markPaid(_prev: FormState | null, form: FormData): Promise<FormState> {
  const who = await actor()
  if (typeof who === 'string') return { ok: false, message: who }
  if (!who.manager) return { ok: false, message: '지급 처리는 관리자만 할 수 있어요.' }
  const id = idOf(form)
  if (!id) return { ok: false, message: BAD_ID }
  const paid = validatePaidDate(String(form.get('paid_date') ?? ''), kstToday())
  if (!paid.ok) return { ok: false, message: paid.error }
  return run(() => store.markPaid(id, paid.value, who), '지급 완료로 기록했어요.')
}

export async function cancelPaid(_prev: FormState | null, form: FormData): Promise<FormState> {
  const who = await actor()
  if (typeof who === 'string') return { ok: false, message: who }
  if (!who.manager) return { ok: false, message: '지급 취소는 관리자만 할 수 있어요.' }
  const id = idOf(form)
  if (!id) return { ok: false, message: BAD_ID }
  return run(() => store.cancelPaid(id), '지급 완료를 취소했어요. 다시 미지급으로 보여요.')
}
