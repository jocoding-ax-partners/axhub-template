'use server'

// 경비 쓰기 (Server Action). 모든 함수가 먼저 로그인·권한을 확인하고, 입력값을 서버에서 다시 검사해요.
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { me } from '@/lib/axhub-server'
import { db, ensureSchema, isDbConfigured } from '@/lib/db'
import {
  MAX_RECEIPT_BYTES,
  RECEIPT_BAD_TYPE,
  RECEIPT_TOO_BIG,
  parseExpenseInput,
  sniffImageType,
  todayKst,
} from '@/lib/expense-utils'
import { isAppAdmin } from '@/lib/expenses'
import { deleteFile, isStorageConfigured, putFile } from '@/lib/storage'

export type FormState = { ok: boolean; message: string; at: number }

const fail = (message: string): FormState => ({ ok: false, message, at: Date.now() })

// 경비 올리기 — 로그인한 사람 누구나. 영수증 사진은 선택이에요.
export async function createExpense(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await me()
  if (!user.authenticated) return fail('로그인이 풀렸어요. 새로고침한 뒤 다시 로그인해 주세요.')
  if (!isDbConfigured()) return fail('아직 데이터를 저장할 곳이 연결되지 않았어요. 관리자에게 알려 주세요.')

  const parsed = parseExpenseInput(
    { spent_on: form.get('spent_on'), category: form.get('category'), amount: form.get('amount'), memo: form.get('memo') },
    todayKst(),
  )
  if (!parsed.ok) return fail(parsed.error)
  const { spentOn, category, amount, memo } = parsed.value

  let receiptKey: string | null = null
  const file = form.get('receipt')
  if (file instanceof File && file.size > 0) {
    if (!isStorageConfigured()) return fail('영수증 사진을 저장할 곳이 아직 켜지지 않았어요. 사진 없이 올려 주세요.')
    if (file.size > MAX_RECEIPT_BYTES) return fail(RECEIPT_TOO_BIG)
    const bytes = new Uint8Array(await file.arrayBuffer())
    const type = sniffImageType(bytes)
    if (!type) return fail(RECEIPT_BAD_TYPE)
    // 경로에 사용자 입력(파일 이름)을 쓰지 않아요.
    receiptKey = `receipts/${randomUUID()}.${type.split('/')[1]}`
    try {
      await putFile(receiptKey, bytes, type)
    } catch {
      return fail('영수증 사진을 올리지 못했어요. 잠시 뒤 다시 시도해 주세요.')
    }
  }

  try {
    await ensureSchema()
    await db()`
      INSERT INTO expenses (user_id, user_name, user_email, spent_on, category, amount, memo, receipt_key)
      VALUES (${user.user_id}, ${user.name}, ${user.email}, ${spentOn}, ${category}, ${amount}, ${memo}, ${receiptKey})`
  } catch {
    // 저장에 실패하면 먼저 올린 사진도 지워서 주인 없는 파일을 남기지 않아요.
    if (receiptKey) await deleteFile(receiptKey).catch(() => {})
    return fail('저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
  }

  revalidatePath('/')
  revalidatePath('/admin')
  return { ok: true, message: '경비를 올렸어요. 관리자가 확인하면 상태가 바뀌어요.', at: Date.now() }
}

// 아래 두 액션은 예상되는 실패(권한 없음 · 이미 처리됨 · 잘못된 요청)를 throw 하지 않고 FormState 로 돌려줘요.
// 배포본에서는 throw 한 메시지가 가려져 "문제가 생겼어요" 만 보이기 때문이에요. 화면은 components/ActionForm.tsx 가 보여 줘요.

// 내 경비 지우기 — 본인 것만, 아직 승인되지 않은 것(대기·반려)만.
export async function deleteExpense(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await me()
  if (!user.authenticated) return fail('로그인이 풀렸어요. 새로고침한 뒤 다시 로그인해 주세요.')
  const id = String(form.get('id') ?? '')
  if (!/^\d{1,18}$/.test(id)) return fail('잘못된 요청이에요. 새로고침한 뒤 다시 시도해 주세요.')

  try {
    await ensureSchema()
    const [row] = await db()<{ receipt_key: string | null }[]>`
      DELETE FROM expenses
      WHERE id = ${id} AND user_id = ${user.user_id} AND status <> 'approved'
      RETURNING receipt_key`
    if (!row) {
      revalidatePath('/')
      return fail('지울 수 없어요. 이미 지웠거나 그사이 승인된 경비예요.')
    }
    if (row.receipt_key) await deleteFile(row.receipt_key).catch(() => {})
  } catch {
    return fail('지우지 못했어요. 잠시 뒤 다시 시도해 주세요.')
  }
  revalidatePath('/')
  revalidatePath('/admin')
  return { ok: true, message: '지웠어요.', at: Date.now() }
}

// 승인 · 반려 — 관리자만, 본인 경비는 안 돼요(스스로 승인 방지).
// from = 버튼을 누를 때 화면에 보이던 상태. 그사이 다른 관리자가 바꿨으면 덮어쓰지 않고 알려 줘요.
// 이미 결정된 경비를 바꾸는 건 화면에서 한 번 더 묻고, 누가·언제 마지막으로 정했는지 reviewer_name · reviewed_at 에 남겨요.
export async function reviewExpense(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await me()
  if (!isAppAdmin(admin)) return fail('관리자만 승인하거나 반려할 수 있어요.')
  const id = String(form.get('id') ?? '')
  const status = String(form.get('status') ?? '')
  const from = String(form.get('from') ?? '')
  const valid = (s: string) => s === 'pending' || s === 'approved' || s === 'rejected'
  if (!/^\d{1,18}$/.test(id) || (status !== 'approved' && status !== 'rejected') || !valid(from) || from === status) {
    return fail('잘못된 요청이에요. 새로고침한 뒤 다시 시도해 주세요.')
  }

  try {
    await ensureSchema()
    const [done] = await db()<{ id: string }[]>`
      UPDATE expenses
      SET status = ${status}, reviewed_by = ${admin.user_id}, reviewer_name = ${admin.name || admin.email}, reviewed_at = now()
      WHERE id = ${id} AND user_id <> ${admin.user_id} AND status = ${from}
      RETURNING id::text`
    if (!done) {
      // 왜 안 됐는지 골라서 알려 줘요.
      const [row] = await db()<{ user_id: string }[]>`SELECT user_id FROM expenses WHERE id = ${id}`
      revalidatePath('/admin')
      if (!row) return fail('경비를 찾을 수 없어요. 올린 사람이 지웠을 수 있어요.')
      if (row.user_id === admin.user_id) return fail('본인 경비는 직접 승인하거나 반려할 수 없어요. 다른 관리자에게 부탁해 주세요.')
      return fail('그사이 다른 관리자가 먼저 처리했어요. 화면을 새로 고쳐 확인해 주세요.')
    }
  } catch {
    return fail('처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
  }
  revalidatePath('/')
  revalidatePath('/admin')
  return { ok: true, message: status === 'approved' ? '승인했어요.' : '반려했어요.', at: Date.now() }
}
