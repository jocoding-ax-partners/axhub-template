// 면접 평가 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/interview-check.mjs)
import type { AxhubMe } from './axhub-server'

/** 평가 항목. 항목을 바꾸면 lib/db.ts 의 scorecards 컬럼도 같이 바꿔요. */
export const CRITERIA = [
  { key: 'job_skill', label: '직무 역량' },
  { key: 'communication', label: '소통' },
  { key: 'culture_fit', label: '문화 적합' },
] as const
export type CriterionKey = (typeof CRITERIA)[number]['key']
export const SCORE_MIN = 1
export const SCORE_MAX = 5

export const RESULT_LABEL = { pass: '합격', hold: '보류', fail: '불합격' } as const
export type InterviewResult = keyof typeof RESULT_LABEL
/** 결과 표시 점 색 (StatusDot tone). */
export const RESULT_TONE = { pass: 'active', hold: 'muted', fail: 'failed' } as const satisfies Record<InterviewResult, string>

export const NAME_MAX = 50
export const POSITION_MAX = 50
export const COMMENT_MAX = 1000
/** 지원자 한 명에게 배정할 수 있는 면접관 수. */
export const INTERVIEWERS_MAX = 10

export function isResult(v: string): v is InterviewResult {
  return Object.hasOwn(RESULT_LABEL, v)
}

/**
 * 채용 담당자 = axhub 가 "관리자" 로 알려 준 사람 (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자, AXHUB.md §7).
 * 지원자 등록 · 상세(점수 모아 보기) · 결과 기록은 이 사람만 해요. 이 함수 한 곳에서만 판단해요.
 */
export function isRecruiter(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

/** 면접관은 axhub 로그인 이메일로 알아봐요 (대소문자 무시). */
export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase()
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

/** '2026-10-20T14:00' (KST 로 고른 값) → 그 시각. 없는 날짜·시각이면 null. */
export function parseKstLocal(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(`${s}:00+09:00`)
  // 2026-02-30 처럼 없는 날짜는 Date 가 다음 달로 넘겨 버려요 — 되돌려 봐서 같은지 확인해요.
  return Number.isNaN(d.getTime()) || toKstLocal(d) !== s ? null : d
}

/** 시각 → '2026-10-20T14:00' (KST). 수정 폼의 기본값에 써요. */
export function toKstLocal(t: Date): string {
  return new Date(t.getTime() + 9 * 3_600_000).toISOString().slice(0, 16)
}

export type CandidateInput = { name: string; position: string; interviewAt: string; interviewers: string }
export type CandidateValue = { name: string; position: string; interviewAt: Date; interviewers: string[] }

/** 지원자 등록·수정 값 검사. 통과하면 저장할 값을, 아니면 사용자에게 보여 줄 문구를 돌려줘요. */
export function validateCandidate(input: CandidateInput): { ok: true; value: CandidateValue } | { ok: false; error: string } {
  const name = input.name.trim()
  const position = input.position.trim()
  if (!name) return { ok: false, error: '지원자 이름을 적어 주세요.' }
  if (name.length > NAME_MAX) return { ok: false, error: `이름은 ${NAME_MAX}자 안으로 적어 주세요.` }
  if (!position) return { ok: false, error: '지원 직무를 적어 주세요.' }
  if (position.length > POSITION_MAX) return { ok: false, error: `지원 직무는 ${POSITION_MAX}자 안으로 적어 주세요.` }
  const interviewAt = parseKstLocal(input.interviewAt)
  if (!interviewAt) return { ok: false, error: '면접 일시를 골라 주세요.' }
  const interviewers = [...new Set(input.interviewers.split(/[\s,;]+/).map(normalizeEmail).filter(Boolean))]
  if (interviewers.length === 0) return { ok: false, error: '면접관 이메일을 한 명 이상 적어 주세요.' }
  const bad = interviewers.find((e) => e.length > 254 || !EMAIL_RE.test(e))
  if (bad) return { ok: false, error: `면접관 이메일 "${bad.slice(0, 60)}" 을 확인해 주세요.` }
  if (interviewers.length > INTERVIEWERS_MAX) return { ok: false, error: `면접관은 ${INTERVIEWERS_MAX}명까지 배정할 수 있어요.` }
  return { ok: true, value: { name, position, interviewAt, interviewers } }
}

export type ScoreValue = Record<CriterionKey, number> & { comment: string }

/** 평가표 값 검사. 점수는 항목마다 1~5 정수, 의견은 꼭 적어요. */
export function validateScore(input: Record<CriterionKey | 'comment', string>): { ok: true; value: ScoreValue } | { ok: false; error: string } {
  const value = { comment: input.comment.trim() } as ScoreValue
  for (const c of CRITERIA) {
    const n = Number(input[c.key])
    if (input[c.key] === '' || !Number.isInteger(n) || n < SCORE_MIN || n > SCORE_MAX)
      return { ok: false, error: `${c.label} 점수를 ${SCORE_MIN}~${SCORE_MAX}점 중에서 골라 주세요.` }
    value[c.key] = n
  }
  if (!value.comment) return { ok: false, error: '의견을 적어 주세요.' }
  if (value.comment.length > COMMENT_MAX) return { ok: false, error: `의견은 ${COMMENT_MAX}자 안으로 적어 주세요.` }
  return { ok: true, value }
}

/** 한 면접관의 종합 점수 = 세 항목의 평균. */
export function overall(s: Record<CriterionKey, number>): number {
  return CRITERIA.reduce((sum, c) => sum + s[c.key], 0) / CRITERIA.length
}

/** 3.666 → '3.7', null → '—'. 평균 점수 표시용. */
export function formatScore(n: number | null): string {
  return n === null ? '—' : (Math.round(n * 10) / 10).toFixed(1)
}

/** 시각 → KST '2026. 10. 20. (화) 오후 2:00'. */
export function formatDateTime(t: Date): string {
  return t.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}
