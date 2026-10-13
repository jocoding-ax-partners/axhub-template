'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·담당자 여부와 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { isManager, validateSurvey } from '@/lib/survey'
import * as store from '@/lib/survey-store'

export type FormState = { ok: boolean; message: string; id?: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const NO_DB = '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.'
const BAD_SURVEY = '잘못된 설문이에요. 화면을 새로고침해 주세요.'
const MANAGER_ONLY = '설문 담당자(관리자)만 할 수 있어요.'

const surveyIdOf = (form: FormData): string | null => {
  const id = String(form.get('survey_id') ?? '')
  return /^\d{1,18}$/.test(id) ? id : null
}

export async function createSurvey(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isManager(visitor)) return { ok: false, message: MANAGER_ONLY }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }

  let questions: unknown
  try {
    questions = JSON.parse(String(form.get('questions') ?? '[]'))
  } catch {
    return { ok: false, message: '문항을 읽지 못했어요. 화면을 새로고침해 주세요.' }
  }
  const checked = validateSurvey({
    title: String(form.get('title') ?? ''),
    description: String(form.get('description') ?? ''),
    questions,
  })
  if (!checked.ok) return { ok: false, message: checked.error }

  let id: string
  try {
    id = await store.createSurvey(checked.value, { userKey: visitor.user_id, name: visitor.name || visitor.email })
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/')
  revalidatePath('/admin')
  return { ok: true, message: '설문을 만들었어요. 응답 링크를 직원들에게 보내 주세요.', id }
}

export async function submitResponse(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 응답할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const id = surveyIdOf(form)
  if (!id) return { ok: false, message: BAD_SURVEY }

  try {
    const problem = await store.submitResponse(id, visitor.user_id, (questionId) => String(form.get(`q_${questionId}`) ?? ''))
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/')
  revalidatePath(`/s/${id}`)
  revalidatePath('/admin', 'layout')
  return { ok: true, message: '응답을 보냈어요. 참여해 주셔서 고마워요.' }
}

export async function setSurveyStatus(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isManager(visitor)) return { ok: false, message: MANAGER_ONLY }
  const id = surveyIdOf(form)
  const status = String(form.get('status') ?? '')
  if (!id || (status !== 'open' && status !== 'closed')) return { ok: false, message: BAD_SURVEY }

  try {
    if (!(await store.setSurveyStatus(id, status))) return { ok: false, message: '없는 설문이에요. 이미 지워졌을 수 있어요.' }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/')
  revalidatePath(`/s/${id}`)
  revalidatePath('/admin', 'layout')
  return { ok: true, message: status === 'closed' ? '설문을 마감했어요. 더는 응답을 받지 않아요.' : '설문을 다시 열었어요.' }
}

export async function deleteSurvey(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isManager(visitor)) return { ok: false, message: MANAGER_ONLY }
  const id = surveyIdOf(form)
  if (!id) return { ok: false, message: BAD_SURVEY }

  try {
    if (!(await store.deleteSurvey(id))) return { ok: false, message: '없는 설문이에요. 이미 지워졌을 수 있어요.' }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/')
  revalidatePath('/admin', 'layout')
  return { ok: true, message: '설문과 응답을 지웠어요.' }
}
