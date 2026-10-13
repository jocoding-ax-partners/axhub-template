// 비품 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/supply-check.mjs)
import type { AxhubMe } from './axhub-server'

export const NAME_MAX = 50
export const NOTE_MAX = 200
/** 한 번에 신청할 수 있는 최대 수량. */
export const REQUEST_MAX = 1_000
/** 재고 · 최소 재고 · 입고 수량의 상한 (오타로 엄청난 숫자가 들어가지 않게). */
export const STOCK_MAX = 1_000_000

export const STATUS_LABEL = { pending: '대기', issued: '지급', rejected: '반려' } as const
export type RequestStatus = keyof typeof STATUS_LABEL

/**
 * 비품 등록 · 입고 · 지급 · 반려를 할 수 있는 사람 = axhub 가 "관리자" 로 알려 준 사람.
 * is_admin 은 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자일 때 true 예요 (AXHUB.md §7).
 */
export function isAdmin(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

/** 재고가 최소 재고 아래로 내려가면 "부족". 최소 재고가 0 이면 늘 넉넉해요. */
export function isShort(stock: number, minStock: number): boolean {
  return stock < minStock
}

/** 폼의 숫자 칸 읽기 — 정수이고 [min, max] 안이면 그 값, 아니면 null. */
export function parseCount(v: string, min: number, max: number): number | null {
  const s = v.trim()
  if (!/^\d{1,9}$/.test(s)) return null
  const n = Number(s)
  return n >= min && n <= max ? n : null
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export type SupplyInput = { name: string; stock: string; minStock: string }
export type SupplyValue = { name: string; stock: number; minStock: number }

/** 비품 등록 값 검사. 이름만 고칠 땐 stock 을 검사하지 않아요(withStock=false). */
export function validateSupply(input: SupplyInput, withStock = true): Result<SupplyValue> {
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (!name) return { ok: false, error: '비품 이름을 적어 주세요.' }
  if (name.length > NAME_MAX) return { ok: false, error: `비품 이름은 ${NAME_MAX}자 안으로 적어 주세요.` }
  const stock = withStock ? parseCount(input.stock, 0, STOCK_MAX) : 0
  if (stock === null) return { ok: false, error: `현재 재고는 0 ~ ${STOCK_MAX.toLocaleString('ko-KR')} 사이 숫자로 적어 주세요.` }
  const minStock = parseCount(input.minStock, 0, STOCK_MAX)
  if (minStock === null) return { ok: false, error: `최소 재고는 0 ~ ${STOCK_MAX.toLocaleString('ko-KR')} 사이 숫자로 적어 주세요.` }
  return { ok: true, value: { name, stock, minStock } }
}

export type RequestValue = { qty: number; note: string }

/** 비품 신청 값 검사. */
export function validateRequest(input: { qty: string; note: string }): Result<RequestValue> {
  const qty = parseCount(input.qty, 1, REQUEST_MAX)
  if (qty === null) return { ok: false, error: `수량은 1 ~ ${REQUEST_MAX.toLocaleString('ko-KR')} 사이로 적어 주세요.` }
  const note = input.note.trim()
  if (note.length > NOTE_MAX) return { ok: false, error: `메모는 ${NOTE_MAX}자 안으로 적어 주세요.` }
  return { ok: true, value: { qty, note } }
}

/** 입고하면 재고 상한을 넘는지. */
export function exceedsStockMax(stock: number, add: number): boolean {
  return stock + add > STOCK_MAX
}

/** DB id(bigint) 모양인지 — 폼으로 들어온 id 는 이걸로 먼저 걸러요. */
export function isId(v: string): boolean {
  return /^[1-9]\d{0,17}$/.test(v)
}

/** 검색어 → ILIKE 패턴 (% _ \ 는 글자 그대로 찾게). */
export function likePattern(q: string): string {
  return '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
}

/** 1234 → '1,234'. */
export function formatCount(n: number): string {
  return n.toLocaleString('ko-KR')
}

/** 시각 → KST '2026. 10. 8. 오후 3:20'. */
export function formatDateTime(t: Date): string {
  return t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}
