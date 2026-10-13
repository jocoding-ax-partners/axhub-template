'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·관리자 여부와 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { me, type AxhubMe } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import {
  isBudgetAdmin,
  kstToday,
  normalizeEmail,
  validateBudget,
  validateDepartmentName,
  validateExpense,
  validateManagerEmail,
} from '@/lib/budget'
import * as store from '@/lib/budget-store'

export type FormState = { ok: boolean; message: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const NO_DB = '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.'
const ADMIN_ONLY = '관리자만 할 수 있어요.'
const BAD_ID = '잘못된 요청이에요. 화면을 새로고침해 주세요.'

const isId = (v: string) => /^\d{1,18}$/.test(v)
const field = (form: FormData, name: string) => String(form.get(name) ?? '')

function actorOf(v: AxhubMe) {
  return { userKey: v.user_id, name: v.name || v.email, email: normalizeEmail(v.email), admin: isBudgetAdmin(v) }
}

/** DB 작업을 돌리고, 사용자에게 보여 줄 문구(problem)가 있으면 실패로 돌려줘요. */
async function run(work: () => Promise<string | null | void>, done: string): Promise<FormState> {
  try {
    const problem = await work()
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/', 'layout')
  return { ok: true, message: done }
}

// ── 집행 건 (부서 담당자 · 관리자) ─────────────────────────────────────────────

export async function addExpense(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 입력할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }

  const departmentId = field(form, 'department_id')
  if (!isId(departmentId)) return { ok: false, message: '부서를 골라 주세요.' }
  const checked = validateExpense(
    { spentOn: field(form, 'spent_on'), description: field(form, 'description'), amount: field(form, 'amount') },
    kstToday(),
  )
  if (!checked.ok) return { ok: false, message: checked.error }

  return run(() => store.createExpense(actorOf(visitor), departmentId, checked.value), '집행 건을 넣었어요.')
}

export async function removeExpense(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 지울 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const id = field(form, 'id')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  return run(() => store.deleteExpense(actorOf(visitor), id), '집행 건을 지웠어요.')
}

// ── 관리자 ───────────────────────────────────────────────────────────────────

/** 관리자가 아니면 거절 문구, 맞으면 null. */
async function adminCheck(): Promise<{ visitor: AxhubMe; denied: FormState | null }> {
  const visitor = await me()
  if (!isBudgetAdmin(visitor)) return { visitor, denied: { ok: false, message: ADMIN_ONLY } }
  if (!isDbConfigured()) return { visitor, denied: { ok: false, message: NO_DB } }
  return { visitor, denied: null }
}

export async function addDepartment(_prev: FormState | null, form: FormData): Promise<FormState> {
  const { denied } = await adminCheck()
  if (denied) return denied
  const checked = validateDepartmentName(field(form, 'name'))
  if (!checked.ok) return { ok: false, message: checked.error }
  return run(() => store.createDepartment(checked.value), `'${checked.value}' 부서를 만들었어요.`)
}

export async function removeDepartment(_prev: FormState | null, form: FormData): Promise<FormState> {
  const { denied } = await adminCheck()
  if (denied) return denied
  const id = field(form, 'id')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  return run(() => store.deleteDepartment(id), '부서를 지웠어요.')
}

export async function setBudget(_prev: FormState | null, form: FormData): Promise<FormState> {
  const { visitor, denied } = await adminCheck()
  if (denied) return denied
  const id = field(form, 'department_id')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  const checked = validateBudget({ year: field(form, 'year'), amount: field(form, 'amount') })
  if (!checked.ok) return { ok: false, message: checked.error }
  const { year, amount } = checked.value
  return run(() => store.saveBudget(id, year, amount, visitor.name || visitor.email), `${year}년 예산을 저장했어요.`)
}

export async function addManager(_prev: FormState | null, form: FormData): Promise<FormState> {
  const { denied } = await adminCheck()
  if (denied) return denied
  const id = field(form, 'department_id')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  const checked = validateManagerEmail(field(form, 'email'))
  if (!checked.ok) return { ok: false, message: checked.error }
  return run(() => store.addManager(id, checked.value), `${checked.value} 을 담당자로 지정했어요.`)
}

export async function removeManager(_prev: FormState | null, form: FormData): Promise<FormState> {
  const { denied } = await adminCheck()
  if (denied) return denied
  const id = field(form, 'department_id')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  const email = normalizeEmail(field(form, 'email'))
  return run(() => store.removeManager(id, email), '담당자에서 뺐어요.')
}
