'use client'

import { startTransition, useActionState, useState, type FormEvent } from 'react'
import { Alert, Button, Description, Label, ListBox, Select, TextArea, TextField, toast } from '@heroui/react'
import { saveHandling, type FormState } from '@/app/actions'
import { MEMO_MAX, STATUS_LABEL, type ReportStatus } from '@/lib/facility'

/**
 * 담당자가 신고 한 건의 상태와 처리 메모를 저장하는 폼.
 * version 은 화면을 그릴 때의 값이에요 — 그사이 다른 담당자가 고쳤다면 서버가 저장을 거절해요.
 */
export function HandleForm({ id, status, memo, version }: { id: string; status: ReportStatus; memo: string; version: number }) {
  const [nextStatus, setNextStatus] = useState<ReportStatus>(status)
  const [nextMemo, setNextMemo] = useState(memo)
  const [state, action, pending] = useActionState(async (prev: FormState | null, data: FormData) => {
    const r = await saveHandling(prev, data)
    // 저장하면 이 신고가 지금 탭에서 빠질 수 있어요 — 결과는 알림(오른쪽 위)으로 보여줘요.
    if (r.ok) toast.success(r.message)
    return r
  }, null)

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(() => action(data))
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        <Select name="status" isRequired selectedKey={nextStatus} onSelectionChange={(k) => setNextStatus((k as ReportStatus) ?? status)}>
          <Label>상태</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <ListBox.Item key={k} id={k} textValue={v}>
                  {v}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <TextField name="memo" maxLength={MEMO_MAX} value={nextMemo} onChange={setNextMemo}>
          <Label>처리 메모</Label>
          <TextArea rows={2} placeholder="예: 업체에 수리 요청했어요. 금요일 오전 방문 예정이에요." />
          <Description>신고한 직원에게 그대로 보여요 · {MEMO_MAX}자까지</Description>
        </TextField>
      </div>
      {!pending && state && !state.ok && (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{state.message}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      <div>
        <Button type="submit" size="sm" isPending={pending} isDisabled={nextStatus === status && nextMemo.trim() === memo}>
          {pending ? '저장하는 중…' : '저장'}
        </Button>
      </div>
    </form>
  )
}
