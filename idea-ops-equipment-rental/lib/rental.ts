// 장비 대여 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/rental-check.mjs)
import type { AxhubMe } from './axhub-server'

export const NAME_MAX = 100
export const KIND_MAX = 50
export const ASSET_NO_MAX = 50
/** 한 번에 빌릴 수 있는 최대 기간(오늘부터 며칠 뒤까지 반납 예정일로 고를 수 있는지). */
export const DUE_MAX_DAYS = 90

/** 장비 목록 보기 — 전체 · 대여 가능 · 대여 중 · 반납 지연 */
export const FILTER_LABEL = { all: '전체', available: '대여 가능', rented: '대여 중', overdue: '반납 지연' } as const
export type Filter = keyof typeof FILTER_LABEL

export function filterOf(v: string | undefined): Filter {
  return v && Object.hasOwn(FILTER_LABEL, v) ? (v as Filter) : 'all'
}

/**
 * 장비를 등록·목록에서 빼고, 남이 빌린 장비를 대신 반납 처리할 수 있는 사람 = axhub 가 "관리자" 로 알려 준 사람.
 * is_admin 은 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자일 때 true 예요 (AXHUB.md §7).
 */
export function isAdmin(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

/** 반납은 빌린 본인 또는 관리자만. */
export function canReturn(visitor: AxhubMe, borrowerKey: string): boolean {
  return visitor.authenticated && (visitor.user_id === borrowerKey || visitor.is_admin)
}

/** "2026-10-12" 처럼 실제로 있는 날짜인지 (2월 30일 같은 날은 거절). */
export function isDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** "YYYY-MM-DD" 에 n 일을 더해요. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** 두 날짜 사이 일수 (to − from). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** 반납 예정일이 지났는지. 예정일 당일은 아직 지연이 아니에요. */
export function isOverdue(due: string, today: string): boolean {
  return due < today
}

export type EquipmentInput = { name: string; kind: string; assetNo: string }

/** 장비 등록 값 검사. 통과하면 저장할 값을, 아니면 사용자에게 보여 줄 문구를 돌려줘요. */
export function validateEquipment(input: EquipmentInput): { ok: true; value: EquipmentInput } | { ok: false; error: string } {
  const name = input.name.trim()
  const kind = input.kind.trim()
  const assetNo = input.assetNo.trim()
  if (!name) return { ok: false, error: '장비 이름을 적어 주세요.' }
  if (name.length > NAME_MAX) return { ok: false, error: `장비 이름은 ${NAME_MAX}자 안으로 적어 주세요.` }
  if (!kind) return { ok: false, error: '종류를 적어 주세요.' }
  if (kind.length > KIND_MAX) return { ok: false, error: `종류는 ${KIND_MAX}자 안으로 적어 주세요.` }
  if (!assetNo) return { ok: false, error: '자산 번호를 적어 주세요.' }
  if (assetNo.length > ASSET_NO_MAX) return { ok: false, error: `자산 번호는 ${ASSET_NO_MAX}자 안으로 적어 주세요.` }
  return { ok: true, value: { name, kind, assetNo } }
}

/** 반납 예정일 검사 — 오늘부터 DUE_MAX_DAYS 일 뒤까지. */
export function validateDue(due: string, today: string): { ok: true } | { ok: false; error: string } {
  if (!isDay(due)) return { ok: false, error: '반납 예정일을 골라 주세요.' }
  if (due < today) return { ok: false, error: '반납 예정일은 오늘이나 그 뒤로 골라 주세요.' }
  if (daysBetween(today, due) > DUE_MAX_DAYS) return { ok: false, error: `반납 예정일은 오늘부터 ${DUE_MAX_DAYS}일 안으로 골라 주세요.` }
  return { ok: true }
}

// ── 한국 시간(KST) 표시 ─────────────────────────────────────────────────────

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** 오늘 날짜(KST) 'YYYY-MM-DD'. 서버는 UTC 로 돌아요. */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}

/** '2026-10-08' → '2026년 10월 8일 (목)'. 날짜 값이라 시간대 영향이 없어요. */
export function formatDate(s: string): string {
  if (!isDay(s)) return s
  const d = new Date(`${s}T00:00:00Z`)
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY[d.getUTCDay()]})`
}

/** 반납 예정일까지 남은 날 — '오늘까지' · '3일 남음' · '2일 지남'. */
export function dueHint(due: string, today: string): string {
  const n = daysBetween(today, due)
  if (n === 0) return '오늘까지'
  return n > 0 ? `${n}일 남음` : `${-n}일 지남`
}

/** 시각 → KST '2026. 10. 8. 오후 3:20'. */
export function formatDateTime(t: Date): string {
  return t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}
