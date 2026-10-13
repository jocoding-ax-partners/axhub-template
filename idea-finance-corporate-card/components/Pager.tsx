import Link from 'next/link'
import { buttonVariants } from '@heroui/react'

export type Params = Record<string, string | undefined>

/** 주소 + 조건(month · q · missing …) → '/summary?month=2026-10&q=커피'. 빈 값은 빼요. */
export function hrefWith(basePath: string, params: Params): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v)
  const s = qs.toString()
  return s ? `${basePath}?${s}` : basePath
}

/** 이전 · 다음 쪽 링크. 지금 조건(월 · 검색어 등)은 그대로 유지해요. */
export function Pager({ basePath, params, page, hasNext }: { basePath: string; params: Params; page: number; hasNext: boolean }) {
  if (page === 1 && !hasNext) return null
  const href = (p: number) => hrefWith(basePath, { ...params, page: p > 1 ? String(p) : undefined })
  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label="쪽 이동">
      {page > 1 ? (
        <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={href(page - 1)}>
          이전
        </Link>
      ) : (
        <span />
      )}
      <span className="t-caption">{page}쪽</span>
      {hasNext ? (
        <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={href(page + 1)}>
          다음
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}

/** 쪽 번호 읽기 (1 이상, 이상한 값은 1). */
export const pageOf = (v: string | undefined): number => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1
}
