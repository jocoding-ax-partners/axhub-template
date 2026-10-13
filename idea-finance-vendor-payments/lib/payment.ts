// 거래처 지급 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/payment-check.mjs)
import type { AxhubMe } from './axhub-server'

export const VENDOR_MAX = 100
export const MEMO_MAX = 300
/** 한 건에 적을 수 있는 최대 금액(원). 오타로 0 을 몇 개 더 붙이는 걸 막아요. */
export const AMOUNT_MAX = 100_000_000_000
/** 이 범위 밖의 날짜는 받지 않아요 (연도 오타 방지). */
const OLDEST_DATE = '2000-01-01'
const LATEST_DATE = '2099-12-31'

/**
 * 지급 처리(지급 완료 · 지급 취소)를 할 수 있는 사람 = axhub 가 "관리자" 로 알려 준 사람.
 * is_admin 은 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자일 때 true 예요 (AXHUB.md §7).
 */
export function isManager(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

/** 아직 지급하지 않은 건을 고치거나 지울 수 있는지 — 등록한 사람 본인이거나 관리자. */
export function canEdit(visitor: AxhubMe, createdByKey: string): boolean {
  return isManager(visitor) || (visitor.authenticated && visitor.user_id === createdByKey)
}

export function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  // 2026-02-30 같은 없는 날짜를 걸러요 (Date 는 3월 2일로 넘겨 버려요).
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d
}

/** 앞뒤 공백을 지우고 가운데 공백은 한 칸으로 — "한빛  상사" 와 "한빛 상사" 가 다른 거래처가 되지 않게. */
export function cleanText(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

/** '1,500,000' · '1500000원' → 1500000. 숫자가 아니면 NaN. */
export function parseAmount(s: string): number {
  const digits = s.replace(/[,\s원]/g, '')
  return /^\d{1,12}$/.test(digits) ? Number(digits) : Number.NaN
}

export type PaymentInput = { vendor: string; amount: string; dueDate: string; memo: string }
export type PaymentValue = { vendor: string; amount: number; dueDate: string; memo: string }

/** 지급 건 입력값 검사. 통과하면 저장할 값을, 아니면 사용자에게 보여 줄 문구를 돌려줘요. */
export function validatePayment(input: PaymentInput): { ok: true; value: PaymentValue } | { ok: false; error: string } {
  const vendor = cleanText(input.vendor)
  const memo = cleanText(input.memo)
  const amount = parseAmount(input.amount)

  if (!vendor) return { ok: false, error: '거래처를 적어 주세요.' }
  if (vendor.length > VENDOR_MAX) return { ok: false, error: `거래처는 ${VENDOR_MAX}자 안으로 적어 주세요.` }
  if (Number.isNaN(amount)) return { ok: false, error: '금액은 숫자로만 적어 주세요.' }
  if (amount < 1) return { ok: false, error: '금액은 1원 이상이어야 해요.' }
  if (amount > AMOUNT_MAX) return { ok: false, error: `금액은 한 건에 ${formatWon(AMOUNT_MAX)}까지 적을 수 있어요.` }
  if (!parseDate(input.dueDate)) return { ok: false, error: '지급 예정일을 골라 주세요.' }
  if (input.dueDate < OLDEST_DATE || input.dueDate > LATEST_DATE) return { ok: false, error: '지급 예정일을 다시 확인해 주세요.' }
  if (memo.length > MEMO_MAX) return { ok: false, error: `메모는 ${MEMO_MAX}자 안으로 적어 주세요.` }
  return { ok: true, value: { vendor, amount, dueDate: input.dueDate, memo } }
}

/** 지급일 검사. 오늘(KST)보다 뒤인 날은 받지 않아요 — 아직 안 보낸 돈을 보냈다고 적지 않게. */
export function validatePaidDate(s: string, today: string): { ok: true; value: string } | { ok: false; error: string } {
  if (!parseDate(s)) return { ok: false, error: '지급일을 골라 주세요.' }
  if (s > today) return { ok: false, error: '지급일이 오늘보다 뒤예요. 실제로 지급한 날을 골라 주세요.' }
  if (s < OLDEST_DATE) return { ok: false, error: '지급일을 다시 확인해 주세요.' }
  return { ok: true, value: s }
}

// ── 날짜 계산 ─────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' 에 days 일을 더해요. */
export function addDays(s: string, days: number): string {
  const d = new Date(`${s}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** today 가 속한 주의 월요일 · 일요일. 한 주는 월요일에 시작해요. */
export function weekRange(today: string): { monday: string; sunday: string } {
  const wd = new Date(`${today}T00:00:00Z`).getUTCDay() // 0=일
  const monday = addDays(today, wd === 0 ? -6 : 1 - wd)
  return { monday, sunday: addDays(monday, 6) }
}

/** from 에서 to 까지 며칠인지 (to 가 뒤면 양수). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

export type PaymentState = 'paid' | 'overdue' | 'due'

/** 지급했으면 paid, 안 했는데 예정일이 오늘보다 앞이면 overdue, 아니면 due. */
export function paymentState(p: { due_date: string; paid_date: string | null }, today: string): PaymentState {
  if (p.paid_date) return 'paid'
  return p.due_date < today ? 'overdue' : 'due'
}

/** 목록 거르기 — 지급 일정 화면의 탭. */
export const FILTER_LABEL = { unpaid: '미지급', overdue: '지급 지연', paid: '지급 완료', all: '전체' } as const
export type PaymentFilter = keyof typeof FILTER_LABEL

export function filterOf(v: string | undefined): PaymentFilter {
  return v && Object.hasOwn(FILTER_LABEL, v) ? (v as PaymentFilter) : 'unpaid'
}

// ── 한국 시간(KST) 표시 ─────────────────────────────────────────────────────

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** 오늘 날짜(KST) 'YYYY-MM-DD'. */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}

/** '2026-10-08' → '10월 8일 (목)'. today 와 해가 다르면 연도도 붙여요. 날짜 값이라 시간대 영향이 없어요. */
export function formatDate(s: string, today: string): string {
  const d = parseDate(s)
  if (!d) return s
  const year = s.slice(0, 4) === today.slice(0, 4) ? '' : `${d.getUTCFullYear()}년 `
  return `${year}${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY[d.getUTCDay()]})`
}

/** 1500000 → '1,500,000원'. */
export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}
