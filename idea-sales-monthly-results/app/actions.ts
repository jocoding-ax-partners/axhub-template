'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·권한과 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatMonth, validateContract } from '@/lib/sales'
import { createContract, deleteContract as removeContract } from '@/lib/sales-store'

export type FormState = { ok: boolean; message: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const fail = (message: string): FormState => ({ ok: false, message })

export async function addContract(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return fail('로그인한 뒤 입력할 수 있어요.')
  if (!isDbConfigured()) return fail('아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.')

  const checked = validateContract({
    date: String(form.get('contract_date') ?? ''),
    customer: String(form.get('customer') ?? ''),
    amount: String(form.get('amount') ?? ''),
  })
  if (!checked.ok) return fail(checked.error)

  try {
    await createContract({ userKey: visitor.user_id, name: visitor.name || visitor.email, email: visitor.email }, checked.value)
  } catch {
    return fail(SAVE_FAILED)
  }
  revalidatePath('/')
  revalidatePath('/contracts')
  return { ok: true, message: `${formatMonth(checked.value.date.slice(0, 7))} 실적에 더했어요.` }
}

export async function deleteContract(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return fail('로그인한 뒤 지울 수 있어요.')
  const id = String(form.get('id') ?? '')
  if (!/^\d{1,18}$/.test(id)) return fail('잘못된 계약이에요. 화면을 새로고침해 주세요.')

  try {
    const problem = await removeContract(id, visitor)
    if (problem) return fail(problem)
  } catch {
    return fail(SAVE_FAILED)
  }
  revalidatePath('/')
  revalidatePath('/contracts')
  return { ok: true, message: '지웠어요.' }
}
