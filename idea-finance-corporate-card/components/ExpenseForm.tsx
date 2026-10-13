'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Alert, Button, Description, FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { FloppyDisk } from '@phosphor-icons/react'
import { addExpense, type FormState } from '@/app/actions'
import { DEPARTMENT_MAX, MERCHANT_MAX, PURPOSE_MAX } from '@/lib/card'

/** 12300 → '12,300'. 입력하는 동안 쉼표를 찍어 자릿수를 읽기 쉽게 해요. */
const withCommas = (s: string) => {
  const digits = s.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12)
  return digits ? Number(digits).toLocaleString('ko-KR') : ''
}

/**
 * 카드 사용 건 입력 폼. 검사는 서버(app/actions.ts)에서 다시 해요 — 여기선 입력을 돕기만 해요.
 * 부서는 지금까지 쓰인 이름을 자동완성으로 보여 주고, 내가 마지막에 쓴 부서를 미리 채워요.
 */
export function ExpenseForm({ today, departments, myDepartment }: { today: string; departments: string[]; myDepartment: string }) {
  // 저장에 성공하면 key 를 바꿔 폼을 새로 그려요 — 입력칸이 처음 값으로 돌아가요.
  const [formKey, setFormKey] = useState(0)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await addExpense(null, data)
      if (r.ok) {
        toast.success(r.message)
        setError(null)
        setAmount('')
        setFormKey((k) => k + 1)
      } else {
        setError(r)
      }
    })
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField name="used_on" type="date" isRequired defaultValue={today}>
        <Label>사용일</Label>
        <Input max={today} />
        <FieldError />
      </TextField>

      <TextField name="amount" isRequired value={amount} onChange={(v) => setAmount(withCommas(v))}>
        <Label>금액(원)</Label>
        <Input inputMode="numeric" placeholder="예: 12,300" />
        <FieldError />
      </TextField>

      <TextField name="merchant" isRequired maxLength={MERCHANT_MAX}>
        <Label>가맹점</Label>
        <Input placeholder="예: 스타벅스 강남점" />
        <FieldError />
      </TextField>

      <TextField name="department" isRequired maxLength={DEPARTMENT_MAX} defaultValue={myDepartment}>
        <Label>부서</Label>
        <Input list="department-options" placeholder="예: 영업팀" autoComplete="off" />
        <FieldError />
      </TextField>
      <datalist id="department-options">
        {departments.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>

      <TextField name="purpose" maxLength={PURPOSE_MAX} className="sm:col-span-2">
        <Label>용도</Label>
        <Input placeholder="예: 거래처 미팅 커피" />
        <Description>비워 두면 「용도 미기재」 로 표시되고, 나중에 목록에서 채울 수 있어요.</Description>
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
        <div>
          <Button type="submit" isPending={pending}>
            <FloppyDisk />
            {pending ? '저장하는 중…' : '저장하기'}
          </Button>
        </div>
      </div>
    </form>
  )
}
