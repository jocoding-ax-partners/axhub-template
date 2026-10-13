'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·관리자 여부와 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { REJECT_REASON_MAX, isApprover, isHighValue, validatePurchase, won } from '@/lib/purchase'
import { createPurchase as savePurchase, decidePurchase as saveDecision } from '@/lib/purchase-store'

export type FormState = { ok: boolean; message: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'

export async function submitPurchase(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 요청할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.' }

  const checked = validatePurchase({
    item: String(form.get('item') ?? ''),
    quantity: String(form.get('quantity') ?? ''),
    unitPrice: String(form.get('unit_price') ?? ''),
    reason: String(form.get('reason') ?? ''),
  })
  if (!checked.ok) return { ok: false, message: checked.error }

  try {
    await savePurchase({ userKey: visitor.user_id, name: visitor.name || visitor.email, email: visitor.email }, checked.value)
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/')
  revalidatePath('/admin')
  const { total } = checked.value
  return { ok: true, message: `요청을 올렸어요 (총 ${won(total)}${isHighValue(total) ? ' · 고액' : ''}). 관리자가 처리하면 상태가 바뀌어요.` }
}

export async function decidePurchase(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isApprover(visitor)) return { ok: false, message: '관리자만 승인·반려할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: '아직 데이터베이스가 연결되지 않았어요.' }

  const id = String(form.get('id') ?? '')
  const decision = String(form.get('decision') ?? '')
  const rejectReason = String(form.get('reject_reason') ?? '').trim()

  if (!/^\d{1,18}$/.test(id)) return { ok: false, message: '잘못된 요청이에요. 화면을 새로고침해 주세요.' }
  if (decision !== 'approved' && decision !== 'rejected') return { ok: false, message: '승인 또는 반려를 눌러 주세요.' }
  if (decision === 'rejected' && !rejectReason) return { ok: false, message: '반려 사유를 적어 주세요.' }
  if (rejectReason.length > REJECT_REASON_MAX) return { ok: false, message: `반려 사유는 ${REJECT_REASON_MAX}자 안으로 적어 주세요.` }

  try {
    const problem = await saveDecision(id, decision, decision === 'rejected' ? rejectReason : null, {
      userKey: visitor.user_id,
      name: visitor.name || visitor.email,
    })
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/admin')
  revalidatePath('/')
  return { ok: true, message: decision === 'approved' ? '승인했어요.' : '반려했어요.' }
}
