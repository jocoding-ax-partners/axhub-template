'use client'

import { useState, useTransition } from 'react'
import { Alert, Button, toast } from '@heroui/react'
import { CheckCircle, Trash } from '@phosphor-icons/react'
import { useConfirm, type ConfirmOptions } from '@/components/ax'
import { cancelParcel, receiveParcel, type FormState } from '@/app/actions'

const ACTIONS = {
  receive: { run: receiveParcel, icon: CheckCircle },
  cancel: { run: cancelParcel, icon: Trash },
}

/** 한 번 더 묻고 실행하는 버튼 — 수령(receive) · 등록 취소(cancel). 성공하면 목록에서 빠져요. */
export function ParcelAction({
  action,
  id,
  label,
  confirm: options,
  primary,
}: {
  action: keyof typeof ACTIONS
  id: string
  label: string
  confirm: ConfirmOptions
  primary?: boolean
}) {
  const confirm = useConfirm()
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()
  const { run, icon: Icon } = ACTIONS[action]

  async function onPress() {
    setError(null)
    if (!(await confirm(options))) return
    const data = new FormData()
    data.set('id', id)
    startTransition(async () => {
      const r = await run(null, data)
      if (r.ok) toast.success(r.message)
      else setError(r)
    })
  }

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <Button
        variant={primary ? 'primary' : 'outline'}
        size="sm"
        data-color={action === 'cancel' ? 'danger' : undefined}
        isPending={pending}
        onPress={onPress}
        className="w-full sm:w-auto"
      >
        <Icon />
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
