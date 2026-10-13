'use client'

import { startTransition, useActionState } from 'react'
import { Button, toast } from '@heroui/react'
import { Trash } from '@phosphor-icons/react'
import { useConfirm } from '@/components/ax'
import { deleteContract, type FormState } from '@/app/actions'

/** 계약 한 건 지우기. 한 번 더 묻고, 지우면 목록과 합계에서 빠져요. */
export function DeleteContractButton({ id, summary }: { id: string; summary: string }) {
  const confirm = useConfirm()
  const [state, action, pending] = useActionState(async (prev: FormState | null, data: FormData) => {
    const r = await deleteContract(prev, data)
    if (r.ok) toast.success(r.message)
    return r
  }, null)

  async function onPress() {
    const ok = await confirm({
      title: '이 계약을 지울까요?',
      description: `${summary} — 지우면 월간 실적 합계에서도 빠지고 되돌릴 수 없어요.`,
      confirmLabel: '지우기',
      variant: 'danger',
    })
    if (!ok) return
    const data = new FormData()
    data.set('id', id)
    startTransition(() => action(data))
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="ghost" data-color="danger" isPending={pending} onPress={onPress} aria-label={`${summary} 지우기`}>
        <Trash />
        지우기
      </Button>
      {!pending && state && !state.ok && (
        <p role="alert" className="t-caption text-right text-danger">
          {state.message}
        </p>
      )}
    </div>
  )
}
