import Link from 'next/link'
import { Button, Input, buttonVariants } from '@heroui/react'

/** 이전 · 다음 쪽 링크. 검색어(q)는 그대로 유지해요. */
export function Pager({ basePath, q, page, hasNext }: { basePath: string; q: string; page: number; hasNext: boolean }) {
  if (page === 1 && !hasNext) return null
  const href = (p: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }
  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label="쪽 이동">
      {page > 1 ? (
        <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} href={href(page - 1)}>
          이전
        </Link>
      ) : (
        <span />
      )}
      <span className="t-caption">{page}쪽</span>
      {hasNext ? (
        <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} href={href(page + 1)}>
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

/** ILIKE 검색어 — % _ \ 는 글자 그대로 찾게 이스케이프해요. */
export const likeOf = (q: string): string => `%${q.replace(/[\\%_]/g, '\\$&')}%`

/** 목록 위 검색 칸. 주소의 ?q= 로 보내요(GET) — 새로고침·링크 공유해도 검색이 유지돼요. */
export function SearchForm({ action, q, placeholder, label }: { action: string; q: string; placeholder: string; label: string }) {
  return (
    <form className="flex w-full gap-2 sm:w-auto" action={action} role="search">
      <Input className="min-w-0 flex-1 sm:w-64" name="q" defaultValue={q} placeholder={placeholder} aria-label={label} maxLength={100} />
      <Button type="submit" variant="outline" className="shrink-0">
        검색
      </Button>
    </form>
  )
}
