'use client'

import { startTransition, useActionState, useState, type FormEvent } from 'react'
import { Alert, Button, Description, FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { FloppyDisk } from '@phosphor-icons/react'
import { addContract, type FormState } from '@/app/actions'
import { CUSTOMER_MAX, DATE_MIN, parseAmount, wonShort } from '@/lib/sales'

/** 숫자만 남기고 세 자리마다 쉼표. '1200000' → '1,200,000'. */
const withCommas = (v: string) => {
  const digits = v.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 12)
  return digits ? Number(digits).toLocaleString('ko-KR') : ''
}

/**
 * 계약 입력 폼. 담당자는 로그인한 사람으로 저장돼요. 검사는 서버(app/actions.ts)에서 다시 해요.
 * 저장하면 고객사·금액만 비우고 계약일은 남겨요 — 같은 날 계약을 여러 건 넣기 쉽게.
 */
export function ContractForm({ today, repName }: { today: string; repName: string }) {
  const [date, setDate] = useState(today)
  const [customer, setCustomer] = useState('')
  const [amount, setAmount] = useState('')
  const [state, action, pending] = useActionState(async (prev: FormState | null, data: FormData) => {
    const r = await addContract(prev, data)
    if (r.ok) {
      toast.success(r.message)
      setCustomer('')
      setAmount('')
    }
    return r
  }, null)

  // <form action> 은 끝나면 입력칸을 비워요 — 오류일 때도 입력이 남도록 직접 보내요.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(() => action(data))
  }

  const value = parseAmount(amount)

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <TextField name="contract_date" type="date" isRequired value={date} onChange={setDate}>
        <Label>계약일</Label>
        <Input min={DATE_MIN} max={today} />
        <FieldError />
      </TextField>

      <TextField name="customer" isRequired maxLength={CUSTOMER_MAX} value={customer} onChange={setCustomer}>
        <Label>고객사</Label>
        <Input placeholder="예: 한빛상사" autoComplete="off" />
        <FieldError />
      </TextField>

      <TextField name="amount" isRequired value={amount} onChange={(v) => setAmount(withCommas(v))}>
        <Label>금액 (원)</Label>
        <Input inputMode="numeric" autoComplete="off" placeholder="예: 12,000,000" />
        <Description>{value && value >= 10_000 ? `약 ${wonShort(value)}원` : '부가세를 넣을지 말지는 팀에서 하나로 정해 주세요.'}</Description>
        <FieldError />
      </TextField>

      <div className="flex flex-col gap-3 sm:col-span-3">
        {state && !state.ok && (
          <Alert status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{state.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" isPending={pending}>
            <FloppyDisk />
            {pending ? '저장하는 중…' : '계약 저장'}
          </Button>
          <span className="t-caption">담당자: {repName}</span>
        </div>
      </div>
    </form>
  )
}
