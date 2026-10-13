'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·팀장 여부와 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { isLeader, isQuoteStatus, kstToday, validateQuote } from '@/lib/quote'
import { createQuote, updateQuote } from '@/lib/quote-store'

export type FormState = { ok: boolean; message: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const NO_DB = '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.'

export async function submitQuote(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 등록할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }

  const text = (k: string) => String(form.get(k) ?? '')
  const checked = validateQuote(
    {
      company: text('company'),
      contactName: text('contact_name'),
      contactPhone: text('contact_phone'),
      item: text('item'),
      quantity: text('quantity'),
      dueDate: text('due_date'),
    },
    kstToday(),
  )
  if (!checked.ok) return { ok: false, message: checked.error }

  try {
    await createQuote({ userKey: visitor.user_id, name: visitor.name || visitor.email, email: visitor.email }, checked.value)
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/')
  revalidatePath('/admin')
  return { ok: true, message: '등록했어요. 팀장이 담당자를 배정하면 아래 목록에 이름이 보여요.' }
}

export async function assignQuote(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isLeader(visitor)) return { ok: false, message: '팀장(앱 관리자)만 담당자와 상태를 바꿀 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }

  const id = String(form.get('id') ?? '')
  const status = String(form.get('status') ?? '')
  const assignee = String(form.get('assignee') ?? '')
  if (!/^\d{1,18}$/.test(id)) return { ok: false, message: '잘못된 요청이에요. 화면을 새로고침해 주세요.' }
  if (!isQuoteStatus(status)) return { ok: false, message: '상태를 골라 주세요.' }
  if (assignee.length > 200) return { ok: false, message: '담당자를 다시 골라 주세요.' }

  try {
    const problem = await updateQuote(id, { assigneeKey: assignee || null, status }, { name: visitor.name || visitor.email })
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/admin')
  revalidatePath('/')
  return { ok: true, message: '저장했어요.' }
}
