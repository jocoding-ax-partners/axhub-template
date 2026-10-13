'use client'

import { useState, useTransition } from 'react'
import { Alert, Button, toast } from '@heroui/react'
import { useConfirm, type ConfirmOptions } from '@/components/ax'
import { giveBack, retireEquipment, type FormState } from '@/app/actions'

const ACTIONS = { return: giveBack, retire: retireEquipment }

/** 한 번 더 묻고 실행하는 버튼 — 반납(return) · 목록에서 빼기(retire). */
export function ConfirmAction({
  action,
  id,
  label,
  confirm: options,
  danger,
}: {
  action: keyof typeof ACTIONS
  id: string
  label: string
  confirm: ConfirmOptions
  danger?: boolean
}) {
  const confirm = useConfirm()
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()

  async function run() {
    setError(null)
    if (!(await confirm(options))) return
    const data = new FormData()
    data.set('id', id)
    startTransition(async () => {
      const r = await ACTIONS[action](null, data)
      if (r.ok) toast.success(r.message)
      else setError(r)
    })
  }

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <Button variant="outline" size="sm" data-color={danger ? 'danger' : undefined} isPending={pending} onPress={run}>
        {label}
      </Button>
      {error && (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error.message}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
    </div>
  )
}
