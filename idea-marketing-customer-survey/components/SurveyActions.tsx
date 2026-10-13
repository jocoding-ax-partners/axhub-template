'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, TextField, toast } from '@heroui/react'
import { Copy, LockSimple, LockSimpleOpen, Trash } from '@phosphor-icons/react'
import { useConfirm } from '@/components/ax'
import { deleteSurvey, setSurveyStatus } from '@/app/actions'
import type { SurveyStatus } from '@/lib/survey'

/** 응답 링크 — 주소창과 복사 버튼. */
export function ShareLink({ url }: { url: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('응답 링크를 복사했어요.')
    } catch {
      toast.danger('복사하지 못했어요. 주소를 직접 선택해서 복사해 주세요.')
    }
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <TextField aria-label="응답 링크" value={url} isReadOnly className="flex-1">
        <Input onFocus={(e) => e.currentTarget.select()} />
      </TextField>
      <Button variant="outline" onPress={copy}>
        <Copy />
        링크 복사
      </Button>
    </div>
  )
}

/** 마감 · 다시 열기 · 삭제. 누르면 한 번 더 물어봐요. */
export function SurveyActions({ id, title, status }: { id: string; title: string; status: SurveyStatus }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  async function toggle() {
    const closing = status === 'open'
    const ok = await confirm({
      title: closing ? `"${title}" 설문을 마감할까요?` : `"${title}" 설문을 다시 열까요?`,
      description: closing ? '마감하면 링크로 들어와도 응답할 수 없어요. 나중에 다시 열 수 있어요.' : '다시 열면 아직 응답하지 않은 사람이 응답할 수 있어요.',
      confirmLabel: closing ? '마감' : '다시 열기',
    })
    if (!ok) return
    const data = new FormData()
    data.set('survey_id', id)
    data.set('status', closing ? 'closed' : 'open')
    startTransition(async () => {
      const r = await setSurveyStatus(null, data)
      if (r.ok) toast.success(r.message)
      else toast.danger(r.message)
    })
  }

  async function remove() {
    const ok = await confirm({
      title: `"${title}" 설문을 지울까요?`,
      description: '문항과 지금까지 받은 응답이 모두 지워지고, 되돌릴 수 없어요.',
      confirmLabel: '삭제',
      variant: 'danger',
    })
    if (!ok) return
    const data = new FormData()
    data.set('survey_id', id)
    startTransition(async () => {
      const r = await deleteSurvey(null, data)
      if (r.ok) {
        toast.success(r.message)
        router.push('/admin')
      } else {
        toast.danger(r.message)
      }
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" isPending={pending} onPress={toggle}>
        {status === 'open' ? <LockSimple /> : <LockSimpleOpen />}
        {status === 'open' ? '마감하기' : '다시 열기'}
      </Button>
      <Button variant="outline" data-color="danger" isPending={pending} onPress={remove}>
        <Trash />
        삭제
      </Button>
    </div>
  )
}
