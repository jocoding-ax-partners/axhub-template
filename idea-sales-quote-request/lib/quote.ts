// 견적 요청 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/quote-check.mjs)
import type { AxhubMe } from './axhub-server'

/** 상태 — 접수 → 견적 발송 → 수주 / 실패. 저장은 영문 코드, 화면은 한글 이름. */
export const STATUS_LABEL = { received: '접수', quoted: '견적 발송', won: '수주', lost: '실패' } as const
export type QuoteStatus = keyof typeof STATUS_LABEL
export const STATUSES = Object.keys(STATUS_LABEL) as QuoteStatus[]

export function isQuoteStatus(v: string): v is QuoteStatus {
  return Object.hasOwn(STATUS_LABEL, v)
}

/** 수주·실패는 끝난 요청이에요 — 납기 지남 표시를 하지 않아요. */
export function isClosed(status: QuoteStatus): boolean {
  return status === 'won' || status === 'lost'
}

export const LIMITS = { company: 100, contact: 50, phone: 20, item: 200 } as const
export const QUANTITY_MAX = 100_000_000

/**
 * 팀장 = axhub 가 "관리자" 로 알려 준 사람 (is_admin: 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자, AXHUB.md §7).
 * 담당자 배정 · 상태 변경 · 전체 요청 보기를 할 수 있어요. 판단은 이 함수 한 곳에서만 해요.
 */
export function isLeader(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  // 2026-02-30 같은 없는 날짜를 걸러요 (Date 는 3월 2일로 넘겨 버려요).
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d
}

export type QuoteInput = { company: string; contactName: string; contactPhone: string; item: string; quantity: string; dueDate: string }
export type QuoteRequest = { company: string; contactName: string; contactPhone: string; item: string; quantity: number; dueDate: string }

/** 등록 값 검사. 통과하면 저장할 값을, 아니면 사용자에게 보여 줄 문구를 돌려줘요. today 는 KST 'YYYY-MM-DD'. */
export function validateQuote(input: QuoteInput, today: string): { ok: true; value: QuoteRequest } | { ok: false; error: string } {
  const company = input.company.trim()
  const contactName = input.contactName.trim()
  const contactPhone = input.contactPhone.trim()
  const item = input.item.trim()
  const quantityText = input.quantity.trim()
  const dueDate = input.dueDate.trim()

  if (!company) return { ok: false, error: '회사명을 적어 주세요.' }
  if (company.length > LIMITS.company) return { ok: false, error: `회사명은 ${LIMITS.company}자 안으로 적어 주세요.` }
  if (!contactName) return { ok: false, error: '고객 담당자 이름을 적어 주세요.' }
  if (contactName.length > LIMITS.contact) return { ok: false, error: `고객 담당자 이름은 ${LIMITS.contact}자 안으로 적어 주세요.` }
  if (!contactPhone) return { ok: false, error: '연락처를 적어 주세요.' }
  // 숫자 · + · - · 공백 · 괄호만, 숫자는 8~15개 (국내 · 해외 번호 모두).
  const digits = contactPhone.replace(/\D/g, '').length
  if (!/^[0-9+\-() ]+$/.test(contactPhone) || digits < 8 || digits > 15 || contactPhone.length > LIMITS.phone)
    return { ok: false, error: '연락처는 숫자와 - 로 적어 주세요. 예: 010-1234-5678' }
  if (!item) return { ok: false, error: '요청 품목을 적어 주세요.' }
  if (item.length > LIMITS.item) return { ok: false, error: `요청 품목은 ${LIMITS.item}자 안으로 적어 주세요.` }
  if (!/^\d+$/.test(quantityText)) return { ok: false, error: '수량은 1 이상의 정수로 적어 주세요.' }
  const quantity = Number(quantityText)
  if (quantity < 1) return { ok: false, error: '수량은 1 이상의 정수로 적어 주세요.' }
  if (quantity > QUANTITY_MAX) return { ok: false, error: `수량은 ${QUANTITY_MAX.toLocaleString('ko-KR')} 이하로 적어 주세요.` }
  if (!parseDate(dueDate)) return { ok: false, error: '희망 납기를 골라 주세요.' }
  if (dueDate < today) return { ok: false, error: '희망 납기가 이미 지난 날짜예요.' }
  return { ok: true, value: { company, contactName, contactPhone, item, quantity, dueDate } }
}

/** 목록 검색어 정리 — 앞뒤 공백을 빼고 50자까지만. */
export function cleanQuery(v: string | undefined): string {
  return (v ?? '').trim().slice(0, 50)
}

/** 목록 상태 필터 — 모르는 값은 '전체'(null). */
export function statusOf(v: string | undefined): QuoteStatus | null {
  return v && isQuoteStatus(v) ? v : null
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

/** 시각 → KST '2026. 10. 8. 오후 3:20'. */
export function formatDateTime(t: Date): string {
  return t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}

/** 납기까지 남은 날 — 'D-3' · '오늘' · '3일 지남'. 끝난 요청은 빈 문자열. */
export function dueLabel(due: string, today: string, status: QuoteStatus): string {
  if (isClosed(status)) return ''
  const a = parseDate(due)
  const b = parseDate(today)
  if (!a || !b) return ''
  const diff = Math.round((a.getTime() - b.getTime()) / 86_400_000)
  if (diff === 0) return '오늘 납기'
  return diff > 0 ? `D-${diff}` : `${-diff}일 지남`
}
