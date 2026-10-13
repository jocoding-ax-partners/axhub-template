// 캠페인 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/campaign-check.mjs)
import type { AxhubMe } from './axhub-server'

export const NAME_MAX = 100
export const CHANNEL_MAX = 50
/** 캠페인 기간 상한(달력 기준 일수). 날짜별 기록이 이 수를 넘지 않아 상세 화면이 한 번에 다 보여 줘요. */
export const PERIOD_MAX_DAYS = 366
/** 비용 상한 — 1조 원. 오타로 0 을 몇 개 더 붙인 값을 막아요. */
export const COST_MAX = 1_000_000_000_000
/** 하루 노출·클릭·전환 상한 — 10억. */
export const COUNT_MAX = 1_000_000_000

/** 채널 입력칸에서 고를 수 있는 예시. 목록에 없는 채널도 직접 적을 수 있어요. */
export const CHANNEL_SUGGESTIONS = ['네이버 검색광고', '구글 애즈', '메타(페이스북·인스타그램)', '카카오모먼트', '유튜브', '이메일'] as const

/** 비교 표 정렬. 키는 주소(?sort=)에 그대로 쓰여요. */
export const SORT_LABEL = { recent: '최근 시작 순', cpa: '전환당 비용 낮은 순', ctr: '클릭률 높은 순' } as const
export type CampaignSort = keyof typeof SORT_LABEL
export const sortOf = (v: string | undefined): CampaignSort => (v && Object.hasOwn(SORT_LABEL, v) ? (v as CampaignSort) : 'recent')

/**
 * 캠페인을 고치고 지울 수 있는 사람 = 등록한 사람, 또는 axhub 가 "관리자" 로 알려 준 사람.
 * is_admin 은 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자일 때 true 예요 (AXHUB.md §7).
 */
export function canEdit(visitor: AxhubMe, ownerKey: string): boolean {
  return visitor.authenticated && (visitor.is_admin || visitor.user_id === ownerKey)
}

export function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  // 2026-02-30 같은 없는 날짜를 걸러요 (Date 는 3월 2일로 넘겨 버려요).
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d
}

/** '1,200,000' · ' 300 ' → 정수. 0 이상 max 이하 정수가 아니면 null. */
export function parseCount(raw: string, max: number): number | null {
  const v = raw.trim().replace(/,/g, '')
  if (!/^\d{1,13}$/.test(v)) return null
  const n = Number(v)
  return n <= max ? n : null
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export type CampaignInput = { name: string; channel: string; start: string; end: string; cost: string }
export type CampaignValue = { name: string; channel: string; start: string; end: string; cost: number }

/** 캠페인 등록·수정 값 검사. 통과하면 저장할 값을, 아니면 사용자에게 보여 줄 문구를 돌려줘요. */
export function validateCampaign(input: CampaignInput): Result<CampaignValue> {
  const name = input.name.trim()
  const channel = input.channel.trim()
  if (!name) return { ok: false, error: '캠페인 이름을 적어 주세요.' }
  if (name.length > NAME_MAX) return { ok: false, error: `캠페인 이름은 ${NAME_MAX}자 안으로 적어 주세요.` }
  if (!channel) return { ok: false, error: '채널을 적어 주세요.' }
  if (channel.length > CHANNEL_MAX) return { ok: false, error: `채널은 ${CHANNEL_MAX}자 안으로 적어 주세요.` }
  const from = parseDate(input.start)
  const to = parseDate(input.end)
  if (!from) return { ok: false, error: '시작일을 골라 주세요.' }
  if (!to) return { ok: false, error: '종료일을 골라 주세요.' }
  if (to < from) return { ok: false, error: '종료일이 시작일보다 앞서요.' }
  if ((to.getTime() - from.getTime()) / 86_400_000 + 1 > PERIOD_MAX_DAYS)
    return { ok: false, error: `캠페인 기간은 ${PERIOD_MAX_DAYS}일까지예요. 더 길면 나눠서 등록해 주세요.` }
  const cost = parseCount(input.cost, COST_MAX)
  if (cost === null) return { ok: false, error: '비용은 0 이상의 원 단위 숫자로 적어 주세요.' }
  return { ok: true, value: { name, channel, start: input.start, end: input.end, cost } }
}

export type DailyInput = { day: string; impressions: string; clicks: string; conversions: string }
export type DailyValue = { day: string; impressions: number; clicks: number; conversions: number }

/** 날짜별 성과 검사. 날짜는 캠페인 기간 안이어야 하고, 클릭은 노출보다 많을 수 없어요. */
export function validateDaily(input: DailyInput, period: { start: string; end: string }): Result<DailyValue> {
  if (!parseDate(input.day)) return { ok: false, error: '날짜를 골라 주세요.' }
  if (input.day < period.start || input.day > period.end)
    return { ok: false, error: `캠페인 기간(${formatPeriod(period.start, period.end)}) 안의 날짜만 적을 수 있어요.` }
  const impressions = parseCount(input.impressions, COUNT_MAX)
  const clicks = parseCount(input.clicks, COUNT_MAX)
  const conversions = parseCount(input.conversions, COUNT_MAX)
  if (impressions === null) return { ok: false, error: '노출 수는 0 이상의 정수로 적어 주세요.' }
  if (clicks === null) return { ok: false, error: '클릭 수는 0 이상의 정수로 적어 주세요.' }
  if (conversions === null) return { ok: false, error: '전환 수는 0 이상의 정수로 적어 주세요.' }
  if (clicks > impressions) return { ok: false, error: '클릭 수가 노출 수보다 많아요. 숫자를 확인해 주세요.' }
  return { ok: true, value: { day: input.day, impressions, clicks, conversions } }
}

// ── 효율 지표 ────────────────────────────────────────────────────────────────

/** 클릭률(%) = 클릭 ÷ 노출 × 100. 노출이 0 이면 계산할 수 없어 null. */
export const ctr = (t: { clicks: number; impressions: number }): number | null =>
  t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null

/** 전환당 비용(원) = 비용 ÷ 전환. 전환이 0 이면 계산할 수 없어 null. */
export const cpa = (t: { cost: number; conversions: number }): number | null =>
  t.conversions > 0 ? t.cost / t.conversions : null

export const formatInt = (n: number): string => n.toLocaleString('ko-KR')
export const formatWon = (n: number | null): string => (n === null ? '–' : `${Math.round(n).toLocaleString('ko-KR')}원`)
export const formatPct = (n: number | null): string => (n === null ? '–' : `${n.toFixed(2)}%`)

// ── 한국 시간(KST) 표시 ─────────────────────────────────────────────────────

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** 오늘 날짜(KST) 'YYYY-MM-DD'. */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}

/** '2026-10-08' → '2026. 10. 8.'. 날짜 값이라 시간대 영향이 없어요. */
export function formatDate(s: string): string {
  const d = parseDate(s)
  return d ? `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}.` : s
}

/** '2026-10-08' → '10월 8일 (목)'. 날짜별 표의 한 줄에 써요. */
export function formatDay(s: string): string {
  const d = parseDate(s)
  return d ? `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY[d.getUTCDay()]})` : s
}

/** '10. 8.' — 차트 눈금처럼 짧게. */
export function formatShortDay(s: string): string {
  const d = parseDate(s)
  return d ? `${d.getUTCMonth() + 1}. ${d.getUTCDate()}.` : s
}

export function formatPeriod(start: string, end: string): string {
  return start === end ? formatDate(start) : `${formatDate(start)} ~ ${formatDate(end)}`
}

/** 기간의 달력 일수 (시작일·종료일 포함). */
export function periodDays(start: string, end: string): number {
  const from = parseDate(start)
  const to = parseDate(end)
  return from && to ? (to.getTime() - from.getTime()) / 86_400_000 + 1 : 0
}
