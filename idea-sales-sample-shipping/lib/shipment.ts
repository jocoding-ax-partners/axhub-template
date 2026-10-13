// 발송 기록 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/shipment-check.mjs)
import type { AxhubMe } from './axhub-server'

export const CUSTOMER_MAX = 100
export const CONTACT_MAX = 100
export const ITEMS_MAX = 300
export const MEMO_MAX = 1000
/** 후속 연락 예정일은 오늘부터 이 날수 안으로만 잡을 수 있어요 (연도 오타 방지). */
export const FOLLOW_UP_MAX_DAYS = 365

/**
 * 발송 건을 고치고 · 지우고 · 연락 완료로 표시할 수 있는 사람 = 그 건을 기록한 사람 또는 관리자.
 * 관리자(is_admin)는 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자예요 (AXHUB.md §7).
 */
export function canManage(visitor: AxhubMe, createdBy: string): boolean {
  return visitor.authenticated && (visitor.is_admin || createdBy === visitor.user_id)
}

/** 고객사 이름 정리 — 앞뒤 공백을 지우고 연속 공백을 하나로 (같은 고객사가 따로 묶이지 않게). */
export function normalizeName(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  // 2026-02-30 같은 없는 날짜를 걸러요 (Date 는 3월 2일로 넘겨 버려요).
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d
}

/** 두 날짜('YYYY-MM-DD') 사이 날수. to 가 뒤면 양수. */
export function daysBetween(from: string, to: string): number {
  const a = parseDate(from)
  const b = parseDate(to)
  return a && b ? Math.round((b.getTime() - a.getTime()) / 86_400_000) : 0
}

function addDays(s: string, n: number): string {
  const d = parseDate(s)
  if (!d) return s
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export type ShipmentInput = {
  customer: string
  contact: string
  items: string
  sentOn: string
  followUpOn: string
  memo: string
}
export type ShipmentValue = {
  customer: string
  contact: string
  items: string
  sentOn: string
  followUpOn: string | null
  memo: string
}

/** 입력 검사. 통과하면 저장할 값을, 아니면 사용자에게 보여 줄 문구를 돌려줘요. today 는 KST 'YYYY-MM-DD'. */
export function validateShipment(
  input: ShipmentInput,
  today: string,
): { ok: true; value: ShipmentValue } | { ok: false; error: string } {
  const customer = normalizeName(input.customer)
  const contact = normalizeName(input.contact)
  const items = input.items.trim()
  const memo = input.memo.trim()
  const sentOn = input.sentOn.trim()
  const followUpOn = input.followUpOn.trim()

  if (!customer) return { ok: false, error: '받는 고객사를 적어 주세요.' }
  if (customer.length > CUSTOMER_MAX) return { ok: false, error: `고객사 이름은 ${CUSTOMER_MAX}자 안으로 적어 주세요.` }
  if (contact.length > CONTACT_MAX) return { ok: false, error: `담당자는 ${CONTACT_MAX}자 안으로 적어 주세요.` }
  if (!items) return { ok: false, error: '보낸 것을 적어 주세요.' }
  if (items.length > ITEMS_MAX) return { ok: false, error: `보낸 것은 ${ITEMS_MAX}자 안으로 적어 주세요.` }
  if (!parseDate(sentOn)) return { ok: false, error: '보낸 날을 골라 주세요.' }
  if (sentOn < '2000-01-01') return { ok: false, error: '보낸 날을 다시 확인해 주세요.' }
  if (sentOn > today) return { ok: false, error: '보낸 날은 오늘이나 그 전이어야 해요.' }
  if (followUpOn) {
    if (!parseDate(followUpOn)) return { ok: false, error: '후속 연락 예정일을 다시 골라 주세요.' }
    if (followUpOn < sentOn) return { ok: false, error: '후속 연락 예정일이 보낸 날보다 앞서요.' }
    if (followUpOn > addDays(today, FOLLOW_UP_MAX_DAYS))
      return { ok: false, error: '후속 연락 예정일은 오늘부터 1년 안으로 잡아 주세요.' }
  }
  if (memo.length > MEMO_MAX) return { ok: false, error: `메모는 ${MEMO_MAX}자 안으로 적어 주세요.` }
  return { ok: true, value: { customer, contact, items, sentOn, followUpOn: followUpOn || null, memo } }
}

/** 후속 연락 상태 — 없음 · 완료 · 지남 · 오늘 · 예정. */
export type FollowUpState = 'none' | 'done' | 'overdue' | 'today' | 'upcoming'

export function followUpState(followUpOn: string | null, done: boolean, today: string): FollowUpState {
  if (!followUpOn) return 'none'
  if (done) return 'done'
  if (followUpOn < today) return 'overdue'
  return followUpOn === today ? 'today' : 'upcoming'
}

/** 상태 옆에 붙일 짧은 설명. 예: '3일 지남', '오늘 연락', '10월 20일 (화) 연락 예정'. */
export function followUpLabel(followUpOn: string | null, done: boolean, today: string): string {
  const state = followUpState(followUpOn, done, today)
  if (state === 'none' || !followUpOn) return ''
  if (state === 'done') return '연락 완료'
  if (state === 'today') return '오늘 연락'
  if (state === 'overdue') return `연락 ${daysBetween(followUpOn, today)}일 지남`
  return `${formatShortDate(followUpOn)} 연락 예정`
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

/** '2026-10-08' → '10월 8일 (목)'. */
export function formatShortDate(s: string): string {
  const d = parseDate(s)
  if (!d) return s
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY[d.getUTCDay()]})`
}

/** 시각 → KST '2026. 10. 8. 오후 3:20'. */
export function formatDateTime(t: Date): string {
  return t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}
