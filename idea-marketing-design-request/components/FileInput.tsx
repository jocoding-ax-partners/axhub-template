'use client'

import { useId } from 'react'
import { Description, Label } from '@heroui/react'

/**
 * 여러 파일 고르기. 파일 입력은 HeroUI v3 에 없어서 브라우저 기본 입력에 버튼 모양만 입혀요.
 * 파일 저장소가 꺼져 있으면(로컬 실행 등) 입력 대신 안내만 보여요.
 */
export function FileInput({
  name,
  label,
  hint,
  accept,
  storageReady,
  required = false,
}: {
  name: string
  label: string
  hint: string
  accept: string
  storageReady: boolean
  required?: boolean
}) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      {storageReady ? (
        <>
          <input
            id={id}
            type="file"
            name={name}
            multiple
            required={required}
            accept={accept}
            aria-describedby={`${id}-hint`}
            className="t-small w-full min-w-0 cursor-pointer file:mr-3 file:h-button-sm file:cursor-pointer file:rounded-button-sm file:border-0 file:bg-default file:px-3 file:font-medium file:text-default-foreground"
          />
          <Description id={`${id}-hint`}>{hint}</Description>
        </>
      ) : (
        <Description>파일 저장소가 아직 켜지지 않아 지금은 파일을 올릴 수 없어요. axhub 에 배포하면 켜져요.</Description>
      )}
    </div>
  )
}
