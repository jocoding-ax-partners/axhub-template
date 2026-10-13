'use client'

import { startTransition, useActionState, useRef, useState, type FormEvent } from 'react'
import { Alert, Button, Description, FieldError, Input, Label, TextArea, TextField, toast } from '@heroui/react'
import { PaperPlaneTilt } from '@phosphor-icons/react'
import { submitReport, type FormState } from '@/app/actions'
import { DESCRIPTION_MAX, LOCATION_MAX, MAX_PHOTO_BYTES, PHOTO_BAD_TYPE, PHOTO_TOO_BIG, PHOTO_TYPES } from '@/lib/facility'

/**
 * 고장 신고 폼. 사진 크기·형식은 여기서 먼저 알려 주고, 서버(app/actions.ts)가 같은 규칙으로 다시 검사해요.
 * 실패하면 입력한 값이 그대로 남고, 성공하면 폼을 비워요.
 */
export function ReportForm({ storageReady }: { storageReady: boolean }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [description, setDescription] = useState('')
  const [clientError, setClientError] = useState('')
  const [state, action, pending] = useActionState(async (prev: FormState | null, data: FormData) => {
    const r = await submitReport(prev, data)
    if (r.ok) {
      toast.success(r.message)
      formRef.current?.reset()
      setDescription('')
    }
    return r
  }, null)

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // 브라우저 기본 제출(React 의 자동 폼 비우기 포함)을 막아요 — 실패했을 때 입력이 남아 있게요.
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const file = data.get('photo')
    if (file instanceof File && file.size > 0) {
      if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return setClientError(PHOTO_BAD_TYPE)
      if (file.size > MAX_PHOTO_BYTES) return setClientError(PHOTO_TOO_BIG)
    }
    setClientError('')
    startTransition(() => action(data))
  }

  const error = clientError || (!pending && state && !state.ok ? state.message : '')

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextField name="location" isRequired maxLength={LOCATION_MAX}>
        <Label>위치</Label>
        <Input placeholder="예: 본관 3층 남자 화장실 두 번째 칸" />
        <FieldError />
      </TextField>

      <TextField name="description" isRequired maxLength={DESCRIPTION_MAX} value={description} onChange={setDescription}>
        <Label>내용</Label>
        <TextArea rows={4} placeholder="어떤 고장인지, 언제부터인지 적어 주세요. 예: 세면대 수도꼭지에서 물이 계속 새요." />
        <Description>
          {description.length}/{DESCRIPTION_MAX}자
        </Description>
        <FieldError />
      </TextField>

      {/* 파일 고르기는 HeroUI v3 에 없어서 브라우저 기본 입력에 버튼 모양만 입혀요. 휴대폰에서는 바로 촬영할 수도 있어요. */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="photo">사진</Label>
        {storageReady ? (
          <>
            <input
              id="photo"
              type="file"
              name="photo"
              accept={PHOTO_TYPES.join(',')}
              aria-describedby="photo-desc"
              className="t-small w-full min-w-0 cursor-pointer file:mr-3 file:h-button-sm file:cursor-pointer file:rounded-button-sm file:border-0 file:bg-default file:px-3 file:font-medium file:text-default-foreground"
            />
            <Description id="photo-desc">선택 · 1장 · JPG · PNG · WEBP · 10MB 이하</Description>
          </>
        ) : (
          <Description>사진 저장소가 켜지지 않아 지금은 사진 없이 신고해요.</Description>
        )}
      </div>

      {error && (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      <div>
        <Button type="submit" isPending={pending}>
          <PaperPlaneTilt />
          {pending ? '신고하는 중…' : '신고하기'}
        </Button>
      </div>
    </form>
  )
}
