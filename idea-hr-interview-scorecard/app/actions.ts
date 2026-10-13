'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·채용 담당자 여부와 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { me, type AxhubMe } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { isRecruiter, isResult, normalizeEmail, validateCandidate, validateScore, type CandidateInput } from '@/lib/interview'
import {
  createCandidate as insertCandidate,
  deleteCandidate as removeCandidate,
  recordResult as saveResult,
  saveScorecard,
  updateCandidate as saveCandidate,
} from '@/lib/interview-store'

export type FormState = { ok: boolean; message: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const NO_DB = '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.'
const BAD_ID = '잘못된 지원자예요. 화면을 새로고침해 주세요.'

const field = (form: FormData, k: string) => String(form.get(k) ?? '')
const isId = (v: string) => /^\d{1,18}$/.test(v)
const nameOf = (v: AxhubMe) => v.name || v.email

/** 채용 담당자만 통과 — 방문자를, 아니면 보여 줄 문구를 돌려줘요. */
async function recruiterOnly(): Promise<AxhubMe | string> {
  const visitor = await me()
  if (!isRecruiter(visitor)) return '채용 담당자(앱 관리자)만 할 수 있어요.'
  if (!isDbConfigured()) return NO_DB
  return visitor
}

function candidateInput(form: FormData): CandidateInput {
  return {
    name: field(form, 'name'),
    position: field(form, 'position'),
    interviewAt: field(form, 'interview_at'),
    interviewers: field(form, 'interviewers'),
  }
}

export async function createCandidate(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await recruiterOnly()
  if (typeof visitor === 'string') return { ok: false, message: visitor }
  const checked = validateCandidate(candidateInput(form))
  if (!checked.ok) return { ok: false, message: checked.error }
  try {
    await insertCandidate(checked.value, nameOf(visitor))
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/', 'layout')
  return { ok: true, message: `${checked.value.name}님을 등록했어요. 면접관의 "내 면접" 에 바로 보여요.` }
}

export async function updateCandidate(_prev: FormState | null, form: FormData): Promise<FormState> {
  const denied = await recruiterOnly()
  if (typeof denied === 'string') return { ok: false, message: denied }
  const id = field(form, 'id')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  const checked = validateCandidate(candidateInput(form))
  if (!checked.ok) return { ok: false, message: checked.error }
  try {
    const failed = await saveCandidate(id, checked.value)
    if (failed) return { ok: false, message: failed }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/', 'layout')
  return { ok: true, message: '지원자 정보를 고쳤어요.' }
}

export async function recordResult(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await recruiterOnly()
  if (typeof visitor === 'string') return { ok: false, message: visitor }
  const id = field(form, 'id')
  const result = field(form, 'result')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  if (result !== '' && !isResult(result)) return { ok: false, message: '합격 · 보류 · 불합격 중에서 골라 주세요.' }
  try {
    const failed = await saveResult(id, result === '' ? null : result, nameOf(visitor))
    if (failed) return { ok: false, message: failed }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/', 'layout')
  return { ok: true, message: result === '' ? '결과를 지웠어요. 면접관이 평가를 다시 고칠 수 있어요.' : '결과를 기록했어요.' }
}

export async function deleteCandidate(_prev: FormState | null, form: FormData): Promise<FormState> {
  const denied = await recruiterOnly()
  if (typeof denied === 'string') return { ok: false, message: denied }
  const id = field(form, 'id')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  try {
    const failed = await removeCandidate(id)
    if (failed) return { ok: false, message: failed }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/', 'layout')
  redirect('/candidates')
}

export async function submitScorecard(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 평가할 수 있어요.' }
  if (!visitor.email) return { ok: false, message: 'axhub 계정에 이메일이 없어 면접관을 확인할 수 없어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const id = field(form, 'id')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  const checked = validateScore({
    job_skill: field(form, 'job_skill'),
    communication: field(form, 'communication'),
    culture_fit: field(form, 'culture_fit'),
    comment: field(form, 'comment'),
  })
  if (!checked.ok) return { ok: false, message: checked.error }
  try {
    const failed = await saveScorecard(id, { email: normalizeEmail(visitor.email), name: visitor.name }, checked.value)
    if (failed) return { ok: false, message: failed }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/', 'layout')
  return { ok: true, message: '평가를 저장했어요. 결과가 기록되기 전까지는 다시 고칠 수 있어요.' }
}
