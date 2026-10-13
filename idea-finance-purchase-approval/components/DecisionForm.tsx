'use client'

import { useRef, useState, useTransition } from 'react'
import { Alert, Button, Input, TextField, toast } from '@heroui/react'
import { useConfirm } from '@/components/ax'
import { decidePurchase, type FormState } from '@/app/actions'
import { REJECT_REASON_MAX } from '@/lib/purchase'

type Decision = 'approved' | 'rejected'

/** 대기 중인 요청 한 건의 승인·반려 버튼. 누르면 한 번 더 묻고, 처리하면 목록에서 빠져요. */
export function DecisionForm({ id, summary }: { id: string; summary: string }) {
  const confirm = useConfirm()
  const reasonRef = useRef<HTMLInputElement>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()

  async function decide(decision: Decision) {
    if (decision === 'rejected' && !reason.trim()) {
      setError({ ok: false, message: '반려 사유를 적어 주세요.' })
      reasonRef.current?.focus()
      return
    }
    setError(null)
    const ok = await confirm({
      title: decision === 'approved' ? `${summary}을 승인할까요?` : `${summary}을 반려할까요?`,
      description: '처리한 뒤에는 되돌릴 수 없어요.',
      confirmLabel: decision === 'approved' ? '승인' : '반려',
      variant: decision === 'approved' ? undefined : 'danger',
    })
    if (!ok) return
    const data = new FormData()
    data.set('id', id)
    data.set('decision', decision)
    data.set('reject_reason', reason)
    startTransition(async () => {
      const r = await decidePurchase(null, data)
      // 성공하면 이 요청은 대기 목록에서 빠져요 — 결과는 알림(오른쪽 위)으로 보여줘요.
      if (r.ok) toast.success(r.message)
      else setError(r)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <TextField aria-label="반려 사유" maxLength={REJECT_REASON_MAX} value={reason} onChange={setReason} className="flex-1">
          <Input ref={reasonRef} placeholder="반려 사유 (반려할 때만 적어요)" />
        </TextField>
        <div className="flex gap-2">
          <Button className="flex-1 sm:flex-none" isPending={pending} onPress={() => decide('approved')}>
            승인
          </Button>
          <Button variant="outline" data-color="danger" className="flex-1 sm:flex-none" isPending={pending} onPress={() => decide('rejected')}>
            반려
          </Button>
        </div>
      </div>
      {pending ? (
        <p role="status" className="t-small">
          처리하는 중…
        </p>
      ) : (
        error && (
          <Alert status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{error.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        )
      )}
    </div>
  )
}
