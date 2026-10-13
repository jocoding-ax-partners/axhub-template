'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, toast } from '@heroui/react'
import { Trash } from '@phosphor-icons/react'
import { useConfirm } from '@/components/ax'
import { deleteCampaign } from '@/app/actions'

/** 캠페인 삭제 — 한 번 더 묻고, 지우면 목록으로 돌아가요. 날짜별 기록도 같이 지워져요. */
export function DeleteCampaignButton({ id, name, days }: { id: string; name: string; days: number }) {
  const confirm = useConfirm()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  async function onPress() {
    const ok = await confirm({
      title: `"${name}" 캠페인을 지울까요?`,
      description: days > 0 ? `날짜별 기록 ${days}건도 함께 지워져요. 되돌릴 수 없어요.` : '지우면 되돌릴 수 없어요.',
      confirmLabel: '삭제',
      variant: 'danger',
    })
    if (!ok) return
    const data = new FormData()
    data.set('id', id)
    startTransition(async () => {
      const r = await deleteCampaign(null, data)
      if (r.ok) {
        toast.success(r.message)
        router.push('/')
      } else {
        toast.danger(r.message)
      }
    })
  }

  return (
    <Button variant="outline" data-color="danger" isPending={pending} onPress={onPress}>
      <Trash />
      삭제
    </Button>
  )
}
