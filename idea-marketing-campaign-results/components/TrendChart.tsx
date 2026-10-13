import { formatInt, formatShortDay, periodDays } from '@/lib/campaign'

type Point = { day: string; value: number }

const TONE = {
  primary: { line: 'stroke-primary', dot: 'bg-primary' },
  success: { line: 'stroke-success', dot: 'bg-success' },
} as const

/**
 * 날짜별 값 하나를 그리는 선 차트 (차트 라이브러리 없이 SVG). 서버 컴포넌트에서 바로 써요.
 * 가로축은 캠페인 기간 전체라서, 기록이 빠진 날은 선이 그 구간을 건너뛰어 이어져요.
 * 선은 화면 폭에 맞춰 늘어나고(preserveAspectRatio="none"), 점·글자는 HTML 이라 좁은 화면에서도 찌그러지지 않아요.
 */
export function TrendChart({
  title,
  points,
  start,
  end,
  tone,
}: {
  title: string
  points: Point[]
  start: string
  end: string
  tone: keyof typeof TONE
}) {
  const span = Math.max(1, periodDays(start, end) - 1)
  const max = Math.max(1, ...points.map((p) => p.value))
  // 0~100 좌표. 가로 = 기간 안 위치, 세로 = 값 (위가 큼).
  const x = (day: string) => ((periodDays(start, day) - 1) / span) * 100
  const y = (v: number) => 100 - (v / max) * 100
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ')
  const total = points.reduce((s, p) => s + p.value, 0)
  const mid = periodDays(start, end) > 2 ? new Date(Date.parse(`${start}T00:00:00Z`) + (span / 2) * 86_400_000).toISOString().slice(0, 10) : null

  return (
    <figure className="m-0 flex min-w-0 flex-col gap-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="t-small flex items-center gap-2 font-semibold">
          <span className={`size-2.5 rounded-full ${TONE[tone].dot}`} aria-hidden />
          {title}
        </span>
        <span className="t-caption">합계 {formatInt(total)}</span>
      </figcaption>
      <div className="flex gap-2">
        {/* 세로축 눈금 — 위가 가장 큰 값 */}
        <div className="t-caption flex h-40 shrink-0 flex-col justify-between text-right tabular-nums" aria-hidden>
          <span>{formatInt(max)}</span>
          <span>{formatInt(Math.round(max / 2))}</span>
          <span>0</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="relative h-40">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible"
              role="img"
              aria-label={`${title} 날짜별 추이. ${points.length}일 기록, 가장 큰 값 ${formatInt(Math.max(0, ...points.map((p) => p.value)))}`}
            >
              {[0, 50, 100].map((g) => (
                <line key={g} x1="0" x2="100" y1={g} y2={g} className="stroke-separator" vectorEffect="non-scaling-stroke" />
              ))}
              {points.length > 1 && (
                <path d={path} fill="none" className={TONE[tone].line} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              )}
            </svg>
            {points.map((p) => (
              <span
                key={p.day}
                title={`${formatShortDay(p.day)} ${formatInt(p.value)}`}
                className={`absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${TONE[tone].dot}`}
                style={{ left: `${x(p.day)}%`, top: `${y(p.value)}%` }}
              />
            ))}
          </div>
          {/* 가로축 — 기간의 처음 · 가운데 · 끝 */}
          <div className="t-caption flex justify-between" aria-hidden>
            <span>{formatShortDay(start)}</span>
            {mid && <span>{formatShortDay(mid)}</span>}
            <span>{formatShortDay(end)}</span>
          </div>
        </div>
      </div>
    </figure>
  )
}
