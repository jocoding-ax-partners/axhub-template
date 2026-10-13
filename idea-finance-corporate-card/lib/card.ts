// 법인카드 사용 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/card-check.mjs)
import type { AxhubMe } from './axhub-server'

export const MERCHANT_MAX = 100
export const DEPARTMENT_MAX = 30
export const PURPOSE_MAX = 200
/** 한 건에 적을 수 있는 최대 금액(원). 오타로 0 을 몇 개 더 붙이는 걸 막아요. */
export const AMOUNT_MAX = 100_000_000
/** 이보다 오래된 사용일은 받지 않아요. */
const OLDEST_DATE = '2000-01-01'

/**
 * 모든 사람의 사용 내역과 월별 합계를 볼 수 있는 사람 = axhub 가 "관리자" 로 알려 준 사람.
 * is_admin 은 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자일 때 true 예요 (AXHUB.md §7).
 */
export function isAdmin(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  // 2026-02-30 같은 없는 날짜를 걸러요 (Date 는 3월 2일로 넘겨 버려요).
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d
}

/** 앞뒤 공백을 지우고 가운데 공백은 한 칸으로 — "영업  팀" 과 "영업 팀" 이 따로 합산되지 않게. */
export function cleanText(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

/** '12,300' · '12300원' → 12300. 숫자가 아니면 NaN. */
export function parseAmount(s: string): number {
  const digits = s.replace(/[,\s원]/g, '')
  return /^\d{1,12}$/.test(digits) ? Number(digits) : Number.NaN
}

export type ExpenseInput = { usedOn: string; merchant: string; amount: string; department: string; purpose: string }
export type Expense = { usedOn: string; merchant: string; amount: number; department: string; purpose: string | null }

/** 사용 건 입력값 검사. 통과하면 저장할 값을, 아니면 사용자에게 보여 줄 문구를 돌려줘요. */
export function validateExpense(input: ExpenseInput, today: string): { ok: true; value: Expense } | { ok: false; error: string } {
  const merchant = cleanText(input.merchant)
  const department = cleanText(input.department)
  const purpose = cleanText(input.purpose)
  const amount = parseAmount(input.amount)

  if (!parseDate(input.usedOn)) return { ok: false, error: '사용일을 골라 주세요.' }
  if (input.usedOn > today) return { ok: false, error: '사용일이 오늘보다 뒤예요.' }
  if (input.usedOn < OLDEST_DATE) return { ok: false, error: '사용일을 다시 확인해 주세요.' }
  if (!merchant) return { ok: false, error: '가맹점을 적어 주세요.' }
  if (merchant.length > MERCHANT_MAX) return { ok: false, error: `가맹점은 ${MERCHANT_MAX}자 안으로 적어 주세요.` }
  if (Number.isNaN(amount)) return { ok: false, error: '금액은 숫자로만 적어 주세요.' }
  if (amount < 1) return { ok: false, error: '금액은 1원 이상이어야 해요.' }
  if (amount > AMOUNT_MAX) return { ok: false, error: `금액은 한 건에 ${formatWon(AMOUNT_MAX)}까지 적을 수 있어요.` }
  if (!department) return { ok: false, error: '부서를 적어 주세요.' }
  if (department.length > DEPARTMENT_MAX) return { ok: false, error: `부서는 ${DEPARTMENT_MAX}자 안으로 적어 주세요.` }
  if (purpose.length > PURPOSE_MAX) return { ok: false, error: `용도는 ${PURPOSE_MAX}자 안으로 적어 주세요.` }
  return { ok: true, value: { usedOn: input.usedOn, merchant, amount, department, purpose: purpose || null } }
}

/** 나중에 채우는 용도 검사. */
export function validatePurpose(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const purpose = cleanText(raw)
  if (!purpose) return { ok: false, error: '용도를 적어 주세요.' }
  if (purpose.length > PURPOSE_MAX) return { ok: false, error: `용도는 ${PURPOSE_MAX}자 안으로 적어 주세요.` }
  return { ok: true, value: purpose }
}

// ── 월 ────────────────────────────────────────────────────────────────────

/** 'YYYY-MM' 이면 그대로, 아니면 null. */
export function parseMonth(s: string | undefined): string | null {
  return s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s) && s >= OLDEST_DATE.slice(0, 7) ? s : null
}

/** '2026-10' → 그 달 첫날과 다음 달 첫날 (from ≤ 사용일 < to). */
export function monthRange(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: `${shiftMonth(month, 1)}-01` }
}

/** '2026-01', -1 → '2025-12'. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

// ── 한국 시간(KST) 표시 ─────────────────────────────────────────────────────

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** 오늘 날짜(KST) 'YYYY-MM-DD'. */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}

/** '2026-10-08' → '10월 8일 (목)'. 날짜 값이라 시간대 영향이 없어요. */
export function formatDate(s: string): string {
  const d = parseDate(s)
  if (!d) return s
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY[d.getUTCDay()]})`
}

/** '2026-10' → '2026년 10월'. */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${y}년 ${m}월`
}

/** 12300 → '12,300원'. */
export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

// ── CSV ──────────────────────────────────────────────────────────────────

// CSV 한 칸. 따옴표·쉼표·줄바꿈 감싸기 + 엑셀 수식 실행(= + - @ 로 시작) 막기.
function csvCell(v: string | number): string {
  let s = String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// 맨 앞 BOM 덕분에 한국어 엑셀에서 더블클릭해도 한글이 깨지지 않아요.
export function toCsv(rows: (string | number)[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
