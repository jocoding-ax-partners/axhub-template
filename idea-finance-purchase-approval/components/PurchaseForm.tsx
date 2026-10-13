'use client'

import { startTransition, useActionState, useState, type FormEvent } from 'react'
import { Alert, Button, Chip, Description, FieldError, Input, Label, TextArea, TextField, toast } from '@heroui/react'
import { PaperPlaneTilt } from '@phosphor-icons/react'
import { submitPurchase, type FormState } from '@/app/actions'
import { HIGH_VALUE_THRESHOLD, ITEM_MAX, REASON_MAX, isHighValue, parseAmount, won } from '@/lib/purchase'

/** 숫자만 남기고 세 자리마다 쉼표. '1200000' → '1,200,000'. */
const withCommas = (v: string) => {
  const digits = v.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13)
  return digits ? Number(digits).toLocaleString('ko-KR') : ''
}

/** 구매 요청 폼. 총액은 입력하는 대로 보여 주고, 저장할 땐 서버(app/actions.ts)와 DB 가 다시 계산해요. */
export function PurchaseForm() {
  const [item, setItem] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [reason, setReason] = useState('')
  const [state, action, pending] = useActionState(async (prev: FormState | null, data: FormData) => {
    const r = await submitPurchase(prev, data)
    if (r.ok) {
      toast.success(r.message)
      setItem('')
      setQuantity('1')
      setUnitPrice('')
      setReason('')
    }
    return r
  }, null)

  const total = (parseAmount(quantity) ?? 0) * (parseAmount(unitPrice) ?? 0)

  // <form action> 은 끝나면 입력칸을 비워요 — 오류일 때도 입력이 남도록 직접 보내요.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(() => action(data))
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField name="item" isRequired maxLength={ITEM_MAX} value={item} onChange={setItem} className="sm:col-span-2">
        <Label>품목</Label>
        <Input placeholder="예: 27인치 모니터" />
        <FieldError />
      </TextField>

      <TextField name="quantity" isRequired value={quantity} onChange={(v) => setQuantity(v.replace(/\D/g, '').slice(0, 5))}>
        <Label>수량</Label>
        <Input inputMode="numeric" autoComplete="off" />
        <FieldError />
      </TextField>

      <TextField name="unit_price" isRequired value={unitPrice} onChange={(v) => setUnitPrice(withCommas(v))}>
        <Label>단가 (원)</Label>
        <Input inputMode="numeric" autoComplete="off" placeholder="예: 350,000" />
        <FieldError />
      </TextField>

      <TextField name="reason" isRequired maxLength={REASON_MAX} value={reason} onChange={setReason} className="sm:col-span-2">
        <Label>구매 사유</Label>
        <TextArea rows={3} placeholder="왜 필요한지, 어디에 쓰는지 적어 주세요." />
        <Description>
          {reason.length}/{REASON_MAX}자
        </Description>
        <FieldError />
      </TextField>

      <div className="flex flex-col gap-3 sm:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3" aria-live="polite">
          <p className="t-small flex flex-wrap items-center gap-2">
            <span className="text-muted">총액</span>
            <span className="text-body-03 font-semibold">{won(total)}</span>
            {isHighValue(total) && (
              <Chip size="sm" color="warning">
                고액
              </Chip>
            )}
          </p>
          <p className="t-caption">{won(HIGH_VALUE_THRESHOLD)} 이상은 고액으로 표시돼요</p>
        </div>
        {state && !state.ok && (
          <Alert status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{state.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        <div>
          <Button type="submit" isPending={pending}>
            <PaperPlaneTilt />
            {pending ? '올리는 중…' : '구매 요청 올리기'}
          </Button>
        </div>
      </div>
    </form>
  )
}
