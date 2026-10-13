// 구매 요청 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/purchase-check.mjs)
import type { AxhubMe } from './axhub-server'

/** 총액이 이 금액(원) 이상이면 "고액" 표시가 붙어요. 바꾸면 이미 올라온 요청의 표시도 같이 바뀌어요. */
export const HIGH_VALUE_THRESHOLD = 1_000_000

export const STATUS_LABEL = { pending: '대기', approved: '승인', rejected: '반려' } as const
export type PurchaseStatus = keyof typeof STATUS_LABEL

export const ITEM_MAX = 100
export const REASON_MAX = 500
export const REJECT_REASON_MAX = 200
export const QUANTITY_MAX = 10_000
/** 단가 상한 10억 원. 수량 상한과 곱해도 총액이 JS 숫자로 정확히 다뤄지는 범위예요. */
export const UNIT_PRICE_MAX = 1_000_000_000

export function isStatus(v: string): v is PurchaseStatus {
  return Object.hasOwn(STATUS_LABEL, v)
}

export function isHighValue(total: number): boolean {
  return total >= HIGH_VALUE_THRESHOLD
}

/**
 * 승인·반려할 수 있는 사람 = axhub 가 "관리자" 로 알려 준 사람.
 * is_admin 은 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자일 때 true 예요 (AXHUB.md §7).
 */
export function isApprover(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

/** '1,200,000' · ' 3 ' 같은 입력을 정수로. 정수가 아니면 null. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[,\s]/g, '')
  if (!/^\d{1,13}$/.test(s)) return null
  return Number(s)
}

export type PurchaseInput = { item: string; quantity: string; unitPrice: string; reason: string }
export type PurchaseRequest = { item: string; quantity: number; unitPrice: number; reason: string; total: number }

/** 요청 값 검사. 통과하면 저장할 값을, 아니면 사용자에게 보여 줄 문구를 돌려줘요. */
export function validatePurchase(input: PurchaseInput): { ok: true; value: PurchaseRequest } | { ok: false; error: string } {
  const item = input.item.trim()
  const reason = input.reason.trim()
  if (!item) return { ok: false, error: '품목을 적어 주세요.' }
  if (item.length > ITEM_MAX) return { ok: false, error: `품목은 ${ITEM_MAX}자 안으로 적어 주세요.` }
  const quantity = parseAmount(input.quantity)
  if (quantity === null || quantity < 1 || quantity > QUANTITY_MAX)
    return { ok: false, error: `수량은 1부터 ${QUANTITY_MAX.toLocaleString('ko-KR')} 사이의 정수로 적어 주세요.` }
  const unitPrice = parseAmount(input.unitPrice)
  if (unitPrice === null || unitPrice < 1 || unitPrice > UNIT_PRICE_MAX)
    return { ok: false, error: `단가는 1원부터 ${won(UNIT_PRICE_MAX)} 사이의 정수로 적어 주세요.` }
  if (!reason) return { ok: false, error: '구매 사유를 적어 주세요.' }
  if (reason.length > REASON_MAX) return { ok: false, error: `구매 사유는 ${REASON_MAX}자 안으로 적어 주세요.` }
  return { ok: true, value: { item, quantity, unitPrice, reason, total: quantity * unitPrice } }
}

// ── 표시 ────────────────────────────────────────────────────────────────────

/** 1200000 → '1,200,000원'. */
export function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

/** 시각 → KST '2026. 10. 8. 오후 3:20'. */
export function formatDateTime(t: Date): string {
  return t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}
