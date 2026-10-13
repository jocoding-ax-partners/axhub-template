import { Button, Input, TextField } from '@heroui/react'

/** 검색 줄 — 주소의 ?q= 로 서버가 찾아요(쪽 번호는 1쪽으로 돌아가요). */
export function SearchForm({ action, q, label }: { action: string; q: string; label: string }) {
  return (
    <form method="get" action={action} role="search" className="flex gap-2">
      <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label={label} className="flex-1">
        <Input placeholder={label} />
      </TextField>
      <Button type="submit" variant="outline">
        찾기
      </Button>
    </form>
  )
}

/** 검색어 읽기 — 앞뒤 공백을 떼고 50자까지만. */
export const queryOf = (v: string | undefined): string => (v ?? '').trim().slice(0, 50)
