// 날짜 도우미. 미팅 날짜·다음 연락일은 시각 없는 날짜('YYYY-MM-DD')로만 다뤄요.
// "오늘" 은 서버가 어느 나라에 있든 항상 한국 시간(KST) 기준이에요.

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 한국 시간 기준 오늘 ('YYYY-MM-DD'). */
export function todayKst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

function toUtcMs(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00Z`)
}

/** 'YYYY-MM-DD' 형식이면서 실제로 있는 날짜인지 (2026-02-30 같은 값은 거절). */
export function isValidDate(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false
  const ms = toUtcMs(ymd)
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === ymd
}

/** '2026-10-12' → '10월 12일 (월)'. 올해가 아니면 연도를 붙여요. */
export function formatDate(ymd: string, today: string): string {
  const d = new Date(toUtcMs(ymd))
  const md = `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAYS[d.getUTCDay()]})`
  return ymd.slice(0, 4) === today.slice(0, 4) ? md : `${ymd.slice(0, 4)}년 ${md}`
}

/** 오늘과 비교한 말 — '오늘' · '내일' · '3일 남음' · '2일 지남'. */
export function relativeDay(ymd: string, today: string): string {
  const diff = Math.round((toUtcMs(ymd) - toUtcMs(today)) / DAY_MS)
  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  return diff > 0 ? `${diff}일 남음` : `${-diff}일 지남`
}
