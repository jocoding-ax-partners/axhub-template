'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, FieldError, Input, Label, TextArea, TextField, toast } from '@heroui/react'
import { FloppyDisk, Plus } from '@phosphor-icons/react'
import { saveContent, type FormState } from '@/app/actions'
import { CHANNELS, MEMO_MAX, OWNER_MAX, STATUSES, TITLE_MAX, type Channel, type Status } from '@/lib/content'
import { ChoiceSelect } from './ChoiceSelect'

export type ContentFormValues = {
  id?: string
  version?: number
  title: string
  channel: Channel
  publish_date: string
  owner: string
  status: Status
  memo: string
}

/**
 * 콘텐츠 등록(id 없음) · 수정(id 있음) 폼. 검사는 서버(app/actions.ts)에서 다시 해요 — 여기선 입력을 돕기만 해요.
 * 등록하면 그 달 달력으로 가고, 수정하면 이 화면에 머물러요.
 */
export function ContentForm({ initial }: { initial: ContentFormValues }) {
  const router = useRouter()
  const editing = Boolean(initial.id)
  const [channel, setChannel] = useState<string>(initial.channel)
  const [status, setStatus] = useState<string>(initial.status)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const r: FormState = await saveContent(null, data)
      if (!r.ok) {
        setError(r.message)
        return
      }
      setError(null)
      toast.success(r.message)
      if (editing) router.refresh()
      else router.push(`/?m=${r.month}`)
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {initial.version !== undefined && <input type="hidden" name="version" value={initial.version} />}

      <TextField name="title" isRequired maxLength={TITLE_MAX} defaultValue={initial.title} className="sm:col-span-2">
        <Label>제목</Label>
        <Input placeholder="예: 가을 신제품 소개 영상" />
        <FieldError />
      </TextField>

      <ChoiceSelect
        name="channel"
        isRequired
        label="채널"
        value={channel}
        onChange={setChannel}
        options={Object.entries(CHANNELS).map(([id, c]) => ({ id, label: c.label }))}
      />

      <TextField name="publish_date" type="date" isRequired defaultValue={initial.publish_date}>
        <Label>발행 예정일</Label>
        <Input min="2000-01-01" max="2100-12-31" />
        <FieldError />
      </TextField>

      <TextField name="owner" isRequired maxLength={OWNER_MAX} defaultValue={initial.owner}>
        <Label>담당자</Label>
        <Input placeholder="예: 김민지" />
        <FieldError />
      </TextField>

      <ChoiceSelect
        name="status"
        isRequired
        label="상태"
        value={status}
        onChange={setStatus}
        options={Object.entries(STATUSES).map(([id, label]) => ({ id, label }))}
      />

      <TextField name="memo" maxLength={MEMO_MAX} defaultValue={initial.memo} className="sm:col-span-2">
        <Label>메모 (선택)</Label>
        <TextArea rows={4} placeholder="기획 의도, 참고 링크, 해시태그처럼 함께 볼 내용을 적어요." />
      </TextField>

      <div className="flex flex-col gap-3 sm:col-span-2">
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
            {editing ? <FloppyDisk /> : <Plus />}
            {pending ? '저장하는 중…' : editing ? '저장하기' : '등록하기'}
          </Button>
        </div>
      </div>
    </form>
  )
}
