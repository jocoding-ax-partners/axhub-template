'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, toast } from '@heroui/react'
import { ArrowCounterClockwise, Check, Trash } from '@phosphor-icons/react'
import { useConfirm } from '@/components/ax'
import { deleteShipment, markFollowUp } from '@/app/actions'

// 결과는 알림(오른쪽 위)으로 보여줘요. 완료하면 이 줄이 "연락할 때가 된 건" 에서 빠지며 버튼이 사라져도
// 알림은 남도록, 서버 응답을 받은 그 자리에서 바로 띄워요.

/** 후속 연락 "완료" 표시 · 완료 취소 버튼. */
export function FollowUpButton({ id, done }: { id: string; done: boolean }) {
  const [pending, startTransition] = useTransition()

  function press() {
    const data = new FormData()
    data.set('id', id)
    data.set('done', String(!done))
    startTransition(async () => {
      const r = await markFollowUp(null, data)
      if (r.ok) toast.success(r.message)
      else toast.danger(r.message)
    })
  }

  return done ? (
    <Button size="sm" variant="ghost" isPending={pending} onPress={press}>
      <ArrowCounterClockwise />
      완료 취소
    </Button>
  ) : (
    <Button size="sm" variant="outline" data-color="success" isPending={pending} onPress={press}>
      <Check />
      완료
    </Button>
  )
}

/** 발송 기록 지우기 — 한 번 더 묻고, 지우면 전체 목록으로 가요. */
export function DeleteShipmentButton({ id, summary }: { id: string; summary: string }) {
  const confirm = useConfirm()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  async function press() {
    const ok = await confirm({
      title: `${summary} 발송 기록을 지울까요?`,
      description: '지운 기록은 되돌릴 수 없어요.',
      confirmLabel: '지우기',
      variant: 'danger',
    })
    if (!ok) return
    const data = new FormData()
    data.set('id', id)
    startTransition(async () => {
      const r = await deleteShipment(null, data)
      if (!r.ok) {
        toast.danger(r.message)
        return
      }
      toast.success(r.message)
      router.push('/shipments')
    })
  }

  return (
    <Button variant="outline" data-color="danger" isPending={pending} onPress={press}>
      <Trash />
      지우기
    </Button>
  )
}
