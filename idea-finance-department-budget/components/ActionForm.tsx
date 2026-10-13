'use client'

import { useState, useTransition, type FormEvent, type ReactNode } from 'react'
import { Alert, Button, toast } from '@heroui/react'
import type { FormState } from '@/app/actions'

type Action = (prev: FormState | null, form: FormData) => Promise<FormState>

/**
 * Server Action 을 부르는 폼 한 개. 성공하면 알림(오른쪽 위)을 띄우고 입력칸을 비우고,
 * 실패하면 폼 아래에 이유를 보여줘요. 검사는 서버(app/actions.ts)에서 다시 해요.
 *
 *   <ActionForm action={addDepartment} submitLabel="부서 추가">…입력칸…</ActionForm>
 */
export function ActionForm({
  action,
  hidden = {},
  submitLabel,
  pendingLabel = '저장하는 중…',
  icon,
  className = 'flex flex-col gap-3 sm:flex-row sm:items-end',
  children,
}: {
  action: Action
  hidden?: Record<string, string>
  submitLabel: string
  pendingLabel?: string
  icon?: ReactNode
  className?: string
  children: ReactNode
}) {
  // 성공하면 key 를 바꿔 폼을 새로 그려요 — 입력칸이 전부 비워져요.
  const [formKey, setFormKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    for (const [k, v] of Object.entries(hidden)) data.set(k, v)
    startTransition(async () => {
      const r = await action(null, data)
      if (r.ok) {
        toast.success(r.message)
        setError(null)
        setFormKey((k) => k + 1)
      } else {
        setError(r.message)
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <form key={formKey} onSubmit={onSubmit} className={className}>
        {children}
        <div>
          <Button type="submit" isPending={pending} className="w-full sm:w-auto">
            {icon}
            {pending ? pendingLabel : submitLabel}
          </Button>
        </div>
      </form>
      {error && (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
    </div>
  )
}
