// 예산 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/budget-check.mjs)
import type { AxhubMe } from './axhub-server'

/** 집행률이 이 값(%) 이상이면 표에서 강조해요. */
export const WARN_RATE = 90

/** 금액 한 칸의 상한 — 10조 원. 합계를 내도 JS 숫자가 정확한 범위 안이에요. */
export const AMOUNT_MAX = 10_000_000_000_000
export const DEPT_NAME_MAX = 30
export const DESC_MAX = 200
export const EMAIL_MAX = 254
export const YEAR_MIN = 2000
export const YEAR_MAX = 2100

/**
 * 예산 등록·부서 관리를 할 수 있는 사람 = axhub 가 "관리자" 로 알려 준 사람.
 * is_admin 은 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자일 때 true 예요 (AXHUB.md §7).
 */
export function isBudgetAdmin(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

/** 담당자 비교용 이메일 — 앞뒤 공백을 빼고 소문자로. */
export function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

/** 집행률(%) — 소수 첫째 자리까지. 예산이 0 이면 집행이 있으면 100%, 없으면 0% 로 봐요. */
export function usageRate(budget: number, spent: number): number {
  if (budget <= 0) return spent > 0 ? 100 : 0
  return Math.round((spent / budget) * 1000) / 10
}

/** 집행률 90% 이상인지 — 반올림 전 값으로 판정해요 (89.96% 는 90.0% 로 보여도 강조하지 않아요). */
export function isWarn(budget: number, spent: number): boolean {
  if (budget <= 0) return spent > 0
  return spent * 100 >= budget * WARN_RATE
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

/** '1,200,000' · '1200000' → 1200000. 정수가 아니거나 범위 밖이면 null. */
export function parseAmount(v: string, allowZero: boolean): number | null {
  const s = v.replace(/[,\s원]/g, '')
  if (!/^\d{1,14}$/.test(s)) return null
  const n = Number(s)
  return n > AMOUNT_MAX || n < (allowZero ? 0 : 1) ? null : n
}

export function parseYear(v: string | undefined, fallback: number): number {
  const y = Number(v)
  return Number.isInteger(y) && y >= YEAR_MIN && y <= YEAR_MAX ? y : fallback
}

function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  // 2026-02-30 같은 없는 날짜를 걸러요 (Date 는 3월 2일로 넘겨 버려요).
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function validateDepartmentName(v: string): Result<string> {
  const name = v.trim().replace(/\s+/g, ' ')
  if (!name) return { ok: false, error: '부서 이름을 적어 주세요.' }
  if (name.length > DEPT_NAME_MAX) return { ok: false, error: `부서 이름은 ${DEPT_NAME_MAX}자 안으로 적어 주세요.` }
  return { ok: true, value: name }
}

export function validateBudget(input: { year: string; amount: string }): Result<{ year: number; amount: number }> {
  const year = Number(input.year)
  if (!Number.isInteger(year) || year < YEAR_MIN || year > YEAR_MAX) return { ok: false, error: '연도를 확인해 주세요.' }
  const amount = parseAmount(input.amount, true)
  if (amount === null) return { ok: false, error: '예산은 0원 이상, 10조 원 이하의 숫자로 적어 주세요.' }
  return { ok: true, value: { year, amount } }
}

export function validateManagerEmail(v: string): Result<string> {
  const email = normalizeEmail(v)
  if (!email) return { ok: false, error: '담당자 이메일을 적어 주세요.' }
  if (email.length > EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: '이메일 형식을 확인해 주세요.' }
  return { ok: true, value: email }
}

export type ExpenseInput = { spentOn: string; description: string; amount: string }
export type Expense = { spentOn: string; description: string; amount: number; year: number }

/** 집행 건 값 검사. 미래 날짜는 받지 않아요 (오늘은 KST 기준으로 넘겨받아요). */
export function validateExpense(input: ExpenseInput, today: string): Result<Expense> {
  const description = input.description.trim()
  if (!isRealDate(input.spentOn)) return { ok: false, error: '집행 날짜를 골라 주세요.' }
  if (input.spentOn > today) return { ok: false, error: '아직 오지 않은 날짜는 넣을 수 없어요.' }
  const year = Number(input.spentOn.slice(0, 4))
  if (year < YEAR_MIN) return { ok: false, error: '날짜를 확인해 주세요.' }
  if (!description) return { ok: false, error: '집행 내용을 적어 주세요.' }
  if (description.length > DESC_MAX) return { ok: false, error: `집행 내용은 ${DESC_MAX}자 안으로 적어 주세요.` }
  const amount = parseAmount(input.amount, false)
  if (amount === null) return { ok: false, error: '금액은 1원 이상, 10조 원 이하의 숫자로 적어 주세요.' }
  return { ok: true, value: { spentOn: input.spentOn, description, amount, year } }
}

// ── 표시 (한국 시간 기준) ────────────────────────────────────────────────────

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** 오늘 날짜(KST) 'YYYY-MM-DD'. */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}

/** '2026-10-08' → '2026. 10. 8. (목)'. 날짜 값이라 시간대 영향이 없어요. */
export function formatDate(s: string): string {
  if (!isRealDate(s)) return s
  const d = new Date(`${s}T00:00:00Z`)
  return `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}. (${WEEKDAY[d.getUTCDay()]})`
}

/** 1234567 → '1,234,567원'. 음수는 '-1,000원'. */
export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

export function formatRate(r: number): string {
  return `${r.toFixed(1)}%`
}
