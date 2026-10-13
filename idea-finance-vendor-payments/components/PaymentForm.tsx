'use client'

import { useId, useState, useTransition, type FormEvent } from 'react'
import { Alert, Button, FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { FloppyDisk, Plus } from '@phosphor-icons/react'
import { createPayment, updatePayment, type FormState } from '@/app/actions'
import { MEMO_MAX, VENDOR_MAX, formatWon, parseAmount } from '@/lib/payment'

export type PaymentDraft = { id: string; vendor: string; amount: number; due_date: string; memo: string }

/**
 * 지급 건 등록 · 고치기 폼. draft 가 있으면 그 건을 고쳐요.
 * 검사는 서버(app/actions.ts)에서 다시 해요 — 여기선 입력을 돕기만 해요.
 * vendors 는 자동완성 목록(이미 쓴 거래처) — 같은 거래처를 조금씩 다르게 적지 않게 도와줘요 (등록 폼에서만 넘겨요).
 */
export function PaymentForm({
  vendors = [],
  today,
  draft,
  onDone,
}: {
  vendors?: string[]
  today: string
  draft?: PaymentDraft
  onDone?: () => void
}) {
  const listId = useId()
  // 등록에 성공하면 key 를 바꿔 폼을 새로 그려요 — 입력칸이 전부 비워져요.
  const [formKey, setFormKey] = useState(0)
  const [amount, setAmount] = useState(draft ? String(draft.amount) : '')
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()
  const parsed = parseAmount(amount)

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    if (draft) data.set('id', draft.id)
    startTransition(async () => {
      const r = draft ? await updatePayment(null, data) : await createPayment(null, data)
      if (!r.ok) {
        setError(r)
        return
      }
      toast.success(r.message)
      setError(null)
      if (!draft) {
        setFormKey((k) => k + 1)
        setAmount('')
      }
      onDone?.()
    })
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField name="vendor" isRequired maxLength={VENDOR_MAX} defaultValue={draft?.vendor}>
        <Label>거래처</Label>
        <Input placeholder="예: 한빛상사" list={vendors.length > 0 ? listId : undefined} autoComplete="off" />
        <FieldError />
      </TextField>
      {vendors.length > 0 && (
        <datalist id={listId}>
          {vendors.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      )}

      <TextField name="amount" isRequired value={amount} onChange={setAmount}>
        <Label>금액 (원)</Label>
        <Input inputMode="numeric" placeholder="예: 1,500,000" />
        {/* 입력한 금액을 쉼표 붙여 다시 보여 줘요 — 0 을 하나 더 붙이는 실수를 잡아요. */}
        <p className="t-caption tabular-nums" aria-live="polite">
          {amount && (Number.isNaN(parsed) ? '숫자로만 적어 주세요' : formatWon(parsed))}
        </p>
        <FieldError />
      </TextField>

      <TextField name="due_date" type="date" isRequired defaultValue={draft?.due_date ?? today}>
        <Label>지급 예정일</Label>
        <Input />
        <FieldError />
      </TextField>

      <TextField name="memo" maxLength={MEMO_MAX} defaultValue={draft?.memo}>
        <Label>메모 (선택)</Label>
        <Input placeholder="예: 9월분 원자재 대금, 세금계산서 수령" />
      </TextField>

      <div className="flex flex-col gap-3 sm:col-span-2">
        {error && (
          <Alert status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{error.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" isPending={pending}>
            {draft ? <FloppyDisk /> : <Plus />}
            {pending ? '저장하는 중…' : draft ? '고친 내용 저장' : '등록하기'}
          </Button>
          {onDone && (
            <Button variant="outline" onPress={onDone} isDisabled={pending}>
              취소
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
