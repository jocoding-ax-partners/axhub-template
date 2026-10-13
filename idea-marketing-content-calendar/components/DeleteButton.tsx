'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, toast } from '@heroui/react'
import { Trash } from '@phosphor-icons/react'
import { useConfirm } from '@/components/ax'
import { deleteContent } from '@/app/actions'

/** 콘텐츠 지우기. 한 번 더 묻고, 지우면 그 달 달력으로 돌아가요. */
export function DeleteButton({ id, title }: { id: string; title: string }) {
  const confirm = useConfirm()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  async function onPress() {
    const ok = await confirm({
      title: '이 콘텐츠를 지울까요?',
      description: `"${title}" 을(를) 지우면 되돌릴 수 없어요.`,
      confirmLabel: '지우기',
      variant: 'danger',
    })
    if (!ok) return
    startTransition(async () => {
      const r = await deleteContent(id)
      if (!r.ok) {
        toast.danger(r.message)
        return
      }
      toast.success(r.message)
      router.push(`/?m=${r.month}`)
    })
  }

  return (
    <Button variant="outline" data-color="danger" isPending={pending} onPress={onPress}>
      <Trash />
      {pending ? '지우는 중…' : '지우기'}
    </Button>
  )
}
