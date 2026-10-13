'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import { Button, Description, FieldError, Input, Label, ListBox, Select, TextField } from '@heroui/react'
import { createExpense, type FormState } from '@/app/actions'
import {
  CATEGORIES,
  MAX_MEMO,
  MAX_RECEIPT_BYTES,
  RECEIPT_BAD_TYPE,
  RECEIPT_TOO_BIG,
  RECEIPT_TYPES,
} from '@/lib/expense-utils'

const INITIAL: FormState = { ok: false, message: '', at: 0 }

/**
 * 경비 올리기 폼. 크기·형식은 여기서 먼저 알려 주고, 서버가 같은 규칙으로 다시 검사해요.
 * 실패하면 입력한 값이 그대로 남고, 성공하면 폼을 비워요.
 */
export function ExpenseForm({ today, storageReady }: { today: string; storageReady: boolean }) {
  const [state, action, pending] = useActionState(createExpense, INITIAL)
  const [clientError, setClientError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state])

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const file = data.get('receipt')
    if (file instanceof File && file.size > 0) {
      if (!(RECEIPT_TYPES as readonly string[]).includes(file.type)) return setClientError(RECEIPT_BAD_TYPE)
      if (file.size > MAX_RECEIPT_BYTES) return setClientError(RECEIPT_TOO_BIG)
    }
    setClientError('')
    startTransition(() => action(data))
  }

  const message = clientError || (pending ? '' : state.message)
  const isError = Boolean(clientError) || !state.ok

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField name="spent_on" type="date" defaultValue={today} isRequired>
        <Label>사용일</Label>
        <Input max={today} />
        <FieldError />
      </TextField>

      <Select name="category" defaultValue={CATEGORIES[0]} isRequired>
        <Label>항목</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {CATEGORIES.map((c) => (
              <ListBox.Item key={c} id={c} textValue={c}>
                {c}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <TextField name="amount" inputMode="numeric" autoComplete="off" isRequired>
        <Label>금액 (원)</Label>
        <Input placeholder="예: 12000" />
        <FieldError />
      </TextField>

      {/* 파일 고르기는 HeroUI v3 에 없어서 브라우저 기본 입력에 버튼 모양만 입혀요. */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="receipt">영수증 사진</Label>
        {storageReady ? (
          <>
            <input
              id="receipt"
              type="file"
              name="receipt"
              accept={RECEIPT_TYPES.join(',')}
              aria-describedby="receipt-desc"
              className="t-small w-full min-w-0 cursor-pointer file:mr-3 file:h-button-sm file:cursor-pointer file:rounded-button-sm file:border-0 file:bg-default file:px-3 file:font-medium file:text-default-foreground"
            />
            <Description id="receipt-desc">선택 · JPG · PNG · WEBP · 10MB 이하</Description>
          </>
        ) : (
          <Description>사진 저장소가 켜지지 않아 지금은 사진 없이 올려요.</Description>
        )}
      </div>

      <TextField name="memo" maxLength={MAX_MEMO} className="sm:col-span-2">
        <Label>메모</Label>
        <Input placeholder="예: 고객 미팅 점심" />
        <Description>선택 · {MAX_MEMO}자까지</Description>
      </TextField>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" isDisabled={pending}>
          {pending ? '올리는 중…' : '올리기'}
        </Button>
        <p role="status" aria-live="polite" className={`t-small ${isError ? 'text-danger' : 'text-success'}`}>
          {message}
        </p>
      </div>
    </form>
  )
}
