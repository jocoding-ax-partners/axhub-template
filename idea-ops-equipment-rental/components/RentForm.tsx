'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Alert, Button, Input, TextField, toast } from '@heroui/react'
import { HandArrowDown } from '@phosphor-icons/react'
import { rent, type FormState } from '@/app/actions'

/** 대여 가능한 장비 한 대의 "반납 예정일 + 대여" 칸. 검사는 서버(app/actions.ts)에서 다시 해요. */
export function RentForm({ id, name, min, max }: { id: string; name: string; min: string; max: string }) {
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await rent(null, data)
      // 성공하면 이 장비는 "대여 중" 으로 바뀌어 이 폼이 사라져요 — 결과는 알림으로 보여줘요.
      if (r.ok) toast.success(r.message)
      else setError(r)
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-2 sm:w-auto">
      <input type="hidden" name="id" value={id} />
      <div className="flex gap-2">
        <TextField name="due_date" type="date" isRequired aria-label={`${name} 반납 예정일`} className="flex-1 sm:w-44 sm:flex-none">
          <Input min={min} max={max} />
        </TextField>
        <Button type="submit" isPending={pending}>
          <HandArrowDown />
          대여
        </Button>
      </div>
      {error && (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error.message}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
    </form>
  )
}
