'use client'

import { useRef, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Button, type ButtonProps } from '@heroui/react'
import { useConfirm, type ConfirmOptions } from '@/components/ax'

/**
 * 폼 제출 버튼 (작은 크기). confirm 을 주면 확인창(useConfirm)으로 한 번 더 물어보고 제출해요
 * (반려·삭제·이미 정한 결정 바꾸기처럼 되돌리기 번거로운 일). 제출 중에는 눌리지 않아요.
 *
 * 확인창은 기다려야 하는(async) 일이라 이 버튼이 바로 제출하지 않아요. "예" 를 누르면 숨은 제출 버튼으로
 * 폼을 보내서, 승인/반려처럼 같은 폼의 버튼마다 다른 name·value 가 그대로 서버에 가요.
 */
export function ConfirmButton({
  children,
  confirm,
  variant = 'outline',
  danger = false,
  name,
  value,
}: {
  children: ReactNode
  confirm?: ConfirmOptions
  variant?: ButtonProps['variant']
  /** 빨간 글자 버튼 (outline · ghost 에만 적용돼요) */
  danger?: boolean
  name?: string
  value?: string
}) {
  const { pending } = useFormStatus()
  const ask = useConfirm()
  const submitter = useRef<HTMLButtonElement>(null)
  const look = { size: 'sm', variant, isDisabled: pending, 'data-color': danger ? 'danger' : undefined } as const

  if (!confirm) {
    return (
      <Button type="submit" name={name} value={value} {...look}>
        {children}
      </Button>
    )
  }
  return (
    <>
      <Button
        {...look}
        onPress={async () => {
          const ok = await ask(confirm)
          const button = submitter.current
          if (ok && button) button.form?.requestSubmit(button)
        }}
      >
        {children}
      </Button>
      <button ref={submitter} type="submit" name={name} value={value} hidden tabIndex={-1} aria-hidden />
    </>
  )
}
