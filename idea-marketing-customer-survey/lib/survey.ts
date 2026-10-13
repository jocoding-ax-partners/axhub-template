// 설문 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/survey-check.mjs)
import type { AxhubMe } from './axhub-server'

export const TITLE_MAX = 100
export const DESCRIPTION_MAX = 500
export const PROMPT_MAX = 200
export const OPTION_MAX = 100
export const OPTIONS_MIN = 2
export const OPTIONS_MAX = 10
export const QUESTIONS_MAX = 30
export const ANSWER_MAX = 1000

export const KIND_LABEL = { choice: '객관식', text: '주관식' } as const
export type QuestionKind = keyof typeof KIND_LABEL

export const STATUS_LABEL = { open: '진행 중', closed: '마감' } as const
export type SurveyStatus = keyof typeof STATUS_LABEL

/**
 * 설문을 만들고 결과를 보는 담당자 = axhub 가 "관리자" 로 알려 준 사람.
 * is_admin 은 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자일 때 true 예요 (AXHUB.md §7).
 */
export function isManager(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

export type QuestionDraft = { kind: QuestionKind; prompt: string; options: string[] }
export type SurveyDraft = { title: string; description: string; questions: QuestionDraft[] }

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * 새 설문 값 검사. 문항은 화면이 JSON 으로 보내요 — 모양이 이상해도 여기서 걸러요.
 * 객관식 보기는 순서대로 저장하고, 응답은 보기 번호(0부터)로 저장해요.
 */
export function validateSurvey(input: { title: string; description: string; questions: unknown }): Result<SurveyDraft> {
  const title = input.title.trim()
  const description = input.description.trim()
  if (!title) return { ok: false, error: '설문 제목을 적어 주세요.' }
  if (title.length > TITLE_MAX) return { ok: false, error: `설문 제목은 ${TITLE_MAX}자 안으로 적어 주세요.` }
  if (description.length > DESCRIPTION_MAX) return { ok: false, error: `안내 문구는 ${DESCRIPTION_MAX}자 안으로 적어 주세요.` }
  if (!Array.isArray(input.questions) || input.questions.length === 0) return { ok: false, error: '문항을 하나 이상 넣어 주세요.' }
  if (input.questions.length > QUESTIONS_MAX) return { ok: false, error: `문항은 ${QUESTIONS_MAX}개까지 넣을 수 있어요.` }

  const questions: QuestionDraft[] = []
  for (const [i, raw] of input.questions.entries()) {
    const n = `${i + 1}번 문항`
    const q = (raw ?? {}) as { kind?: unknown; prompt?: unknown; options?: unknown }
    if (q.kind !== 'choice' && q.kind !== 'text') return { ok: false, error: `${n}의 종류를 골라 주세요.` }
    const prompt = typeof q.prompt === 'string' ? q.prompt.trim() : ''
    if (!prompt) return { ok: false, error: `${n}의 질문을 적어 주세요.` }
    if (prompt.length > PROMPT_MAX) return { ok: false, error: `${n}의 질문은 ${PROMPT_MAX}자 안으로 적어 주세요.` }
    if (q.kind === 'text') {
      questions.push({ kind: 'text', prompt, options: [] })
      continue
    }
    const options = (Array.isArray(q.options) ? q.options : [])
      .map((o) => (typeof o === 'string' ? o.trim() : ''))
      .filter(Boolean)
    if (options.length < OPTIONS_MIN) return { ok: false, error: `${n}에 보기를 ${OPTIONS_MIN}개 이상 적어 주세요.` }
    if (options.length > OPTIONS_MAX) return { ok: false, error: `${n}의 보기는 ${OPTIONS_MAX}개까지예요.` }
    if (options.some((o) => o.length > OPTION_MAX)) return { ok: false, error: `${n}의 보기는 하나에 ${OPTION_MAX}자 안으로 적어 주세요.` }
    if (new Set(options).size !== options.length) return { ok: false, error: `${n}에 같은 보기가 두 번 있어요.` }
    questions.push({ kind: 'choice', prompt, options })
  }
  return { ok: true, value: { title, description, questions } }
}

export type QuestionForAnswer = { id: string; kind: QuestionKind; options: string[] }
export type Answer = { questionId: string; choice: number | null; text: string | null }

/**
 * 응답 값 검사. 객관식은 꼭 답해야 하고, 주관식은 비워 둘 수 있어요.
 * value(questionId) 는 폼에서 그 문항의 값을 읽어 와요 (객관식은 보기 번호).
 */
export function validateAnswers(questions: QuestionForAnswer[], value: (questionId: string) => string): Result<Answer[]> {
  const answers: Answer[] = []
  for (const [i, q] of questions.entries()) {
    const raw = value(q.id).trim()
    if (q.kind === 'choice') {
      const choice = /^\d{1,2}$/.test(raw) ? Number(raw) : -1
      if (choice < 0 || choice >= q.options.length) return { ok: false, error: `${i + 1}번 문항에 답해 주세요.` }
      answers.push({ questionId: q.id, choice, text: null })
    } else if (raw) {
      if (raw.length > ANSWER_MAX) return { ok: false, error: `${i + 1}번 문항의 답은 ${ANSWER_MAX}자 안으로 적어 주세요.` }
      answers.push({ questionId: q.id, choice: null, text: raw })
    }
  }
  if (answers.length === 0) return { ok: false, error: '한 문항 이상 답해 주세요.' }
  return { ok: true, value: answers }
}

/** 보기별 응답 수 → 비율(%) — 소수 첫째 자리까지. 답한 사람이 없으면 0. */
export function percent(count: number, answered: number): number {
  return answered > 0 ? Math.round((count / answered) * 1000) / 10 : 0
}

/** 시각 → KST '2026. 10. 8. 오후 3:20'. */
export function formatDateTime(t: Date): string {
  return t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}
