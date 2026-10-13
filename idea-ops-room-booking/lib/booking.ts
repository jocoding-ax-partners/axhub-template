// 예약 시간 규칙 (순수 함수 — 서버·점검 스크립트에서 함께 써요).
// 시각은 "그날 0시부터 몇 분째인지"(정수)로 다뤄요. 모든 날짜·시각은 한국 시간(KST) 기준이에요.

/** 예약 단위(분) */
export const SLOT = 30
/** 시간표 범위: 08:00 ~ 20:00. 바꾸면 lib/db.ts 의 CHECK 와 함께 맞춰요. */
export const DAY_START = 8 * 60
export const DAY_END = 20 * 60

export const SLOTS: number[] = []
for (let m = DAY_START; m < DAY_END; m += SLOT) SLOTS.push(m)

/** 570 → "09:30" */
export const fmt = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** "09:30" → 570. 형식이 틀리면 NaN. */
export function toMin(hhmm: string): number {
  const m = /^([01]\d|2[0-4]):([0-5]\d)$/.exec(hhmm)
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
}

/** "2026-10-12" 처럼 실제로 있는 날짜인지 (2월 31일 같은 날은 거절). */
export function isDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

const kstNow = (now: number) => new Date(now + 9 * 3600_000)

/** 한국 기준 오늘 날짜 "YYYY-MM-DD" (서버는 UTC 로 돌아요). */
export const todayKst = (now = Date.now()) => kstNow(now).toISOString().slice(0, 10)

/** 한국 기준 지금 시각(분). */
export function nowMinKst(now = Date.now()): number {
  const d = kstNow(now)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

/** "YYYY-MM-DD" 에 n 일을 더해요. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
/** "2026-10-12" → "2026년 10월 12일 (월)" */
export function fmtDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAYS[d.getUTCDay()]})`
}

/** 예약 구간이 규칙에 맞는지: 시간표 범위 안, 30분 단위, 시작 < 종료. */
export function validRange(start: number, end: number): boolean {
  return (
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= DAY_START &&
    end <= DAY_END &&
    start < end &&
    start % SLOT === 0 &&
    end % SLOT === 0
  )
}

/** 이미 지난 시각인지 (지난 날짜, 또는 오늘인데 시작 시각이 지났으면 true). */
export function isPast(day: string, start: number, now = Date.now()): boolean {
  const today = todayKst(now)
  return day < today || (day === today && start < nowMinKst(now))
}
