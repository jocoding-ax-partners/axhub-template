// 영업 실적 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/sales-check.mjs)
import type { AxhubMe } from './axhub-server'

export const CUSTOMER_MAX = 100
/** 계약 한 건 금액 상한(원). 1조 원 미만이에요. */
export const AMOUNT_MAX = 999_999_999_999
/** 이보다 오래된 계약일은 받지 않아요 (오타로 0026년 같은 값이 들어가는 걸 막아요). */
export const DATE_MIN = '2000-01-01'
/** 차트에 보여 줄 개월 수 (고른 달까지). */
export const TREND_MONTHS = 6

/**
 * 관리자 = axhub 가 "관리자" 로 알려 준 사람 (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자, AXHUB.md §7).
 * 관리자는 다른 사람이 넣은 계약도 지울 수 있어요.
 */
export function isManager(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

/** 계약을 지울 수 있는 사람 — 넣은 본인 또는 관리자. */
export function canDelete(visitor: AxhubMe, ownerKey: string): boolean {
  return visitor.authenticated && (visitor.user_id === ownerKey || isManager(visitor))
}

// ── 날짜 · 월 (KST) ─────────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  // 2026-02-30 같은 없는 날짜를 걸러요 (Date 는 3월 2일로 넘겨 버려요).
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d
}

/** 오늘 날짜(KST) 'YYYY-MM-DD'. */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}

export const isMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)

/** 주소의 ?month= 를 읽어요. 없거나 이상하거나 이번 달(KST)보다 뒤면 이번 달. */
export function monthOf(v: string | undefined, now: Date = new Date()): string {
  const thisMonth = kstToday(now).slice(0, 7)
  return isMonth(v) && v >= DATE_MIN.slice(0, 7) && v <= thisMonth ? v : thisMonth
}

/** 'YYYY-MM' 에서 d 개월 이동. 숫자로만 계산해서 시간대 영향이 없어요. */
export function shiftMonth(ym: string, d: number): string {
  const [y, m] = ym.split('-').map(Number)
  const t = y * 12 + (m - 1) + d
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

/** ym 으로 끝나는 최근 n 개월 (오래된 달부터). */
export function lastMonths(ym: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftMonth(ym, i - n + 1))
}

/** 그 달의 [첫날, 다음 달 첫날) — SQL 에서 contract_date >= from AND < to 로 써요. */
export function monthRange(ym: string): { from: string; to: string } {
  return { from: `${ym}-01`, to: `${shiftMonth(ym, 1)}-01` }
}

// ── 입력 검사 ────────────────────────────────────────────────────────────────

/** '1,200,000' · '1200000' → 1200000. 숫자가 아니거나 소수면 null. */
export function parseAmount(v: string): number | null {
  const s = v.replace(/[,\s원]/g, '')
  if (!/^\d{1,13}$/.test(s)) return null
  return Number(s)
}

export type ContractInput = { date: string; customer: string; amount: string }
export type Contract = { date: string; customer: string; amount: number }

/** 계약 값 검사. 통과하면 저장할 값을, 아니면 사용자에게 보여 줄 문구를 돌려줘요. */
export function validateContract(
  input: ContractInput,
  now: Date = new Date(),
): { ok: true; value: Contract } | { ok: false; error: string } {
  const customer = input.customer.trim().replace(/\s+/g, ' ')
  if (!parseDate(input.date)) return { ok: false, error: '계약일을 골라 주세요.' }
  if (input.date < DATE_MIN) return { ok: false, error: '계약일을 다시 확인해 주세요.' }
  if (input.date > kstToday(now)) return { ok: false, error: '계약일은 오늘이나 그 전 날짜로 골라 주세요.' }
  if (!customer) return { ok: false, error: '고객사를 적어 주세요.' }
  if (customer.length > CUSTOMER_MAX) return { ok: false, error: `고객사는 ${CUSTOMER_MAX}자 안으로 적어 주세요.` }
  const amount = parseAmount(input.amount)
  if (amount === null || amount < 1) return { ok: false, error: '금액은 1원 이상 숫자로 적어 주세요.' }
  if (amount > AMOUNT_MAX) return { ok: false, error: '금액이 너무 커요. 1조 원 미만으로 적어 주세요.' }
  return { ok: true, value: { date: input.date, customer, amount } }
}

// ── 표시 ─────────────────────────────────────────────────────────────────────

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** 1200000 → '1,200,000원'. */
export function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

/** 차트 눈금용 짧은 금액. 123_400_000 → '1.2억', 34_000_000 → '3,400만', 5_000 → '5,000'. */
export function wonShort(n: number): string {
  if (n >= 100_000_000) {
    const v = n / 100_000_000
    return `${v >= 100 ? Math.round(v).toLocaleString('ko-KR') : String(Math.round(v * 10) / 10)}억`
  }
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString('ko-KR')}만`
  return n.toLocaleString('ko-KR')
}

/** '2026-10' → '2026년 10월'. */
export function formatMonth(ym: string): string {
  return `${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월`
}

/** '2026-10' → '10월' (차트 가로축). 1월이면 해도 붙여요 → '27년 1월'. */
export function formatMonthShort(ym: string): string {
  const m = Number(ym.slice(5, 7))
  return m === 1 ? `${ym.slice(2, 4)}년 1월` : `${m}월`
}

/** '2026-10-08' → '10월 8일 (목)'. 날짜 값이라 시간대 영향이 없어요. */
export function formatDate(s: string): string {
  const d = parseDate(s)
  if (!d) return s
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY[d.getUTCDay()]})`
}

/** 지난달 대비 증감 문구. 지난달이 0 이면 비교하지 않아요. */
export function changeVsPrev(cur: number, prev: number): string {
  if (prev <= 0) return cur > 0 ? '지난달 실적이 없어요' : '아직 실적이 없어요'
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return '지난달과 같아요'
  return `지난달보다 ${Math.abs(pct)}% ${pct > 0 ? '늘었어요' : '줄었어요'}`
}

/** 팀 합계 중 비중(%) — 소수 첫째 자리. */
export function sharePct(part: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((part / total) * 1000) / 10}%`
}
