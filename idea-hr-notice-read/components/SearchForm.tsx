import { Button, Input, TextField } from '@heroui/react'

/** 주소에 ?q= 를 붙이는 검색 칸. hidden 은 함께 유지할 값(예: 탭). 검색하면 1쪽부터 다시 보여요. */
export function SearchForm({
  action,
  q,
  label,
  placeholder,
  hidden = {},
}: {
  action: string
  q: string
  label: string
  placeholder: string
  hidden?: Record<string, string>
}) {
  return (
    <form method="get" action={action} role="search" className="flex gap-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label={label} className="flex-1">
        <Input placeholder={placeholder} />
      </TextField>
      <Button type="submit" variant="outline">
        찾기
      </Button>
    </form>
  )
}

/** 검색어 읽기 — 앞뒤 공백을 지우고 50자까지만. */
export const queryOf = (v: string | undefined): string => (v ?? '').trim().slice(0, 50)
