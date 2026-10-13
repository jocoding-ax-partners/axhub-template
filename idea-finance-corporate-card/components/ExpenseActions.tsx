'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Button, Input, TextField, toast } from '@heroui/react'
import { Trash } from '@phosphor-icons/react'
import { useConfirm } from '@/components/ax'
import { deleteExpense, fillPurpose } from '@/app/actions'
import { PURPOSE_MAX } from '@/lib/card'

/** 용도를 비워 둔 내 사용 건에 용도 채우기. 채우면 "용도 미기재" 표시가 사라져요. */
export function PurposeForm({ id }: { id: string }) {
  const [purpose, setPurpose] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!purpose.trim()) {
      setError('용도를 적어 주세요.')
      return
    }
    const data = new FormData()
    data.set('id', id)
    data.set('purpose', purpose)
    startTransition(async () => {
      const r = await fillPurpose(null, data)
      if (r.ok) toast.success(r.message)
      else setError(r.message)
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1">
      <div className="flex flex-col gap-2 sm:flex-row">
        <TextField
          aria-label="용도"
          maxLength={PURPOSE_MAX}
          value={purpose}
          onChange={(v) => {
            setPurpose(v)
            setError('')
          }}
          isInvalid={Boolean(error)}
          className="flex-1"
        >
          <Input placeholder="용도를 적어 주세요 (예: 팀 회식)" />
        </TextField>
        <Button type="submit" size="sm" variant="outline" isPending={pending} className="sm:self-center">
          {pending ? '적는 중…' : '용도 적기'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="t-caption text-danger">
          {error}
        </p>
      )}
    </form>
  )
}

/** 내가 입력한 사용 건 지우기. 한 번 더 물어보고 지워요. */
export function DeleteExpenseButton({ id, summary }: { id: string; summary: string }) {
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  async function onPress() {
    const ok = await confirm({
      title: '이 사용 건을 지울까요?',
      description: `${summary} — 지우면 되돌릴 수 없어요. 금액·부서를 잘못 적었다면 지우고 다시 입력해 주세요.`,
      confirmLabel: '지우기',
      variant: 'danger',
    })
    if (!ok) return
    const data = new FormData()
    data.set('id', id)
    startTransition(async () => {
      const r = await deleteExpense(null, data)
      if (r.ok) toast.success(r.message)
      else toast.danger(r.message)
    })
  }

  return (
    <Button size="sm" variant="ghost" data-color="danger" isPending={pending} onPress={onPress} aria-label={`${summary} 지우기`}>
      <Trash />
      지우기
    </Button>
  )
}
