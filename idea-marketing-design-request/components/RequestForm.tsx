'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Description, FieldError, Input, Label, ListBox, Select, TextArea, TextField, toast } from '@heroui/react'
import { PaperPlaneTilt } from '@phosphor-icons/react'
import { submitRequest, type FormState } from '@/app/actions'
import { COPY_MAX, FILE_ACCEPT, FILE_HINT, KIND_LABEL, REFERENCE_MAX, SIZE_MAX, checkFileSizes } from '@/lib/design'
import { FileInput } from './FileInput'

/**
 * 새 디자인 요청 폼. 검사는 서버(app/actions.ts)에서 다시 해요 — 여기선 입력을 돕기만 해요.
 * 보내면 방금 만든 요청 화면으로 이동해요. 실패하면 입력한 값이 그대로 남아요.
 */
export function RequestForm({ today, maxDue, storageReady }: { today: string; maxDue: string; storageReady: boolean }) {
  const router = useRouter()
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const files = data.getAll('references').filter((f): f is File => f instanceof File && f.size > 0)
    const fileError =
      files.length > REFERENCE_MAX ? `참고 자료는 ${REFERENCE_MAX}개까지 올릴 수 있어요.` : checkFileSizes(files.map((f) => f.size))
    if (fileError) return setError({ ok: false, message: fileError })
    setError(null)
    startTransition(async () => {
      const r = await submitRequest(null, data)
      if (r.ok && r.id) {
        toast.success(r.message)
        router.push(`/requests/${r.id}`)
      } else {
        setError(r)
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Select name="kind" isRequired placeholder="골라 주세요">
        <Label>종류</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <ListBox.Item key={k} id={k} textValue={v}>
                {v}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
        <FieldError />
      </Select>

      <TextField name="size" isRequired maxLength={SIZE_MAX}>
        <Label>크기</Label>
        <Input placeholder="예: 1200×628px, 인스타 피드 1:1" />
        <FieldError />
      </TextField>

      <TextField name="copy" isRequired maxLength={COPY_MAX} className="sm:col-span-2">
        <Label>들어갈 문구</Label>
        <TextArea rows={5} placeholder="제목 · 부제 · 버튼 문구처럼 이미지에 들어갈 글을 적어 주세요. 원하는 느낌도 함께 적으면 좋아요." />
        <Description>{COPY_MAX}자까지</Description>
        <FieldError />
      </TextField>

      <TextField name="due_date" type="date" isRequired>
        <Label>희망 마감일</Label>
        <Input min={today} max={maxDue} />
        <FieldError />
      </TextField>

      <FileInput
        name="references"
        label="참고 자료 파일"
        hint={`선택 · ${REFERENCE_MAX}개까지 · ${FILE_HINT}`}
        accept={FILE_ACCEPT}
        storageReady={storageReady}
      />

      <div className="flex flex-col gap-3 sm:col-span-2">
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
            <PaperPlaneTilt />
            {pending ? '보내는 중…' : '요청 보내기'}
          </Button>
        </div>
      </div>
    </form>
  )
}
