import Link from 'next/link'
import { Button, Chip, EmptyState, Input, TextField, buttonVariants } from '@heroui/react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react/ssr'
import { DeleteExpenseButton, PurposeForm } from '@/components/ExpenseActions'
import { hrefWith, type Params } from '@/components/Pager'
import { formatDate, formatMonth, formatWon, shiftMonth } from '@/lib/card'
import type { ExpenseRow } from '@/lib/card-store'

/**
 * 사용 건 목록. 용도가 비어 있으면 "용도 미기재" 로 표시하고,
 * 내가 입력한 건이면 그 자리에서 용도를 채우거나 지울 수 있어요 (viewerKey = 지금 보는 사람).
 */
export function ExpenseList({
  rows,
  viewerKey,
  showOwner,
  empty,
}: {
  rows: ExpenseRow[]
  viewerKey: string
  showOwner: boolean
  empty: string
}) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>
  return (
    <ul className="list-none p-0">
      {rows.map((r) => {
        const mine = r.user_key === viewerKey
        const summary = `${formatDate(r.used_on)} ${r.merchant} ${formatWon(r.amount)}`
        return (
          <li key={r.id} className="flex flex-col gap-2 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="t-small break-words font-semibold">{r.merchant}</p>
                <p className="t-caption mt-1">
                  {formatDate(r.used_on)} · {r.department}
                  {showOwner && ` · ${r.user_name || r.user_email}`}
                </p>
              </div>
              <p className="t-small shrink-0 font-semibold tabular-nums">{formatWon(r.amount)}</p>
            </div>
            {r.purpose ? (
              <p className="t-small break-words text-muted">용도: {r.purpose}</p>
            ) : (
              <div className="flex flex-col gap-2">
                <div>
                  <Chip size="sm" color="warning">
                    용도 미기재
                  </Chip>
                </div>
                {mine && <PurposeForm id={r.id} />}
              </div>
            )}
            {mine && (
              <div className="flex justify-end">
                <DeleteExpenseButton id={r.id} summary={summary} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** 이전 달 · 다음 달 이동 + 월 고르기. 다른 조건(검색어 등)은 달이 바뀌면 지워요. */
export function MonthNav({ basePath, month, thisMonth, keep = {} }: { basePath: string; month: string; thisMonth: string; keep?: Params }) {
  const prev = shiftMonth(month, -1)
  const next = shiftMonth(month, 1)
  const link = buttonVariants({ variant: 'outline', size: 'sm', isIconOnly: true })
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Link className={link} href={hrefWith(basePath, { ...keep, month: prev })} aria-label={`${formatMonth(prev)}로`}>
          <CaretLeft size={16} weight="fill" />
        </Link>
        <h2 className="t-section-title min-w-28 text-center">{formatMonth(month)}</h2>
        {next <= thisMonth ? (
          <Link className={link} href={hrefWith(basePath, { ...keep, month: next })} aria-label={`${formatMonth(next)}로`}>
            <CaretRight size={16} weight="fill" />
          </Link>
        ) : (
          <span className={`${link} pointer-events-none opacity-40`} aria-hidden>
            <CaretRight size={16} weight="fill" />
          </span>
        )}
      </div>
      <form method="get" action={basePath} className="flex items-center gap-2">
        {Object.entries(keep).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
        <TextField name="month" type="month" defaultValue={month} aria-label="조회할 월 (예: 2026-10)">
          <Input max={thisMonth} placeholder="2026-10" className="w-44" />
        </TextField>
        <Button type="submit" size="sm" variant="outline">
          이동
        </Button>
      </form>
    </div>
  )
}

/** 검색창. 지금 조건(월 등)은 숨은 값으로 함께 보내요. */
export function SearchForm({ basePath, q, keep, placeholder }: { basePath: string; q: string; keep: Params; placeholder: string }) {
  return (
    <form method="get" action={basePath} role="search" className="flex gap-2">
      {Object.entries(keep).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label={placeholder} className="flex-1">
        <Input placeholder={placeholder} />
      </TextField>
      <Button type="submit" variant="outline">
        찾기
      </Button>
    </form>
  )
}
