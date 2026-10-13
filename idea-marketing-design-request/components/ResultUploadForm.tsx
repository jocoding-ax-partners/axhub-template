'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import { Alert, Button, toast } from '@heroui/react'
import { UploadSimple } from '@phosphor-icons/react'
import { uploadResults, type FormState } from '@/app/actions'
import { FILE_ACCEPT, FILE_HINT, UPLOAD_MAX_FILES, checkFileSizes } from '@/lib/design'
import { FileInput } from './FileInput'

/** 결과물 올리기 (맡은 디자이너). 올리면 결과물 목록에 바로 보여요. */
export function ResultUploadForm({ id, storageReady }: { id: string; storageReady: boolean }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const files = data.getAll('results').filter((f): f is File => f instanceof File && f.size > 0)
    const fileError = files.length === 0 ? '올릴 파일을 골라 주세요.' : checkFileSizes(files.map((f) => f.size))
    if (fileError) return setError({ ok: false, message: fileError })
    setError(null)
    startTransition(async () => {
      const r = await uploadResults(null, data)
      if (r.ok) {
        toast.success(r.message)
        formRef.current?.reset()
      } else {
        setError(r)
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <FileInput
        name="results"
        label="결과물 올리기"
        hint={`한 번에 ${UPLOAD_MAX_FILES}개까지 · ${FILE_HINT}`}
        accept={FILE_ACCEPT}
        storageReady={storageReady}
        required
      />
      {error && (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error.message}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {storageReady && (
        <div>
          <Button type="submit" size="sm" isPending={pending}>
            <UploadSimple />
            {pending ? '올리는 중…' : '올리기'}
          </Button>
        </div>
      )}
    </form>
  )
}
