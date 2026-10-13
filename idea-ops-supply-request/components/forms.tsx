'use client'

// 브라우저 폼 모음 — 신청 · 등록 · 입고 · 고치기. 검사는 서버(app/actions.ts)에서 다시 해요 — 여기선 입력을 돕기만 해요.
import { useState, useTransition, type FormEvent } from 'react'
import { Alert, Button, FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { PaperPlaneTilt, Plus, Tray } from '@phosphor-icons/react'
import { addSupply, editSupply, receiveStock, requestSupply, type FormState } from '@/app/actions'
import { NAME_MAX, NOTE_MAX, REQUEST_MAX, STOCK_MAX } from '@/lib/supply'

type Action = (prev: FormState | null, form: FormData) => Promise<FormState>

/** 폼 제출 공통 — 성공하면 알림(오른쪽 위)을 띄우고 폼을 비워요, 실패하면 폼 아래에 문구를 보여요. */
function useSubmit(action: Action, onSuccess?: () => void) {
  const [error, setError] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await action(null, data)
      if (r.ok) {
        toast.success(r.message)
        setError(null)
        // key 를 바꿔 폼을 새로 그려요 — 입력칸이 비워져요.
        setFormKey((k) => k + 1)
        onSuccess?.()
      } else {
        setError(r.message)
      }
    })
  }
  return { error, formKey, pending, onSubmit }
}

export function ErrorAlert({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <Alert status="danger" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
    </Alert>
  )
}

/** 비품 한 줄의 신청 칸 — 수량 · 메모 + 신청. */
export function RequestForm({ id, name, stock }: { id: string; name: string; stock: number }) {
  const [qty, setQty] = useState('1')
  const { error, formKey, pending, onSubmit } = useSubmit(requestSupply, () => setQty('1'))
  const over = Number(qty) > stock
  return (
    <form key={formKey} onSubmit={onSubmit} className="flex w-full flex-col gap-2 sm:w-96">
      <input type="hidden" name="supply_id" value={id} />
      <div className="flex gap-2">
        <TextField name="qty" type="number" isRequired value={qty} onChange={setQty} aria-label={`${name} 신청 수량`} className="w-20 shrink-0">
          <Input inputMode="numeric" min={1} max={REQUEST_MAX} />
        </TextField>
        <TextField name="note" maxLength={NOTE_MAX} aria-label={`${name} 신청 메모`} className="min-w-0 flex-1">
          <Input placeholder="메모 (선택)" />
        </TextField>
        <Button type="submit" isPending={pending} className="shrink-0">
          <PaperPlaneTilt />
          신청
        </Button>
      </div>
      {over && <p className="t-caption text-warning">지금 재고보다 많아요. 입고된 뒤에 지급될 수 있어요.</p>}
      <ErrorAlert message={error} />
    </form>
  )
}

/** 비품 등록 폼 (관리자). */
export function SupplyForm() {
  const { error, formKey, pending, onSubmit } = useSubmit(addSupply)
  return (
    <form key={formKey} onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <TextField name="name" isRequired maxLength={NAME_MAX}>
        <Label>비품 이름</Label>
        <Input placeholder="예: A4 복사용지" />
        <FieldError />
      </TextField>
      <TextField name="stock" type="number" isRequired>
        <Label>현재 재고</Label>
        <Input inputMode="numeric" min={0} max={STOCK_MAX} placeholder="예: 20" />
        <FieldError />
      </TextField>
      <TextField name="min_stock" type="number" isRequired>
        <Label>최소 재고</Label>
        <Input inputMode="numeric" min={0} max={STOCK_MAX} placeholder="예: 5" />
        <FieldError />
      </TextField>
      <div className="flex flex-col gap-3 sm:col-span-3">
        <ErrorAlert message={error} />
        <div>
          <Button type="submit" isPending={pending}>
            <Plus />
            {pending ? '등록하는 중…' : '등록하기'}
          </Button>
        </div>
      </div>
    </form>
  )
}

/** 비품 한 줄의 입고 칸 (관리자) — 수량만큼 재고를 더해요. */
export function ReceiveForm({ id, name }: { id: string; name: string }) {
  const { error, formKey, pending, onSubmit } = useSubmit(receiveStock)
  return (
    <form key={formKey} onSubmit={onSubmit} className="flex w-full flex-col gap-2 sm:w-auto">
      <input type="hidden" name="id" value={id} />
      <div className="flex gap-2">
        <TextField name="qty" type="number" isRequired aria-label={`${name} 입고 수량`} className="flex-1 sm:w-28 sm:flex-none">
          <Input inputMode="numeric" min={1} max={STOCK_MAX} placeholder="입고 수량" />
        </TextField>
        <Button type="submit" variant="outline" isPending={pending}>
          <Tray />
          입고
        </Button>
      </div>
      <ErrorAlert message={error} />
    </form>
  )
}

/** 이름 · 최소 재고 고치기 (관리자). 평소엔 접혀 있어요. */
export function EditSupplyForm({ id, name, minStock }: { id: string; name: string; minStock: number }) {
  const { error, pending, onSubmit } = useSubmit(editSupply)
  return (
    <details className="t-small">
      <summary className="cursor-pointer text-muted">이름 · 최소 재고 고치기</summary>
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="id" value={id} />
        <TextField name="name" isRequired maxLength={NAME_MAX} defaultValue={name} className="sm:w-56">
          <Label>비품 이름</Label>
          <Input />
        </TextField>
        <TextField name="min_stock" type="number" isRequired defaultValue={String(minStock)} className="sm:w-28">
          <Label>최소 재고</Label>
          <Input inputMode="numeric" min={0} max={STOCK_MAX} />
        </TextField>
        <Button type="submit" variant="outline" isPending={pending}>
          저장
        </Button>
      </form>
      <div className="mt-2">
        <ErrorAlert message={error} />
      </div>
    </details>
  )
}
