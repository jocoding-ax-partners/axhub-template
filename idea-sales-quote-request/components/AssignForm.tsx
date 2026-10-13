'use client'

import { useState, useTransition } from 'react'
import { Alert, Button, Label, ListBox, Select, toast } from '@heroui/react'
import { FloppyDisk } from '@phosphor-icons/react'
import { useConfirm } from '@/components/ax'
import { assignQuote, type FormState } from '@/app/actions'
import { STATUSES, STATUS_LABEL, isClosed, type QuoteStatus } from '@/lib/quote'

type Member = { user_key: string; name: string; email: string }

const NONE = 'none'

/** 요청 한 건의 담당자 · 상태 바꾸기 (팀장). 수주 · 실패로 바꿀 땐 한 번 더 물어봐요. */
export function AssignForm({
  id,
  summary,
  assignee,
  status,
  members,
}: {
  id: string
  summary: string
  assignee: string | null
  status: QuoteStatus
  members: Member[]
}) {
  const confirm = useConfirm()
  const [who, setWho] = useState(assignee ?? NONE)
  const [next, setNext] = useState<QuoteStatus>(status)
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()
  const changed = who !== (assignee ?? NONE) || next !== status
  // 배정된 사람이 후보 목록(최근 500명)에 없을 때도 지금 값은 보이게 해요.
  const options = assignee && !members.some((m) => m.user_key === assignee) ? [...members, { user_key: assignee, name: '(목록에 없는 사람)', email: '' }] : members

  async function save() {
    setError(null)
    if (next !== status && isClosed(next)) {
      const ok = await confirm({
        title: `${summary}을 ${STATUS_LABEL[next]}로 바꿀까요?`,
        description: '끝난 요청으로 표시돼요. 잘못 바꿨다면 다시 상태를 고르면 돼요.',
        confirmLabel: STATUS_LABEL[next],
        variant: next === 'lost' ? 'danger' : undefined,
      })
      if (!ok) return
    }
    const data = new FormData()
    data.set('id', id)
    data.set('assignee', who === NONE ? '' : who)
    data.set('status', next)
    startTransition(async () => {
      const r = await assignQuote(null, data)
      if (r.ok) toast.success(r.message)
      else setError(r)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Select selectedKey={who} onSelectionChange={(k) => setWho(String(k ?? NONE))}>
          <Label>담당자</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={NONE} textValue="미배정">
                미배정
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {options.map((m) => (
                <ListBox.Item key={m.user_key} id={m.user_key} textValue={m.name || m.email}>
                  {m.name || m.email}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select selectedKey={next} onSelectionChange={(k) => setNext((k as QuoteStatus) ?? status)}>
          <Label>상태</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {STATUSES.map((s) => (
                <ListBox.Item key={s} id={s} textValue={STATUS_LABEL[s]}>
                  {STATUS_LABEL[s]}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Button variant="outline" isDisabled={!changed} isPending={pending} onPress={save}>
          <FloppyDisk />
          {pending ? '저장하는 중…' : '저장'}
        </Button>
      </div>
      {error && (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error.message}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
    </div>
  )
}
