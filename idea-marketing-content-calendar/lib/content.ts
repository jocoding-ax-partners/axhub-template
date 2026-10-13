// 콘텐츠 캘린더 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/content-check.mjs)
import type { AxhubMe } from './axhub-server'

/**
 * 채널. 색은 디자인 시스템의 의미 색이라 다크 모드에서도 따라가요.
 * 클래스 이름은 Tailwind 가 소스에서 찾아 CSS 를 만들어요 — 문자열을 조립하지 말고 통째로 적어요.
 */
export const CHANNELS = {
  blog: { label: '블로그', dot: 'bg-info', chip: 'bg-info-soft text-info-soft-foreground' },
  instagram: { label: '인스타그램', dot: 'bg-warning', chip: 'bg-warning-soft text-warning-soft-foreground' },
  youtube: { label: '유튜브', dot: 'bg-danger', chip: 'bg-danger-soft text-danger-soft-foreground' },
  newsletter: { label: '뉴스레터', dot: 'bg-success', chip: 'bg-success-soft text-success-soft-foreground' },
} as const
export type Channel = keyof typeof CHANNELS

export const STATUSES = { planning: '기획', writing: '작성 중', review: '검토', published: '발행' } as const
export type Status = keyof typeof STATUSES

export const TITLE_MAX = 100
export const OWNER_MAX = 50
export const MEMO_MAX = 1000

export const isChannel = (v: unknown): v is Channel => typeof v === 'string' && Object.hasOwn(CHANNELS, v)
export const isStatus = (v: unknown): v is Status => typeof v === 'string' && Object.hasOwn(STATUSES, v)

/**
 * 콘텐츠를 지울 수 있는 사람 = 등록한 사람, 또는 axhub 가 "관리자" 로 알려 준 사람.
 * is_admin 은 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자일 때 true 예요 (AXHUB.md §7).
 * 등록·수정은 로그인한 팀원 누구나 해요 (담당자가 상태를 바꾸는 팀 공용 달력이라서요).
 */
export function canDelete(visitor: AxhubMe, createdByKey: string): boolean {
  return visitor.authenticated && (visitor.is_admin || visitor.user_id === createdByKey)
}

export function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  // 2026-02-30 같은 없는 날짜를 걸러요 (Date 는 3월 2일로 넘겨 버려요).
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d
}

export type ContentInput = { title: string; channel: string; publishDate: string; owner: string; status: string; memo: string }
export type ContentValue = { title: string; channel: Channel; publishDate: string; owner: string; status: Status; memo: string }

/** 입력 검사. 통과하면 저장할 값을, 아니면 사용자에게 보여 줄 문구를 돌려줘요. */
export function validateContent(input: ContentInput): { ok: true; value: ContentValue } | { ok: false; error: string } {
  const title = input.title.trim()
  const owner = input.owner.trim()
  const memo = input.memo.trim()
  if (!title) return { ok: false, error: '제목을 적어 주세요.' }
  if (title.length > TITLE_MAX) return { ok: false, error: `제목은 ${TITLE_MAX}자 안으로 적어 주세요.` }
  if (!isChannel(input.channel)) return { ok: false, error: '채널을 골라 주세요.' }
  const d = parseDate(input.publishDate)
  if (!d) return { ok: false, error: '발행 예정일을 골라 주세요.' }
  const year = d.getUTCFullYear()
  if (year < 2000 || year > 2100) return { ok: false, error: '발행 예정일을 다시 확인해 주세요.' }
  if (!owner) return { ok: false, error: '담당자를 적어 주세요.' }
  if (owner.length > OWNER_MAX) return { ok: false, error: `담당자는 ${OWNER_MAX}자 안으로 적어 주세요.` }
  if (!isStatus(input.status)) return { ok: false, error: '상태를 골라 주세요.' }
  if (memo.length > MEMO_MAX) return { ok: false, error: `메모는 ${MEMO_MAX}자 안으로 적어 주세요.` }
  return { ok: true, value: { title, channel: input.channel, publishDate: input.publishDate, owner, status: input.status, memo } }
}

// ── 달력 ─────────────────────────────────────────────────────────────────────

/** '2026-10' 처럼 올바른 달이면 그대로, 아니면 null. */
export function parseMonth(v: string | undefined): string | null {
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) && v >= '2000-01' && v <= '2100-12' ? v : null
}

/** 달을 앞뒤로 옮겨요. shiftMonth('2026-01', -1) → '2025-12'. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7)
}

/** 그 달의 첫날·마지막 날 'YYYY-MM-DD'. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

/**
 * 달력 칸. 일요일부터 한 주 7칸이고, 그 달이 아닌 칸은 null 이에요.
 * 마지막 주도 7칸을 채워요 (주 수는 4~6).
 */
export function monthGrid(month: string): (string | null)[][] {
  const { to } = monthRange(month)
  const last = Number(to.slice(8))
  const lead = new Date(`${month}-01T00:00:00Z`).getUTCDay()
  const cells: (string | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= last; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

// ── 한국 시간(KST) 표시 ─────────────────────────────────────────────────────

export const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

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

/** '2026-10' → '2026년 10월'. */
export function formatMonth(month: string): string {
  return `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`
}

/** 시각 → KST '2026. 10. 8. 오후 3:20'. */
export function formatDateTime(t: Date): string {
  return t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}
