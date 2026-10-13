import { Chip, Meter } from '@heroui/react'
import { formatRate, formatWon, isWarn, usageRate } from '@/lib/budget'
import type { DeptStatus } from '@/lib/budget-store'

/**
 * 부서별 예산 · 집행액 · 남은 예산 · 집행률 표. 집행률 90% 이상인 부서는 빨간 글자와 「주의」로 강조해요.
 * 넓은 화면은 표, 좁은 화면(640px 미만)은 부서마다 한 덩어리로 보여요.
 */
export function StatusTable({ rows }: { rows: DeptStatus[] }) {
  return (
    <>
      <table className="t-small hidden w-full border-collapse sm:table">
        <caption className="sr-only">부서별 예산 집행 현황</caption>
        <thead>
          <tr className="border-b border-default text-left text-muted">
            <th scope="col" className="py-2 pr-4 font-semibold">부서</th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold">예산</th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold">집행액</th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold">남은 예산</th>
            <th scope="col" className="py-2 text-right font-semibold">집행률</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const warn = r.budget !== null && isWarn(r.budget, r.spent)
            return (
              <tr key={r.id} className={`border-b border-default last:border-0 ${warn ? 'font-semibold text-danger' : ''}`}>
                <th scope="row" className="py-3 pr-4 text-left font-semibold">
                  <span className="flex flex-wrap items-center gap-2 break-all">
                    {r.name}
                    {warn && <Chip size="sm" color="danger">주의</Chip>}
                  </span>
                </th>
                <td className="py-3 pr-4 text-right tabular-nums">{r.budget === null ? <span className="font-normal text-muted">미등록</span> : formatWon(r.budget)}</td>
                <td className="py-3 pr-4 text-right tabular-nums">{formatWon(r.spent)}</td>
                <td className="py-3 pr-4 text-right tabular-nums">{r.budget === null ? '—' : formatWon(r.budget - r.spent)}</td>
                <td className="py-3 text-right">
                  {r.budget === null ? '—' : <Rate budget={r.budget} spent={r.spent} warn={warn} />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <ul className="list-none p-0 sm:hidden">
        {rows.map((r) => {
          const warn = r.budget !== null && isWarn(r.budget, r.spent)
          return (
            <li key={r.id} className="flex flex-col gap-2 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0">
              <p className={`t-small flex flex-wrap items-center gap-2 font-semibold break-all ${warn ? 'text-danger' : ''}`}>
                {r.name}
                {warn && <Chip size="sm" color="danger">주의</Chip>}
              </p>
              {r.budget === null ? (
                <p className="t-small text-muted">{`예산 미등록 · 집행액 ${formatWon(r.spent)}`}</p>
              ) : (
                <>
                  <dl className="t-small grid grid-cols-3 gap-2">
                    <Figure label="예산" value={formatWon(r.budget)} />
                    <Figure label="집행액" value={formatWon(r.spent)} />
                    <Figure label="남은 예산" value={formatWon(r.budget - r.spent)} danger={r.spent > r.budget} />
                  </dl>
                  <Rate budget={r.budget} spent={r.spent} warn={warn} />
                </>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

function Figure({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="t-caption">{label}</dt>
      <dd className={`break-all tabular-nums ${danger ? 'text-danger' : ''}`}>{value}</dd>
    </div>
  )
}

/** 집행률 숫자 + 막대. 100% 를 넘으면 막대는 꽉 찬 채로 숫자만 커져요. */
function Rate({ budget, spent, warn }: { budget: number; spent: number; warn: boolean }) {
  const rate = usageRate(budget, spent)
  return (
    <span className="inline-flex w-full items-center justify-end gap-3">
      <Meter aria-label="집행률" value={Math.min(rate, 100)} color={warn ? 'danger' : 'accent'} size="sm" className="min-w-0 flex-1 sm:w-20 sm:flex-none">
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
      <span className={`min-w-14 text-right tabular-nums ${warn ? 'font-semibold text-danger' : ''}`}>{formatRate(rate)}</span>
    </span>
  )
}
