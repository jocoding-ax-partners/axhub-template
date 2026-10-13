// 고장 신고 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/facility-check.mjs)
import type { AxhubMe } from './axhub-server'

export const STATUS_LABEL = { received: '접수', in_progress: '처리 중', done: '완료' } as const
export type ReportStatus = keyof typeof STATUS_LABEL
export const STATUSES = Object.keys(STATUS_LABEL) as ReportStatus[]

export const LOCATION_MAX = 100
export const DESCRIPTION_MAX = 1000
export const MEMO_MAX = 1000

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type PhotoType = (typeof PHOTO_TYPES)[number]
export const PHOTO_TOO_BIG = '사진은 10MB 이하만 올릴 수 있어요.'
export const PHOTO_BAD_TYPE = '사진은 JPG · PNG · WEBP 만 올릴 수 있어요.'

export function isStatus(v: string): v is ReportStatus {
  return Object.hasOwn(STATUS_LABEL, v)
}

/**
 * 담당자 = axhub 가 "관리자" 로 알려 준 사람.
 * is_admin 은 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자일 때 true 예요 (AXHUB.md §7).
 */
export function isManager(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

export type ReportInput = { location: string; description: string }

/** 신고 값 검사. 통과하면 저장할 값을, 아니면 사용자에게 보여 줄 문구를 돌려줘요. */
export function validateReport(raw: { location: unknown; description: unknown }): { ok: true; value: ReportInput } | { ok: false; error: string } {
  const location = String(raw.location ?? '').trim()
  const description = String(raw.description ?? '').trim()
  if (!location) return { ok: false, error: '고장 난 위치를 적어 주세요.' }
  if (location.length > LOCATION_MAX) return { ok: false, error: `위치는 ${LOCATION_MAX}자 안으로 적어 주세요.` }
  if (!description) return { ok: false, error: '어떤 고장인지 적어 주세요.' }
  if (description.length > DESCRIPTION_MAX) return { ok: false, error: `내용은 ${DESCRIPTION_MAX}자 안으로 적어 주세요.` }
  return { ok: true, value: { location, description } }
}

export type ReportUpdate = { id: string; status: ReportStatus; memo: string; version: number }

/** 담당자의 상태·메모 저장 값 검사. */
export function validateUpdate(raw: { id: unknown; status: unknown; memo: unknown; version: unknown }): { ok: true; value: ReportUpdate } | { ok: false; error: string } {
  const id = String(raw.id ?? '')
  const status = String(raw.status ?? '')
  const memo = String(raw.memo ?? '').trim()
  const versionText = String(raw.version ?? '')
  if (!/^\d{1,18}$/.test(id) || !/^\d{1,9}$/.test(versionText)) return { ok: false, error: '잘못된 신고예요. 화면을 새로고침해 주세요.' }
  if (!isStatus(status)) return { ok: false, error: '상태를 골라 주세요.' }
  if (memo.length > MEMO_MAX) return { ok: false, error: `처리 메모는 ${MEMO_MAX}자 안으로 적어 주세요.` }
  return { ok: true, value: { id, status, memo, version: Number(versionText) } }
}

// 파일 앞부분(매직 바이트)으로 실제 사진 형식을 알아내요. 확장자·브라우저가 알려 준 형식은 믿지 않아요.
export function sniffImageType(b: Uint8Array): PhotoType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return 'image/png'
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to))
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  return null
}

/** 검색어를 ILIKE 패턴으로. % _ \ 는 글자 그대로 찾게 이스케이프해요. */
export function likePattern(q: string): string {
  return '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
}

/** 시각 → KST '2026. 10. 8. 오후 3:20'. */
export function formatDateTime(t: Date): string {
  return t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}
