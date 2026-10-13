'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Button, type ButtonProps } from '@heroui/react'
import { useConfirm, type ConfirmOptions } from '@/components/ax'

/**
 * 폼 제출 버튼. 처리 중에는 눌리지 않아 두 번 제출되지 않아요.
 * confirm 을 주면 제출 전에 확인창으로 한 번 더 물어봐요 (취소처럼 되돌릴 수 없는 동작에).
 */
export function SubmitButton({
  children,
  confirm,
  variant = 'primary',
  size,
}: {
  children: ReactNode
  /** 확인창 내용 (useConfirm 옵션). 주면 확인을 눌러야 제출돼요. */
  confirm?: ConfirmOptions
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
}) {
  const { pending } = useFormStatus()
  const ask = useConfirm()
  const label = pending ? '처리하고 있어요…' : children

  if (!confirm) {
    return (
      <Button type="submit" variant={variant} size={size} isPending={pending}>
        {label}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      isPending={pending}
      onPress={async (e) => {
        // 확인창이 떠 있는 동안 버튼 자리가 바뀌어도 되도록 폼을 먼저 잡아 둬요.
        const form = (e.target as HTMLElement).closest('form')
        const ok = await ask(confirm)
        if (ok) form?.requestSubmit()
      }}
    >
      {label}
    </Button>
  )
}
