import Link from 'next/link'
import { buttonVariants } from '@heroui/react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react/ssr'
import { YEAR_MAX, YEAR_MIN } from '@/lib/budget'

/** 이전 해 · 다음 해 링크. 검색어는 지우고 1쪽으로 가요. */
export function YearNav({ basePath, year }: { basePath: string; year: number }) {
  const href = (y: number) => `${basePath}?year=${y}`
  const btn = buttonVariants({ variant: 'outline', size: 'sm' })
  return (
    <nav className="flex items-center gap-2" aria-label="연도 바꾸기">
      {year > YEAR_MIN && (
        <Link className={btn} href={href(year - 1)} aria-label={`${year - 1}년 보기`}>
          <CaretLeft size={16} weight="fill" />
        </Link>
      )}
      <span className="t-body min-w-16 text-center font-semibold">{year}년</span>
      {year < YEAR_MAX && (
        <Link className={btn} href={href(year + 1)} aria-label={`${year + 1}년 보기`}>
          <CaretRight size={16} weight="fill" />
        </Link>
      )}
    </nav>
  )
}
