import Link from 'next/link'
import { buttonVariants } from '@heroui/react'

/** 이전 · 다음 쪽 링크. 검색어·필터(params)는 그대로 유지해요. 빈 값은 주소에 넣지 않아요. */
export function Pager({
  basePath,
  params = {},
  page,
  hasNext,
}: {
  basePath: string
  params?: Record<string, string>
  page: number
  hasNext: boolean
}) {
  if (page === 1 && !hasNext) return null
  const href = (p: number) => {
    const qs = hrefQuery({ ...params, page: p > 1 ? String(p) : '' })
    return qs ? `${basePath}?${qs}` : basePath
  }
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

/** { q: '한빛', mine: '' } → 'q=%ED%95%9C%EB%B9%9B' — 빈 값은 빼요. */
export function hrefQuery(params: Record<string, string>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  return sp.toString()
}
