'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, toast } from '@heroui/react'
import { useConfirm } from '@/components/ax'
import { cancelRequest } from '@/app/actions'

/** 요청 취소 (요청자 본인, 접수 단계일 때만). 한 번 더 묻고, 취소하면 내 요청 목록으로 돌아가요. */
export function CancelRequestButton({ id }: { id: string }) {
  const confirm = useConfirm()
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  async function onPress() {
    const ok = await confirm({
      title: '이 요청을 취소할까요?',
      description: '요청과 올린 참고 자료가 모두 지워지고 되돌릴 수 없어요.',
      confirmLabel: '요청 취소',
      variant: 'danger',
    })
    if (!ok) return
    const data = new FormData()
    data.set('id', id)
    startTransition(async () => {
      const r = await cancelRequest(null, data)
      if (r.ok) {
        toast.success(r.message)
        router.replace('/')
      } else {
        setMessage(r.message)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" data-color="danger" size="sm" isPending={pending} onPress={onPress}>
        요청 취소
      </Button>
      {message && (
        <p role="alert" className="t-caption text-danger">
          {message}
        </p>
      )}
    </div>
  )
}
