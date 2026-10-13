import { Button, Input, TextField } from '@heroui/react'
import type { Params } from '@/components/Pager'

/** 검색창 — 주소(?q=)로 거르는 평범한 GET 폼이라 브라우저 쪽 코드가 필요 없어요. 지금 조건(keep)은 숨은 값으로 함께 보내요. */
export function SearchForm({ basePath, q, keep = {}, placeholder }: { basePath: string; q: string; keep?: Params; placeholder: string }) {
  return (
    <form method="get" action={basePath} role="search" className="flex gap-2">
      {Object.entries(keep).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label={placeholder} className="min-w-0 flex-1">
        <Input placeholder={placeholder} />
      </TextField>
      <Button type="submit" variant="outline">
        찾기
      </Button>
    </form>
  )
}
