'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·관리자 여부와 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { me, type AxhubMe } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { NOTE_MAX, STOCK_MAX, formatCount, isAdmin, isId, parseCount, validateRequest, validateSupply } from '@/lib/supply'
import { createRequest, createSupply, decideRequest as saveDecision, receiveStock as addStock, updateSupply } from '@/lib/supply-store'

export type FormState = { ok: boolean; message: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const NO_DB = '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.'
const BAD_ID = '잘못된 요청이에요. 화면을 새로고침해 주세요.'

const text = (form: FormData, key: string) => String(form.get(key) ?? '')

/** 관리자만 할 수 있는 동작의 공통 확인. 통과하면 방문자, 아니면 보여 줄 문구. */
async function adminOnly(): Promise<AxhubMe | FormState> {
  const visitor = await me()
  if (!isAdmin(visitor)) return { ok: false, message: '관리자만 할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  return visitor
}

function refresh() {
  revalidatePath('/')
  revalidatePath('/my')
  revalidatePath('/admin')
  revalidatePath('/supplies')
}

export async function addSupply(_prev: FormState | null, form: FormData): Promise<FormState> {
  const who = await adminOnly()
  if ('ok' in who) return who
  const checked = validateSupply({ name: text(form, 'name'), stock: text(form, 'stock'), minStock: text(form, 'min_stock') })
  if (!checked.ok) return { ok: false, message: checked.error }
  try {
    const problem = await createSupply(checked.value)
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  return { ok: true, message: `${checked.value.name}을(를) 등록했어요.` }
}

export async function editSupply(_prev: FormState | null, form: FormData): Promise<FormState> {
  const who = await adminOnly()
  if ('ok' in who) return who
  const id = text(form, 'id')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  const checked = validateSupply({ name: text(form, 'name'), stock: '0', minStock: text(form, 'min_stock') }, false)
  if (!checked.ok) return { ok: false, message: checked.error }
  try {
    const problem = await updateSupply(id, checked.value)
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  return { ok: true, message: '고쳤어요.' }
}

export async function receiveStock(_prev: FormState | null, form: FormData): Promise<FormState> {
  const who = await adminOnly()
  if ('ok' in who) return who
  const id = text(form, 'id')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  const qty = parseCount(text(form, 'qty'), 1, STOCK_MAX)
  if (qty === null) return { ok: false, message: '입고 수량을 1 이상 숫자로 적어 주세요.' }
  try {
    const r = await addStock(id, qty)
    if ('error' in r) return { ok: false, message: r.error }
    refresh()
    return { ok: true, message: `${r.name} ${formatCount(qty)}개를 입고했어요. 지금 재고 ${formatCount(r.stock)}개예요.` }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
}

export async function requestSupply(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 신청할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const id = text(form, 'supply_id')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  const checked = validateRequest({ qty: text(form, 'qty'), note: text(form, 'note') })
  if (!checked.ok) return { ok: false, message: checked.error }
  try {
    const problem = await createRequest({ userKey: visitor.user_id, name: visitor.name || visitor.email, email: visitor.email }, id, checked.value)
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  return { ok: true, message: '신청했어요. 관리자가 지급하면 내 신청에서 상태가 바뀌어요.' }
}

export async function decideRequest(_prev: FormState | null, form: FormData): Promise<FormState> {
  const who = await adminOnly()
  if ('ok' in who) return who
  const id = text(form, 'id')
  const decision = text(form, 'decision')
  const rejectReason = text(form, 'reject_reason').trim()
  if (!isId(id)) return { ok: false, message: BAD_ID }
  if (decision !== 'issued' && decision !== 'rejected') return { ok: false, message: '지급 또는 반려를 눌러 주세요.' }
  if (decision === 'rejected' && !rejectReason) return { ok: false, message: '반려 사유를 적어 주세요.' }
  if (rejectReason.length > NOTE_MAX) return { ok: false, message: `반려 사유는 ${NOTE_MAX}자 안으로 적어 주세요.` }
  try {
    const problem = await saveDecision(id, decision, decision === 'rejected' ? rejectReason : null, {
      userKey: who.user_id,
      name: who.name || who.email,
    })
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  return { ok: true, message: decision === 'issued' ? '지급했어요. 재고에서 빠졌어요.' : '반려했어요.' }
}
