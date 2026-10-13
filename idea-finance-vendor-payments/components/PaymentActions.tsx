'use client'

import { useState, useTransition } from 'react'
import { Button, Input, TextField, toast } from '@heroui/react'
import { ArrowCounterClockwise, CheckCircle, PencilSimple, Trash } from '@phosphor-icons/react'
import { useConfirm } from '@/components/ax'
import { cancelPaid, deletePayment, markPaid, type FormState } from '@/app/actions'
import { PaymentForm, type PaymentDraft } from '@/components/PaymentForm'

type Props = {
  payment: PaymentDraft & { paid: boolean }
  /** 확인창·알림에 쓰는 한 줄 요약 (예: "한빛상사 1,500,000원") */
  summary: string
  today: string
  /** 지급 처리(완료 · 취소)를 할 수 있는지 — 관리자 */
  manager: boolean
  /** 고치기 · 지우기를 할 수 있는지 — 등록한 사람 또는 관리자 */
  editable: boolean
}

/**
 * 지급 건 한 줄 아래의 버튼들. 권한은 서버(app/actions.ts · lib/payment-store.ts)에서 다시 확인해요.
 *   미지급: [지급일][지급 완료] (관리자) · 고치기 · 지우기 (등록한 사람·관리자)
 *   지급 완료: 지급 취소 (관리자)
 */
export function PaymentActions({ payment, summary, today, manager, editable }: Props) {
  const confirm = useConfirm()
  const [paidDate, setPaidDate] = useState(today)
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  function send(action: (prev: FormState | null, form: FormData) => Promise<FormState>, fields: Record<string, string> = {}) {
    const data = new FormData()
    data.set('id', payment.id)
    for (const [k, v] of Object.entries(fields)) data.set(k, v)
    startTransition(async () => {
      const r = await action(null, data)
      if (r.ok) toast.success(r.message)
      else toast.danger(r.message)
    })
  }

  async function onCancelPaid() {
    const ok = await confirm({
      title: '지급 완료를 취소할까요?',
      description: `${summary} — 지급일 기록이 지워지고 다시 미지급으로 보여요.`,
      confirmLabel: '지급 취소',
      variant: 'danger',
    })
    if (ok) send(cancelPaid)
  }

  async function onDelete() {
    const ok = await confirm({
      title: '이 지급 건을 지울까요?',
      description: `${summary} — 지우면 되돌릴 수 없어요.`,
      confirmLabel: '지우기',
      variant: 'danger',
    })
    if (ok) send(deletePayment)
  }

  if (payment.paid) {
    if (!manager) return null
    return (
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" isPending={pending} onPress={onCancelPaid}>
          <ArrowCounterClockwise />
          지급 취소
        </Button>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-default p-4">
        <PaymentForm today={today} draft={payment} onDone={() => setEditing(false)} />
      </div>
    )
  }

  if (!manager && !editable) return null

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {manager ? (
        <div className="flex items-center gap-2">
          <TextField type="date" aria-label={`${summary} 지급일`} value={paidDate} onChange={setPaidDate} className="min-w-0 flex-1 sm:flex-none">
            <Input max={today} />
          </TextField>
          <Button size="sm" isPending={pending} isDisabled={!paidDate} onPress={() => send(markPaid, { paid_date: paidDate })}>
            <CheckCircle />
            지급 완료
          </Button>
        </div>
      ) : (
        <span />
      )}
      {editable && (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" isDisabled={pending} onPress={() => setEditing(true)}>
            <PencilSimple />
            고치기
          </Button>
          <Button size="sm" variant="ghost" data-color="danger" isDisabled={pending} onPress={onDelete}>
            <Trash />
            지우기
          </Button>
        </div>
      )}
    </div>
  )
}
