'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Alert, Button, FieldError, Input, Label, ListBox, Select, TextField, toast } from '@heroui/react'
import { PaperPlaneTilt } from '@phosphor-icons/react'
import { submitLeave, type FormState } from '@/app/actions'
import { KIND_LABEL, REASON_MAX } from '@/lib/leave'

/** 휴가 신청 폼. 검사는 서버(app/actions.ts)에서 다시 해요 — 여기선 입력을 돕기만 해요. */
export function LeaveForm() {
  // 신청에 성공하면 key 를 바꿔 폼을 새로 그려요 — 입력칸이 전부 비워져요.
  const [formKey, setFormKey] = useState(0)
  const [kind, setKind] = useState('annual')
  const [start, setStart] = useState('')
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()
  const half = kind === 'half'

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await submitLeave(null, data)
      if (r.ok) {
        toast.success(r.message)
        setError(null)
        setFormKey((k) => k + 1)
        setKind('annual')
        setStart('')
      } else {
        setError(r)
      }
    })
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Select name="kind" isRequired selectedKey={kind} onSelectionChange={(k) => setKind(String(k ?? 'annual'))}>
        <Label>휴가 종류</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <ListBox.Item key={k} id={k} textValue={v}>
                {v}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <TextField name="start_date" type="date" isRequired value={start} onChange={setStart}>
        <Label>{half ? '날짜' : '시작일'}</Label>
        <Input />
        <FieldError />
      </TextField>

      {half ? (
        <TextField isDisabled value="반차는 하루만 신청해요">
          <Label>종료일</Label>
          <Input />
        </TextField>
      ) : (
        <TextField name="end_date" type="date" isRequired>
          <Label>종료일</Label>
          <Input min={start || undefined} />
          <FieldError />
        </TextField>
      )}

      <TextField name="reason" isRequired maxLength={REASON_MAX} className="sm:col-span-3">
        <Label>사유</Label>
        <Input placeholder="예: 가족 행사" />
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
            {pending ? '신청하는 중…' : '신청하기'}
          </Button>
        </div>
      </div>
    </form>
  )
}
