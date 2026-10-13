'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import { Alert, Button, Card, Description, EmptyState, FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { FloppyDisk, PencilSimple, Trash } from '@phosphor-icons/react'
import { useConfirm } from '@/components/ax'
import { deleteDaily, saveDaily, type FormState } from '@/app/actions'
import { ctr, formatDay, formatInt, formatPct } from '@/lib/campaign'

type Daily = { day: string; impressions: number; clicks: number; conversions: number }

const EMPTY = { impressions: '', clicks: '', conversions: '' }

/**
 * 날짜별 성과 — 입력 폼과 기록 목록. 목록의 "고치기" 를 누르면 그날 숫자가 폼에 채워져요.
 * 같은 날짜로 저장하면 덮어써요. 고칠 권한이 없으면(editable=false) 목록만 보여요.
 */
export function DailyEditor({
  campaignId,
  start,
  end,
  today,
  rows,
  editable,
}: {
  campaignId: string
  start: string
  end: string
  today: string
  rows: Daily[]
  editable: boolean
}) {
  const confirm = useConfirm()
  const dayRef = useRef<HTMLInputElement>(null)
  const defaultDay = today >= start && today <= end ? today : ''
  const [day, setDay] = useState(defaultDay)
  const [counts, setCounts] = useState(EMPTY)
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()
  const existing = rows.some((r) => r.day === day)

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await saveDaily(null, data)
      if (r.ok) {
        toast.success(r.message)
        setError(null)
        setCounts(EMPTY)
      } else {
        setError(r)
      }
    })
  }

  function edit(r: Daily) {
    setDay(r.day)
    setCounts({ impressions: String(r.impressions), clicks: String(r.clicks), conversions: String(r.conversions) })
    setError(null)
    dayRef.current?.focus()
    dayRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  async function remove(r: Daily) {
    const ok = await confirm({
      title: `${formatDay(r.day)} 기록을 지울까요?`,
      description: '그날 노출·클릭·전환이 합계와 차트에서 빠져요. 되돌릴 수 없어요.',
      confirmLabel: '삭제',
      variant: 'danger',
    })
    if (!ok) return
    const data = new FormData()
    data.set('campaign_id', campaignId)
    data.set('day', r.day)
    startTransition(async () => {
      const res = await deleteDaily(null, data)
      if (res.ok) toast.success(res.message)
      else toast.danger(res.message)
    })
  }

  const newestFirst = [...rows].reverse()

  return (
    <div className="flex flex-col gap-10">
      {editable && (
        <Card>
          <Card.Header>
            <Card.Title>날짜별 성과 입력</Card.Title>
            <Card.Description>광고 관리 화면의 하루 숫자를 옮겨 적어요. 이미 적은 날짜를 다시 저장하면 새 숫자로 바뀌어요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <input type="hidden" name="campaign_id" value={campaignId} />
              <TextField name="day" type="date" isRequired value={day} onChange={setDay} className="col-span-2 lg:col-span-1">
                <Label>날짜</Label>
                <Input ref={dayRef} min={start} max={end} />
                {existing && <Description>이미 적은 날짜예요. 저장하면 덮어써요.</Description>}
                <FieldError />
              </TextField>
              {(
                [
                  ['impressions', '노출'],
                  ['clicks', '클릭'],
                  ['conversions', '전환'],
                ] as const
              ).map(([key, label]) => (
                <TextField
                  key={key}
                  name={key}
                  isRequired
                  value={counts[key]}
                  onChange={(v) => setCounts((c) => ({ ...c, [key]: v }))}
                  className={key === 'conversions' ? 'col-span-2 lg:col-span-1' : undefined}
                >
                  <Label>{label}</Label>
                  <Input inputMode="numeric" placeholder="0" />
                  <FieldError />
                </TextField>
              ))}
              <div className="col-span-2 flex flex-col gap-3 lg:col-span-4">
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
                    <FloppyDisk />
                    {pending ? '저장하는 중…' : existing ? '덮어쓰기' : '저장'}
                  </Button>
                </div>
              </div>
            </form>
          </Card.Content>
        </Card>
      )}

      <Card>
        <Card.Header>
          <Card.Title>날짜별 기록</Card.Title>
          <Card.Description>
            {rows.length > 0 ? `${rows.length}일 기록 · 최근 날짜부터 보여요.` : '기록한 날짜가 여기에 쌓여요.'}
          </Card.Description>
        </Card.Header>
        <Card.Content>
          {rows.length === 0 ? (
            <EmptyState>{editable ? '아직 기록이 없어요. 위에서 첫 날의 성과를 적어 보세요.' : '아직 기록이 없어요.'}</EmptyState>
          ) : (
            <ul className="list-none p-0">
              {newestFirst.map((r) => (
                <li
                  key={r.day}
                  className="flex flex-col gap-2 border-b border-default py-3 first:pt-0 last:border-0 last:pb-0 md:flex-row md:items-center md:gap-4"
                >
                  <p className="t-small font-semibold md:w-32 md:shrink-0">{formatDay(r.day)}</p>
                  <dl className="t-small m-0 grid flex-1 grid-cols-4 gap-2 tabular-nums">
                    {(
                      [
                        ['노출', formatInt(r.impressions)],
                        ['클릭', formatInt(r.clicks)],
                        ['전환', formatInt(r.conversions)],
                        ['클릭률', formatPct(ctr(r))],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <dt className="t-caption">{k}</dt>
                        <dd className="m-0 truncate">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {editable && (
                    <div className="flex gap-1 md:shrink-0">
                      <Button size="sm" variant="ghost" onPress={() => edit(r)} aria-label={`${formatDay(r.day)} 고치기`}>
                        <PencilSimple />
                        고치기
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-color="danger"
                        isDisabled={pending}
                        onPress={() => remove(r)}
                        aria-label={`${formatDay(r.day)} 지우기`}
                      >
                        <Trash />
                        지우기
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card.Content>
      </Card>
    </div>
  )
}
