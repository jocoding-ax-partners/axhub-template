// 교육 신청 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/training-check.mjs)
import type { AxhubMe } from './axhub-server'

export const TITLE_MAX = 100
export const LOCATION_MAX = 100
export const DESCRIPTION_MAX = 2000
/** 교육 하나의 최대 정원. 강당 단위 행사까지 넉넉히 잡았어요. */
export const CAPACITY_MAX = 1000

/**
 * 교육을 등록·수정·삭제하고 명단을 볼 수 있는 사람 = axhub 가 "관리자" 로 알려 준 사람.
 * is_admin 은 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자일 때 true 예요 (AXHUB.md §7).
 */
export function isManager(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

/** 신청 버튼 상태 — 신청함 · 신청 가능 · 정원 마감 · 이미 시작(지난 교육). */
export type SignupState = 'mine' | 'open' | 'full' | 'started'

export function signupState(t: { starts_at: Date; capacity: number; signed: number; mine: boolean }, now: Date = new Date()): SignupState {
  if (t.starts_at.getTime() <= now.getTime()) return 'started'
  if (t.mine) return 'mine'
  return t.signed >= t.capacity ? 'full' : 'open'
}

// ── 한국 시간(KST) ─────────────────────────────────────────────────────────
// 서버는 UTC 로 돌아요. 화면의 일시 입력값(시간대 없음)은 늘 한국 시간으로 읽고 써요.

const KST_MS = 9 * 3_600_000
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** 일시 입력값 '2026-11-03T14:00' (한국 시간) → 시각. 없는 날짜·형식이면 null. */
export function parseKstInput(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s)
  if (!m) return null
  const [y, mo, d, h, mi] = m.slice(1).map(Number)
  const t = new Date(Date.UTC(y, mo - 1, d, h, mi) - KST_MS)
  // 2026-02-30 같은 없는 날짜는 Date 가 다음 달로 넘겨 버려요 — 되돌려 비교해서 걸러요.
  return toKstInput(t) === s ? t : null
}

/** 시각 → 일시 입력값 '2026-11-03T14:00' (한국 시간). 수정 폼의 기본값으로 써요. */
export function toKstInput(t: Date): string {
  return new Date(t.getTime() + KST_MS).toISOString().slice(0, 16)
}

/** 시각 → '2026년 11월 3일 (화) 오후 2:00' (한국 시간). */
export function formatWhen(t: Date): string {
  const k = new Date(t.getTime() + KST_MS)
  const h = k.getUTCHours()
  const mi = String(k.getUTCMinutes()).padStart(2, '0')
  const ampm = h < 12 ? '오전' : '오후'
  return `${k.getUTCFullYear()}년 ${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 (${WEEKDAY[k.getUTCDay()]}) ${ampm} ${h % 12 || 12}:${mi}`
}

/** 시각 → '2026. 10. 13. 오후 3:20' (한국 시간). 신청 시각처럼 짧게 보여 줄 때. */
export function formatDateTime(t: Date): string {
  return t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}

// ── 입력 검사 ──────────────────────────────────────────────────────────────

export type TrainingInput = { title: string; description: string; starts_at: string; location: string; capacity: string }
export type TrainingValue = { title: string; description: string; startsAt: Date; location: string; capacity: number }
export type FieldErrors = Partial<Record<keyof TrainingInput, string>>

/**
 * 교육 등록·수정 값 검사. 통과하면 저장할 값을, 아니면 칸별 오류 문구를 돌려줘요.
 * 새로 등록할 땐(isNew) 지난 일시를 막아요. 수정은 오타 고치기처럼 지난 교육도 고칠 수 있어요.
 */
export function validateTraining(
  input: TrainingInput,
  { isNew, now = new Date() }: { isNew: boolean; now?: Date },
): { ok: true; value: TrainingValue } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const title = input.title.trim()
  const description = input.description.trim()
  const location = input.location.trim()
  const capacityText = input.capacity.trim()
  const capacity = Number(capacityText)
  const startsAt = parseKstInput(input.starts_at)

  if (!title) errors.title = '제목을 적어 주세요.'
  else if (title.length > TITLE_MAX) errors.title = `제목은 ${TITLE_MAX}자 안으로 적어 주세요.`
  if (description.length > DESCRIPTION_MAX) errors.description = `설명은 ${DESCRIPTION_MAX}자 안으로 적어 주세요.`
  if (!startsAt) errors.starts_at = '일시를 골라 주세요.'
  else if (isNew && startsAt.getTime() <= now.getTime()) errors.starts_at = '지금보다 뒤의 일시를 골라 주세요.'
  if (!location) errors.location = '장소를 적어 주세요.'
  else if (location.length > LOCATION_MAX) errors.location = `장소는 ${LOCATION_MAX}자 안으로 적어 주세요.`
  if (!/^\d+$/.test(capacityText) || capacity < 1) errors.capacity = '정원을 1명 이상으로 적어 주세요.'
  else if (capacity > CAPACITY_MAX) errors.capacity = `정원은 ${CAPACITY_MAX}명까지 정할 수 있어요.`

  if (Object.keys(errors).length > 0 || !startsAt) return { ok: false, errors }
  return { ok: true, value: { title, description, startsAt, location, capacity } }
}

// ── CSV ──────────────────────────────────────────────────────────────────────

// CSV 한 칸. 따옴표·쉼표·줄바꿈 감싸기 + 엑셀 수식 실행(= + - @ 로 시작) 막기.
function csvCell(v: string | number): string {
  let s = String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// 맨 앞 BOM(﻿) 덕분에 한국어 엑셀에서 더블클릭해도 한글이 깨지지 않아요.
export function toCsv(rows: (string | number)[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
