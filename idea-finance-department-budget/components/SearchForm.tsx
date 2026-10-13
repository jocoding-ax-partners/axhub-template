import { Button, Input, TextField } from '@heroui/react'

/** 목록 위 검색칸. 보고 있는 연도는 그대로 두고 1쪽부터 다시 보여줘요. */
export function SearchForm({ action, year, q, placeholder }: { action: string; year: number; q: string; placeholder: string }) {
  return (
    <form method="get" action={action} role="search" className="flex gap-2">
      <input type="hidden" name="year" value={year} />
      <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label={placeholder} className="min-w-0 flex-1">
        <Input placeholder={placeholder} />
      </TextField>
      <Button type="submit" variant="outline">
        찾기
      </Button>
    </form>
  )
}
