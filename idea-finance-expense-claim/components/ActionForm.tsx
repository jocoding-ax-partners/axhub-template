'use client'

import { useActionState, type ReactNode } from 'react'
import type { FormState } from '@/app/actions'

const INITIAL: FormState = { ok: false, message: '', at: 0 }

/**
 * 버튼 몇 개짜리 작은 폼 (지우기 · 승인 · 반려). 서버 액션이 돌려준 결과 문구를 버튼 아래에 보여 줘요.
 * 안의 버튼은 ConfirmButton 을 써요 (제출 중 잠김 · 확인창).
 */
export function ActionForm({
  action,
  children,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>
  children: ReactNode
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL)
  return (
    <form action={formAction} className="flex flex-wrap items-center justify-end gap-2">
      {children}
      {!pending && state.message && (
        <p role="status" aria-live="polite" className={`t-caption w-full text-right ${state.ok ? 'text-success' : 'text-danger'}`}>
          {state.message}
        </p>
      )}
    </form>
  )
}
