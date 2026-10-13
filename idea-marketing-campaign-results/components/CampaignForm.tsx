'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Alert, Button, Description, FieldError, Input, Label, TextField, buttonVariants, toast } from '@heroui/react'
import { FloppyDisk, Plus } from '@phosphor-icons/react'
import { createCampaign, updateCampaign, type FormState } from '@/app/actions'
import { CHANNEL_MAX, CHANNEL_SUGGESTIONS, NAME_MAX } from '@/lib/campaign'

export type CampaignDraft = { id: string; name: string; channel: string; start_date: string; end_date: string; cost: number }

/** 캠페인 등록·수정 폼. campaign 을 넘기면 수정이에요. 검사는 서버(app/actions.ts)에서 다시 해요. */
export function CampaignForm({ campaign }: { campaign?: CampaignDraft }) {
  const router = useRouter()
  const [start, setStart] = useState(campaign?.start_date ?? '')
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()
  const cancelHref = campaign ? `/campaigns/${campaign.id}` : '/'

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = campaign ? await updateCampaign(null, data) : await createCampaign(null, data)
      if (r.ok && r.id) {
        toast.success(r.message)
        router.push(`/campaigns/${r.id}`)
      } else {
        setError(r)
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {campaign && <input type="hidden" name="id" value={campaign.id} />}

      <TextField name="name" isRequired maxLength={NAME_MAX} defaultValue={campaign?.name} className="sm:col-span-2">
        <Label>캠페인 이름</Label>
        <Input placeholder="예: 가을 신상품 검색광고" />
        <FieldError />
      </TextField>

      <TextField name="channel" isRequired maxLength={CHANNEL_MAX} defaultValue={campaign?.channel}>
        <Label>채널</Label>
        <Input list="channel-suggestions" placeholder="예: 네이버 검색광고" autoComplete="off" />
        <Description>목록에서 고르거나 직접 적어요.</Description>
        <FieldError />
      </TextField>
      <datalist id="channel-suggestions">
        {CHANNEL_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <TextField name="cost" isRequired defaultValue={campaign ? String(campaign.cost) : undefined}>
        <Label>비용 (원)</Label>
        <Input inputMode="numeric" placeholder="예: 1,500,000" />
        <Description>캠페인 기간 전체에 쓴 금액이에요.</Description>
        <FieldError />
      </TextField>

      <TextField name="start_date" type="date" isRequired value={start} onChange={setStart}>
        <Label>시작일</Label>
        <Input />
        <FieldError />
      </TextField>

      <TextField name="end_date" type="date" isRequired defaultValue={campaign?.end_date}>
        <Label>종료일</Label>
        <Input min={start || undefined} />
        <FieldError />
      </TextField>

      <div className="flex flex-col gap-3 sm:col-span-2">
        {error && (
          <Alert status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{error.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" isPending={pending}>
            {campaign ? <FloppyDisk /> : <Plus />}
            {pending ? '저장하는 중…' : campaign ? '고친 내용 저장' : '캠페인 등록'}
          </Button>
          <Link className={buttonVariants({ variant: 'outline' })} href={cancelHref}>
            취소
          </Link>
        </div>
      </div>
    </form>
  )
}
