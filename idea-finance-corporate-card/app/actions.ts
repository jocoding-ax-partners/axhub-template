'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인 여부·본인 여부와 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { kstToday, validateExpense, validatePurpose } from '@/lib/card'
import { createExpense, deleteExpense as removeExpense, fillPurpose as savePurpose } from '@/lib/card-store'

export type FormState = { ok: boolean; message: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const NO_DB = '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.'
const BAD_ID = '잘못된 사용 건이에요. 화면을 새로고침해 주세요.'

const field = (form: FormData, key: string) => String(form.get(key) ?? '')
const isId = (id: string) => /^\d{1,18}$/.test(id)

function refresh() {
  revalidatePath('/')
  revalidatePath('/summary')
}

export async function addExpense(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 입력할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }

  const checked = validateExpense(
    {
      usedOn: field(form, 'used_on'),
      merchant: field(form, 'merchant'),
      amount: field(form, 'amount'),
      department: field(form, 'department'),
      purpose: field(form, 'purpose'),
    },
    kstToday(),
  )
  if (!checked.ok) return { ok: false, message: checked.error }

  try {
    await createExpense({ userKey: visitor.user_id, name: visitor.name || visitor.email, email: visitor.email }, checked.value)
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  return {
    ok: true,
    message: checked.value.purpose ? '저장했어요.' : '저장했어요. 용도는 목록에서 나중에 채울 수 있어요.',
  }
}

export async function fillPurpose(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 채울 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const id = field(form, 'id')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  const checked = validatePurpose(field(form, 'purpose'))
  if (!checked.ok) return { ok: false, message: checked.error }

  try {
    const problem = await savePurpose(visitor.user_id, id, checked.value)
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  return { ok: true, message: '용도를 적었어요.' }
}

export async function deleteExpense(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 지울 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const id = field(form, 'id')
  if (!isId(id)) return { ok: false, message: BAD_ID }

  try {
    const problem = await removeExpense(visitor.user_id, id)
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  return { ok: true, message: '지웠어요.' }
}
