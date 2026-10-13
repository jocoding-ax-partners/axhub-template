'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Alert, Button, FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { Plus } from '@phosphor-icons/react'
import { addEquipment, type FormState } from '@/app/actions'
import { ASSET_NO_MAX, KIND_MAX, NAME_MAX } from '@/lib/rental'

/** 장비 등록 폼 (관리자). 검사는 서버(app/actions.ts)에서 다시 해요. */
export function EquipmentForm() {
  // 등록에 성공하면 key 를 바꿔 폼을 새로 그려요 — 입력칸이 비워져요.
  const [formKey, setFormKey] = useState(0)
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await addEquipment(null, data)
      if (r.ok) {
        toast.success(r.message)
        setError(null)
        setFormKey((k) => k + 1)
      } else {
        setError(r)
      }
    })
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <TextField name="name" isRequired maxLength={NAME_MAX}>
        <Label>이름</Label>
        <Input placeholder="예: 맥북 프로 14" />
        <FieldError />
      </TextField>
      <TextField name="kind" isRequired maxLength={KIND_MAX}>
        <Label>종류</Label>
        <Input placeholder="예: 노트북" />
        <FieldError />
      </TextField>
      <TextField name="asset_no" isRequired maxLength={ASSET_NO_MAX}>
        <Label>자산 번호</Label>
        <Input placeholder="예: NB-0012" />
        <FieldError />
      </TextField>

      <div className="flex flex-col gap-3 sm:col-span-3">
        {error && (
          <Alert status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{error.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
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
