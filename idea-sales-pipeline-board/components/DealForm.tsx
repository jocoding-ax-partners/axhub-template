'use client'

import { useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Alert, Button, Description, FieldError, Input, Label, ListBox, Select, TextField, buttonVariants, toast } from '@heroui/react'
import { FloppyDisk, Trash } from '@phosphor-icons/react'
import { useConfirm } from '@/components/ax'
import { createDeal, deleteDeal, updateDeal, type FormState } from '@/app/actions'
import { LIMITS, STAGES, STAGE_LABEL, isStage, type Stage } from '@/lib/pipeline'

export type DealDefaults = {
  id?: string
  /** 고칠 때만: 폼을 연 때의 updated_at (ISO). 그 사이 누가 바꿨으면 저장을 막아요. */
  updated_at?: string
  company: string
  amount: string
  owner: string
  expected_close: string | null
  stage: Stage
}

/**
 * 거래 추가·고치기 폼. 검사는 서버(app/actions.ts)에서 다시 해요 — 여기선 입력을 돕기만 해요.
 * 저장하면 보드로 돌아가요. canDelete 면 아래에 지우기 버튼이 보여요 (등록한 사람 · 관리자).
 */
export function DealForm({ defaults, canDelete = false }: { defaults: DealDefaults; canDelete?: boolean }) {
  const router = useRouter()
  const confirm = useConfirm()
  const editing = Boolean(defaults.id)
  const [stage, setStage] = useState<Stage>(defaults.stage)
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = editing ? await updateDeal(null, data) : await createDeal(null, data)
      if (!r.ok) return setError(r)
      toast.success(r.message)
      router.push('/')
    })
  }

  async function onDelete() {
    const ok = await confirm({
      title: `${defaults.company} 거래를 지울까요?`,
      description: '지운 거래는 되돌릴 수 없어요. 놓친 거래라면 지우지 말고 「실패」 단계로 옮겨 두는 게 좋아요.',
      confirmLabel: '지우기',
      variant: 'danger',
    })
    if (!ok || !defaults.id) return
    const id = defaults.id
    startTransition(async () => {
      const r = await deleteDeal(id)
      if (!r.ok) return setError(r)
      toast.success(r.message)
      router.push('/')
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {editing && <input type="hidden" name="id" value={defaults.id} />}
      {editing && <input type="hidden" name="updated_at" value={defaults.updated_at} />}

      <TextField name="company" isRequired maxLength={LIMITS.company} defaultValue={defaults.company} className="sm:col-span-2">
        <Label>고객사</Label>
        <Input placeholder="예: 한빛상사" />
        <FieldError />
      </TextField>

      <TextField name="amount" isRequired defaultValue={defaults.amount}>
        <Label>예상 금액 (원)</Label>
        <Input inputMode="numeric" placeholder="예: 12,000,000" />
        <Description>쉼표는 넣어도 되고 빼도 돼요.</Description>
        <FieldError />
      </TextField>

      <TextField name="owner" isRequired maxLength={LIMITS.owner} defaultValue={defaults.owner}>
        <Label>담당자</Label>
        <Input placeholder="예: 김영업" />
        <FieldError />
      </TextField>

      <TextField name="expected_close" type="date" defaultValue={defaults.expected_close ?? ''}>
        <Label>예상 계약일</Label>
        <Input min="2000-01-01" max="2099-12-31" />
        <Description>모르면 비워 둬요.</Description>
        <FieldError />
      </TextField>

      <Select name="stage" isRequired selectedKey={stage} onSelectionChange={(k) => {
          const s = String(k)
          if (isStage(s)) setStage(s)
        }}>
        <Label>단계</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {STAGES.map((s) => (
              <ListBox.Item key={s} id={s} textValue={STAGE_LABEL[s]}>
                {STAGE_LABEL[s]}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <div className="flex flex-col gap-3 sm:col-span-2">
        {error && (
          <Alert status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{error.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" isPending={pending}>
            <FloppyDisk />
            {pending ? '저장하는 중…' : editing ? '저장' : '거래 추가'}
          </Button>
          <Link href="/" className={buttonVariants({ variant: 'outline' })}>
            취소
          </Link>
          {canDelete && (
            <Button variant="outline" data-color="danger" className="sm:ml-auto" isPending={pending} onPress={onDelete}>
              <Trash />
              지우기
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
