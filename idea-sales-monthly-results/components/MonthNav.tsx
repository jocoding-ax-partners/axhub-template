import Link from 'next/link'
import { Button, Input, TextField, buttonVariants } from '@heroui/react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react/ssr'
import { DATE_MIN, formatMonth, kstToday, shiftMonth } from '@/lib/sales'

/**
 * 달 바꾸기 — 이전 달 · 다음 달 링크와 달 고르기 칸. 검색어는 지우고 1쪽으로 가요.
 * 계약일은 오늘까지만 넣을 수 있어서 이번 달보다 뒤로는 가지 않아요.
 */
export function MonthNav({ basePath, month }: { basePath: string; month: string }) {
  const thisMonth = kstToday().slice(0, 7)
  const first = DATE_MIN.slice(0, 7)
  const btn = buttonVariants({ variant: 'outline', size: 'sm' })
  const prev = shiftMonth(month, -1)
  const next = shiftMonth(month, 1)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav className="flex items-center gap-2" aria-label="달 바꾸기">
        {month > first ? (
          <Link className={btn} href={`${basePath}?month=${prev}`} aria-label={`${formatMonth(prev)} 보기`}>
            <CaretLeft size={16} weight="fill" />
          </Link>
        ) : (
          <span className="size-8" />
        )}
        <span className="t-body min-w-28 text-center font-semibold">{formatMonth(month)}</span>
        {month < thisMonth ? (
          <Link className={btn} href={`${basePath}?month=${next}`} aria-label={`${formatMonth(next)} 보기`}>
            <CaretRight size={16} weight="fill" />
          </Link>
        ) : (
          <span className="size-8" />
        )}
        {month !== thisMonth && (
          <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} href={basePath}>
            이번 달
          </Link>
        )}
      </nav>
      <form method="get" action={basePath} className="flex items-center gap-2">
        <TextField name="month" type="month" defaultValue={month} aria-label="볼 달 고르기" isRequired>
          <Input min={first} max={thisMonth} className="w-40" />
        </TextField>
        <Button type="submit" variant="outline" size="sm">
          보기
        </Button>
      </form>
    </div>
  )
}
