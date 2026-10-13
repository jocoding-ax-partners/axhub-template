// 공지 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/notice-check.mjs)
import type { AxhubMe } from './axhub-server'

export const TITLE_MAX = 100
export const BODY_MAX = 10_000

/**
 * 공지를 올리고 확인 현황을 볼 수 있는 사람 = axhub 가 "관리자" 로 알려 준 사람.
 * is_admin 은 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자일 때 true 예요 (AXHUB.md §7).
 */
export function isManager(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

export type NoticeInput = { title: string; body: string; important: boolean }

/** 공지 값 검사. 통과하면 저장할 값을, 아니면 칸별 안내를 돌려줘요. */
export function validateNotice(input: {
  title: string
  body: string
  important: string
}): { ok: true; value: NoticeInput } | { ok: false; errors: Record<string, string> } {
  const title = input.title.trim()
  // 본문은 줄바꿈을 살려요 — 앞뒤 빈 줄만 걷어 내요.
  const body = input.body.replace(/^\s*\n|\s+$/g, '')
  const errors: Record<string, string> = {}
  if (!title) errors.title = '제목을 적어 주세요.'
  else if (title.length > TITLE_MAX) errors.title = `제목은 ${TITLE_MAX}자 안으로 적어 주세요.`
  if (!body.trim()) errors.body = '본문을 적어 주세요.'
  else if (body.length > BODY_MAX) errors.body = `본문은 ${BODY_MAX.toLocaleString('ko-KR')}자 안으로 적어 주세요.`
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { title, body, important: input.important === 'on' || input.important === 'true' } }
}

/** 확인률(%) — 소수점은 버려요. 100% 는 모두 확인했을 때만 보여요. */
export function readRate(read: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.floor((read / total) * 100))
}

/** 주소의 공지 번호 검사. */
export function isNoticeId(v: string): boolean {
  return /^[1-9]\d{0,17}$/.test(v)
}

/** 시각 → KST '2026. 10. 8. 오후 3:20'. */
export function formatDateTime(t: Date): string {
  return t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}
