'use client'

import { startTransition, useActionState, useEffect, useId, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Description, FieldError, Input, Label, TextArea, TextField, toast } from '@heroui/react'
import { FloppyDisk, PaperPlaneTilt } from '@phosphor-icons/react'
import { createShipment, updateShipment } from '@/app/actions'
import { CONTACT_MAX, CUSTOMER_MAX, ITEMS_MAX, MEMO_MAX } from '@/lib/shipment'

export type ShipmentDraft = {
  id: string
  customer: string
  contact: string
  items: string
  sent_on: string
  follow_up_on: string | null
  memo: string
}

/**
 * 발송 기록 남기기 · 고치기 폼. draft 가 있으면 그 건을 고쳐요.
 * 검사는 서버(app/actions.ts)에서 다시 해요 — 여기선 입력을 돕기만 해요.
 * customers 는 자동완성 목록(이미 기록한 고객사) — 같은 고객사를 조금씩 다르게 적지 않게 도와줘요.
 */
export function ShipmentForm({
  today,
  customers,
  draft,
  defaultCustomer = '',
}: {
  today: string
  customers: string[]
  draft?: ShipmentDraft
  defaultCustomer?: string
}) {
  const router = useRouter()
  const listId = useId()
  const [state, formAction, pending] = useActionState(draft ? updateShipment : createShipment, null)
  const [sentOn, setSentOn] = useState(draft?.sent_on ?? today)

  useEffect(() => {
    if (!state?.ok) return
    toast.success(state.message)
    // 새로 남겼으면 전체 목록으로 가요 (맨 위에 방금 남긴 건이 보여요). 고친 건 이 화면에 그대로 있어요.
    if (!draft) router.push('/shipments')
  }, [state, draft, router])

  // <form action> 대신 직접 보내요 — React 가 실패한 뒤에도 입력칸을 비워 버리지 않게요.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    if (draft) data.set('id', draft.id)
    startTransition(() => formAction(data))
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField name="customer" isRequired maxLength={CUSTOMER_MAX} defaultValue={draft?.customer ?? defaultCustomer}>
        <Label>받는 고객사</Label>
        <Input placeholder="예: 한빛상사" list={customers.length > 0 ? listId : undefined} autoComplete="off" />
        <FieldError />
      </TextField>
      {customers.length > 0 && (
        <datalist id={listId}>
          {customers.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      )}

      <TextField name="contact" maxLength={CONTACT_MAX} defaultValue={draft?.contact}>
        <Label>받는 담당자 (선택)</Label>
        <Input placeholder="예: 구매팀 김민지 과장" autoComplete="off" />
      </TextField>

      <TextField name="items" isRequired maxLength={ITEMS_MAX} defaultValue={draft?.items} className="sm:col-span-2">
        <Label>보낸 것</Label>
        <Input placeholder="예: 신제품 샘플 3종, 2026 카탈로그" />
        <FieldError />
      </TextField>

      <TextField name="sent_on" type="date" isRequired value={sentOn} onChange={setSentOn}>
        <Label>보낸 날</Label>
        <Input max={today} />
        <FieldError />
      </TextField>

      <TextField name="follow_up_on" type="date" defaultValue={draft?.follow_up_on ?? ''}>
        <Label>후속 연락 예정일 (선택)</Label>
        <Input min={sentOn || undefined} />
        <Description>이날이 되면 홈 맨 위에 보여요.</Description>
        <FieldError />
      </TextField>

      <TextField name="memo" maxLength={MEMO_MAX} defaultValue={draft?.memo} className="sm:col-span-2">
        <Label>메모 (선택)</Label>
        <TextArea rows={3} placeholder="예: 다음 주 품평회 뒤 피드백 받기로 함, 운송장 1234-5678" />
      </TextField>

      <div className="flex flex-col gap-3 sm:col-span-2">
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
            {draft ? <FloppyDisk /> : <PaperPlaneTilt />}
            {pending ? '저장하는 중…' : draft ? '고친 내용 저장' : '기록하기'}
          </Button>
        </div>
      </div>
    </form>
  )
}
