import Link from 'next/link'
import { formatMonth, formatMonthShort, won, wonShort } from '@/lib/sales'
import type { MonthTotal } from '@/lib/sales-store'

/**
 * 최근 몇 달의 팀 금액 합계 막대 차트 (차트 라이브러리 없이 HTML 로). 서버 컴포넌트에서 바로 써요.
 * 고른 달 막대는 진하게, 나머지는 옅게 칠해요. 막대를 누르면 그 달 실적으로 가요.
 */
export function MonthChart({ data, selected }: { data: MonthTotal[]; selected: string }) {
  const max = Math.max(1, ...data.map((d) => d.amount))
  return (
    <figure className="m-0 flex flex-col gap-2">
      <figcaption className="sr-only">
        {data.map((d) => `${formatMonth(d.month)} ${won(d.amount)}`).join(', ')}
      </figcaption>
      <ol className="grid h-56 list-none grid-cols-6 items-end gap-1 border-b border-default p-0 sm:gap-4" aria-hidden>
        {data.map((d) => (
          <li key={d.month} className="flex h-full min-w-0 flex-col justify-end">
            <Link
              href={`/?month=${d.month}`}
              tabIndex={-1}
              title={`${formatMonth(d.month)} · ${won(d.amount)} · ${d.count}건`}
              className="group flex h-full flex-col items-center justify-end gap-1"
            >
              <span className={`t-caption whitespace-nowrap tabular-nums ${d.month === selected ? 'font-semibold text-default' : ''}`}>
                {d.amount > 0 ? wonShort(d.amount) : '0'}
              </span>
              <span className="flex w-full flex-1 items-end justify-center">
                <span
                  className={`w-full max-w-12 rounded-t-md transition-opacity group-hover:opacity-80 ${d.month === selected ? 'bg-primary' : 'bg-primary-soft'}`}
                  style={{ height: `${d.amount > 0 ? Math.max(2, (d.amount / max) * 100) : 0}%` }}
                />
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <ol className="grid list-none grid-cols-6 gap-1 p-0 sm:gap-4" aria-hidden>
        {data.map((d) => (
          <li key={d.month} className={`t-caption text-center ${d.month === selected ? 'font-semibold text-default' : ''}`}>
            {formatMonthShort(d.month)}
          </li>
        ))}
      </ol>
    </figure>
  )
}
