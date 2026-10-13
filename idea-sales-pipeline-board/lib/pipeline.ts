// 영업 파이프라인 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/pipeline-check.mjs)
import type { AxhubMe } from './axhub-server'

/** 단계 — 보드의 열 순서 그대로예요. 저장은 영문 코드, 화면은 한글 이름. lib/db.ts 의 CHECK 제약과 값이 같아야 해요. */
export const STAGE_LABEL = { contact: '접촉', proposal: '제안', negotiation: '협상', won: '계약', lost: '실패' } as const
export type Stage = keyof typeof STAGE_LABEL
export const STAGES = Object.keys(STAGE_LABEL) as Stage[]

export function isStage(v: string): v is Stage {
  return Object.hasOwn(STAGE_LABEL, v)
}

/** 계약·실패는 끝난 거래예요 — "예상 계약일 지남" 표시를 하지 않아요. */
export function isClosed(stage: Stage): boolean {
  return stage === 'won' || stage === 'lost'
}

/** 보드에서 ◀ ▶ 로 옮길 이웃 단계. 맨 끝이면 null. */
export function neighborStage(stage: Stage, step: -1 | 1): Stage | null {
  return STAGES[STAGES.indexOf(stage) + step] ?? null
}

export const LIMITS = { company: 100, owner: 50 } as const
/** 거래 한 건의 예상 금액 상한(원) — 100조. */
export const AMOUNT_MAX = BigInt('100000000000000')

/**
 * 관리자 = axhub 가 "관리자" 로 알려 준 사람 (is_admin: 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자, AXHUB.md §7).
 * 다른 사람이 등록한 거래도 지울 수 있어요. 판단은 이 함수 한 곳에서만 해요.
 */
export function isManager(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

/** 거래를 지울 수 있는 사람 = 등록한 사람 또는 관리자. 등록·수정·단계 이동은 로그인한 누구나 해요. */
export function canDelete(visitor: AxhubMe, createdByKey: string): boolean {
  return visitor.authenticated && (visitor.user_id === createdByKey || isManager(visitor))
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  // 2026-02-30 같은 없는 날짜를 걸러요 (Date 는 3월 2일로 넘겨 버려요).
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d
}

/** '1,200,000' · '1200000원' · ' 3 000 ' → 1200000n. 정수가 아니면 null. */
export function parseAmount(s: string): bigint | null {
  const t = s.replace(/[\s,]/g, '').replace(/원$/, '')
  return /^\d{1,20}$/.test(t) ? BigInt(t) : null
}

export type DealInput = { company: string; amount: string; owner: string; expectedClose: string; stage: string }
/** amount 는 원 단위 정수를 글자로 (bigint 는 Server Action 경계를 못 넘어요). expectedClose 는 비어 있으면 null. */
export type Deal = { company: string; amount: string; owner: string; expectedClose: string | null; stage: Stage }

/** 거래 값 검사. 통과하면 저장할 값을, 아니면 사용자에게 보여 줄 문구를 돌려줘요. */
export function validateDeal(input: DealInput): { ok: true; value: Deal } | { ok: false; error: string } {
  const company = input.company.trim()
  const owner = input.owner.trim()
  const expectedClose = input.expectedClose.trim()
  if (!company) return { ok: false, error: '고객사를 적어 주세요.' }
  if (company.length > LIMITS.company) return { ok: false, error: `고객사는 ${LIMITS.company}자 안으로 적어 주세요.` }
  const amount = parseAmount(input.amount)
  if (amount === null) return { ok: false, error: '예상 금액은 원 단위 숫자로 적어 주세요. 예: 12,000,000' }
  if (amount > AMOUNT_MAX) return { ok: false, error: '예상 금액이 너무 커요. 100조 원 이하로 적어 주세요.' }
  if (!owner) return { ok: false, error: '담당자를 적어 주세요.' }
  if (owner.length > LIMITS.owner) return { ok: false, error: `담당자는 ${LIMITS.owner}자 안으로 적어 주세요.` }
  if (expectedClose && (!parseDate(expectedClose) || expectedClose < '2000-01-01' || expectedClose > '2099-12-31'))
    return { ok: false, error: '예상 계약일을 다시 골라 주세요.' }
  if (!isStage(input.stage)) return { ok: false, error: '단계를 골라 주세요.' }
  return { ok: true, value: { company, amount: amount.toString(), owner, expectedClose: expectedClose || null, stage: input.stage } }
}

/** 목록 검색어 정리 — 앞뒤 공백을 빼고 50자까지만. */
export function cleanQuery(v: string | undefined): string {
  return (v ?? '').trim().slice(0, 50)
}

/** 목록 단계 필터 — 모르는 값은 '전체'(null). */
export function stageOf(v: string | undefined): Stage | null {
  return v && isStage(v) ? v : null
}

// ── 표시 ────────────────────────────────────────────────────────────────────

/** '12000000' → '12,000,000원'. 큰 합계도 정확하게 (bigint). */
export function formatWon(amount: string | bigint): string {
  return `${BigInt(amount).toLocaleString('ko-KR')}원`
}

/** 금액 글자들의 합 (bigint). 보드 열 합계는 DB 가 세서 보드는 이걸 쓰지 않아요 — 큰 금액 합 계산 도우미예요. */
export function sumAmounts(amounts: string[]): bigint {
  return amounts.reduce((sum, a) => sum + BigInt(a), BigInt(0))
}

// ── 한국 시간(KST) ──────────────────────────────────────────────────────────

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** 오늘 날짜(KST) 'YYYY-MM-DD'. */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}

/** '2026-10-08' → '2026년 10월 8일 (목)'. 날짜 값이라 시간대 영향이 없어요. */
export function formatDate(s: string): string {
  const d = parseDate(s)
  if (!d) return s
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY[d.getUTCDay()]})`
}

/** 카드용 짧은 날짜 — 올해면 '10월 8일', 아니면 '2027년 1월 5일'. */
export function formatShortDate(s: string, today: string): string {
  const d = parseDate(s)
  if (!d) return s
  const md = `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`
  return s.slice(0, 4) === today.slice(0, 4) ? md : `${d.getUTCFullYear()}년 ${md}`
}

/** 진행 중인 거래의 예상 계약일이 오늘(KST)보다 앞서면 true. */
export function isOverdue(stage: Stage, expectedClose: string | null, today: string): boolean {
  return !isClosed(stage) && expectedClose !== null && expectedClose < today
}

/** 시각 → KST '2026. 10. 8. 오후 3:20'. */
export function formatDateTime(t: Date): string {
  return t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}
