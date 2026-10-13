'use client'

import { useTransition, type ReactNode } from 'react'
import { Button, toast } from '@heroui/react'
import { useConfirm } from '@/components/ax'
import type { FormState } from '@/app/actions'

type Action = (prev: FormState | null, form: FormData) => Promise<FormState>

/** 지우기처럼 되돌릴 수 없는 동작 — 한 번 더 묻고 Server Action 을 불러요. 결과는 알림으로 보여줘요. */
export function ConfirmButton({
  action,
  fields,
  title,
  description,
  confirmLabel,
  children,
  label,
}: {
  action: Action
  fields: Record<string, string>
  title: string
  description: string
  confirmLabel: string
  /** 버튼 안 내용 (아이콘 · 글자) */
  children: ReactNode
  /** 화면 읽기 프로그램용 이름 — 버튼에 아이콘만 있을 때 */
  label?: string
}) {
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  async function onPress() {
    const ok = await confirm({ title, description, confirmLabel, variant: 'danger' })
    if (!ok) return
    const data = new FormData()
    for (const [k, v] of Object.entries(fields)) data.set(k, v)
    startTransition(async () => {
      const r = await action(null, data)
      if (r.ok) toast.success(r.message)
      else toast.danger(r.message)
    })
  }

  return (
    <Button size="sm" variant="ghost" data-color="danger" aria-label={label} isIconOnly={Boolean(label)} isPending={pending} onPress={onPress}>
      {children}
    </Button>
  )
}
