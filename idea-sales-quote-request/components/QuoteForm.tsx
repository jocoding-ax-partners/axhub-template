'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Alert, Button, FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { PaperPlaneTilt } from '@phosphor-icons/react'
import { submitQuote, type FormState } from '@/app/actions'
import { LIMITS, QUANTITY_MAX } from '@/lib/quote'

/** 견적 요청 등록 폼. 검사는 서버(app/actions.ts)에서 다시 해요 — 여기선 입력을 돕기만 해요. today 는 KST. */
export function QuoteForm({ today }: { today: string }) {
  // 등록에 성공하면 key 를 바꿔 폼을 새로 그려요 — 입력칸이 전부 비워져요.
  const [formKey, setFormKey] = useState(0)
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await submitQuote(null, data)
      if (r.ok) {
        toast.success(r.message)
        setError(null)
        setFormKey((k) => k + 1)
      } else {
        setError(r)
      }
    })
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <TextField name="company" isRequired maxLength={LIMITS.company}>
        <Label>회사명</Label>
        <Input placeholder="예: 한빛상사" />
        <FieldError />
      </TextField>

      <TextField name="contact_name" isRequired maxLength={LIMITS.contact}>
        <Label>고객 담당자</Label>
        <Input placeholder="예: 김민지 과장" />
        <FieldError />
      </TextField>

      <TextField name="contact_phone" type="tel" isRequired maxLength={LIMITS.phone}>
        <Label>연락처</Label>
        <Input placeholder="010-1234-5678" inputMode="tel" autoComplete="off" />
        <FieldError />
      </TextField>

      <TextField name="item" isRequired maxLength={LIMITS.item}>
        <Label>요청 품목</Label>
        <Input placeholder="예: A4 복사용지 80g" />
        <FieldError />
      </TextField>

      <TextField name="quantity" type="number" isRequired>
        <Label>수량</Label>
        <Input min={1} max={QUANTITY_MAX} step={1} inputMode="numeric" placeholder="예: 200" />
        <FieldError />
      </TextField>

      <TextField name="due_date" type="date" isRequired>
        <Label>희망 납기</Label>
        <Input min={today} />
        <FieldError />
      </TextField>

      <div className="flex flex-col gap-3 sm:col-span-3">
        {error && (
          <Alert status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{error.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        <div>
          <Button type="submit" isPending={pending}>
            <PaperPlaneTilt />
            {pending ? '등록하는 중…' : '등록하기'}
          </Button>
        </div>
      </div>
    </form>
  )
}
