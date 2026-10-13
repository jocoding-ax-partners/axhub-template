// 택배·우편 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/parcel-check.mjs)
import type { AxhubMe } from './axhub-server'

export const KIND_LABEL = { parcel: '택배', mail: '우편' } as const
export type ParcelKind = keyof typeof KIND_LABEL

export const NAME_MAX = 50
export const EMAIL_MAX = 200
export const SENDER_MAX = 100
export const LOCATION_MAX = 50
export const MEMO_MAX = 100

/** 도착하고 이만큼(일) 지나도 안 찾아가면 담당자 화면에서 "오래됨" 으로 표시해요. */
export const STALE_DAYS = 3

export function isParcelKind(v: string): v is ParcelKind {
  return Object.hasOwn(KIND_LABEL, v)
}

/**
 * 안내데스크 담당자 = axhub 가 "관리자" 로 알려 준 사람.
 * is_admin 은 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자일 때 true 예요 (AXHUB.md §7).
 */
export function isDesk(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

/** 받는 사람 비교용 이메일 — 앞뒤 공백을 지우고 소문자로 맞춰요. */
export function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

// 이메일 모양만 봐요 (실제로 있는 주소인지는 알 수 없어요).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ParcelInput = { kind: string; recipientEmail: string; recipientName: string; sender: string; location: string; memo: string }
export type NewParcel = { kind: ParcelKind; recipientEmail: string; recipientName: string; sender: string; location: string; memo: string }

/** 등록 값 검사. 통과하면 저장할 값을, 아니면 사용자에게 보여 줄 문구를 돌려줘요. */
export function validateParcel(input: ParcelInput): { ok: true; value: NewParcel } | { ok: false; error: string } {
  const kind = input.kind
  const recipientEmail = normalizeEmail(input.recipientEmail)
  const recipientName = input.recipientName.trim()
  const sender = input.sender.trim()
  const location = input.location.trim()
  const memo = input.memo.trim()
  if (!isParcelKind(kind)) return { ok: false, error: '택배인지 우편인지 골라 주세요.' }
  if (!recipientEmail) return { ok: false, error: '받는 사람 이메일을 적어 주세요.' }
  if (recipientEmail.length > EMAIL_MAX || !EMAIL_RE.test(recipientEmail))
    return { ok: false, error: '받는 사람 이메일 형식을 확인해 주세요. 예: hong@company.com' }
  if (recipientName.length > NAME_MAX) return { ok: false, error: `받는 사람 이름은 ${NAME_MAX}자 안으로 적어 주세요.` }
  if (!sender) return { ok: false, error: '보낸 곳을 적어 주세요.' }
  if (sender.length > SENDER_MAX) return { ok: false, error: `보낸 곳은 ${SENDER_MAX}자 안으로 적어 주세요.` }
  if (!location) return { ok: false, error: '보관 위치를 적어 주세요.' }
  if (location.length > LOCATION_MAX) return { ok: false, error: `보관 위치는 ${LOCATION_MAX}자 안으로 적어 주세요.` }
  if (memo.length > MEMO_MAX) return { ok: false, error: `메모는 ${MEMO_MAX}자 안으로 적어 주세요.` }
  return { ok: true, value: { kind, recipientEmail, recipientName, sender, location, memo } }
}

// ── 한국 시간(KST) 표시 ─────────────────────────────────────────────────────

const DAY_MS = 86_400_000
const KST_MS = 9 * 3_600_000

/** 그 시각의 한국 날짜 'YYYY-MM-DD'. */
export function kstDate(t: Date): string {
  return new Date(t.getTime() + KST_MS).toISOString().slice(0, 10)
}

/** 도착한 날부터 오늘까지 며칠 지났는지 (한국 날짜 기준 — 오늘 도착이면 0). */
export function daysWaiting(arrivedAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.round((Date.parse(kstDate(now)) - Date.parse(kstDate(arrivedAt))) / DAY_MS))
}

/** 0 → '오늘 도착', 1 → '어제 도착', 5 → '5일째 보관 중'. */
export function waitingLabel(days: number): string {
  if (days === 0) return '오늘 도착'
  if (days === 1) return '어제 도착'
  return `${days}일째 보관 중`
}

/** 시각 → KST '2026. 10. 8. 오후 3:20'. */
export function formatDateTime(t: Date): string {
  return t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}

/** 받는 사람 표시 — 이름이 있으면 '홍길동 (hong@…)', 없으면 이메일만. */
export function recipientLabel(name: string, email: string): string {
  return name ? `${name} (${email})` : email
}
