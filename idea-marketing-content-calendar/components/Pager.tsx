import Link from 'next/link'
import { buttonVariants } from '@heroui/react'

/** 이전 · 다음 쪽 링크. 검색어·거르기 조건(params)은 그대로 유지해요. 빈 값은 주소에서 빼요. */
export function Pager({ basePath, params, page, hasNext }: { basePath: string; params: Record<string, string | null>; page: number; hasNext: boolean }) {
  if (page === 1 && !hasNext) return null
  const href = (p: number) => {
    const qs = new URLSearchParams(
      Object.entries({ ...params, page: p > 1 ? String(p) : null }).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString()
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
