// 휴가 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/leave-check.mjs)
import type { AxhubMe } from './axhub-server'

/** 한 해 연차 일수. 바꾸면 모든 직원의 "남은 연차" 가 같이 바뀌어요. */
export const ANNUAL_QUOTA = 15

export const KIND_LABEL = { annual: '연차', half: '반차', sick: '병가' } as const
export type LeaveKind = keyof typeof KIND_LABEL

export const STATUS_LABEL = { pending: '대기', approved: '승인', rejected: '반려' } as const
export type LeaveStatus = keyof typeof STATUS_LABEL

export const REASON_MAX = 200
/** 한 번에 신청할 수 있는 최대 기간(달력 기준 일수). */
export const PERIOD_MAX_DAYS = 90

export function isLeaveKind(v: string): v is LeaveKind {
  return Object.hasOwn(KIND_LABEL, v)
}

/** 연차·반차는 남은 연차에서 빠지고, 병가는 빠지지 않아요. */
export function usesAnnual(kind: LeaveKind): boolean {
  return kind !== 'sick'
}

/**
 * 승인·반려할 수 있는 사람 = axhub 가 "관리자" 로 알려 준 사람.
 * is_admin 은 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자일 때 true 예요 (AXHUB.md §7).
 */
export function isApprover(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  // 2026-02-30 같은 없는 날짜를 걸러요 (Date 는 3월 2일로 넘겨 버려요).
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d
}

/**
 * 신청 일수. 반차는 0.5일, 연차·병가는 기간 안의 평일 수예요.
 * ponytail: 공휴일은 빼지 않아요 — 필요하면 공휴일 표를 두고 여기서 빼요.
 */
export function leaveDays(kind: LeaveKind, start: string, end: string): number {
  if (kind === 'half') return 0.5
  const from = parseDate(start)
  const to = parseDate(end)
  if (!from || !to) return 0
  let days = 0
  for (const d = from; d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) days++
  }
  return days
}

export type LeaveInput = { kind: string; start: string; end: string; reason: string }
export type LeaveRequest = { kind: LeaveKind; start: string; end: string; reason: string; days: number; year: number }

/** 신청 값 검사. 통과하면 저장할 값을, 아니면 사용자에게 보여 줄 문구를 돌려줘요. */
export function validateLeave(input: LeaveInput): { ok: true; value: LeaveRequest } | { ok: false; error: string } {
  const kind = input.kind
  const reason = input.reason.trim()
  if (!isLeaveKind(kind)) return { ok: false, error: '휴가 종류를 골라 주세요.' }
  const start = input.start
  // 반차는 하루짜리라 종료일을 시작일로 맞춰요.
  const end = kind === 'half' ? start : input.end
  const from = parseDate(start)
  const to = parseDate(end)
  if (!from) return { ok: false, error: '시작일을 골라 주세요.' }
  if (!to) return { ok: false, error: '종료일을 골라 주세요.' }
  if (to < from) return { ok: false, error: '종료일이 시작일보다 앞서요.' }
  if (start.slice(0, 4) !== end.slice(0, 4)) return { ok: false, error: '해가 바뀌는 휴가는 연도별로 나눠서 신청해 주세요.' }
  if ((to.getTime() - from.getTime()) / 86_400_000 + 1 > PERIOD_MAX_DAYS)
    return { ok: false, error: `한 번에 ${PERIOD_MAX_DAYS}일까지 신청할 수 있어요.` }
  if (!reason) return { ok: false, error: '사유를 적어 주세요.' }
  if (reason.length > REASON_MAX) return { ok: false, error: `사유는 ${REASON_MAX}자 안으로 적어 주세요.` }
  const days = leaveDays(kind, start, end)
  if (days <= 0) return { ok: false, error: '고른 기간에 평일이 없어요.' }
  return { ok: true, value: { kind, start, end, reason, days, year: Number(start.slice(0, 4)) } }
}

// ── 한국 시간(KST) 표시 ─────────────────────────────────────────────────────

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

export function formatPeriod(start: string, end: string): string {
  return start === end ? formatDate(start) : `${formatDate(start)} ~ ${formatDate(end)}`
}

/** 시각 → KST '2026. 10. 8. 오후 3:20'. */
export function formatDateTime(t: Date): string {
  return t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}

/** 12.5 → '12.5일', 3 → '3일'. */
export function formatDays(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)}일`
}
