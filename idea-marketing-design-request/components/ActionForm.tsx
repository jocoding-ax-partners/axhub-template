'use client'

import { useActionState, type ReactNode } from 'react'
import type { FormState } from '@/app/actions'

/**
 * 버튼 몇 개짜리 작은 폼 (맡기 · 단계 바꾸기 · 결과물 지우기). 서버 액션이 돌려준 결과 문구를 버튼 아래에 보여 줘요.
 * 안의 버튼은 ConfirmButton 을 써요 (제출 중 잠김 · 확인창).
 */
export function ActionForm({
  action,
  children,
  align = 'end',
}: {
  action: (prev: FormState | null, form: FormData) => Promise<FormState>
  children: ReactNode
  /** 버튼을 오른쪽(end) 또는 왼쪽(start)에 붙여요. */
  align?: 'start' | 'end'
}) {
  const [state, formAction, pending] = useActionState(action, null)
  return (
    <form action={formAction} className={`flex flex-wrap items-center gap-2 ${align === 'end' ? 'justify-end text-right' : 'justify-start'}`}>
      {children}
      {!pending && state?.message && (
        <p role="status" aria-live="polite" className={`t-caption w-full ${state.ok ? 'text-success' : 'text-danger'}`}>
          {state.message}
        </p>
      )}
    </form>
  )
}
