import Link from 'next/link'
import { Button, Chip, EmptyState, Input, TextField } from '@heroui/react'
import { Paperclip } from '@phosphor-icons/react/ssr'
import { StatusDot } from '@/components/ax'
import { KIND_LABEL, STATUS_LABEL, dueLabel, formatDate, type DesignStatus } from '@/lib/design'
import type { RequestRow } from '@/lib/design-store'

const STATUS_TONE: Record<DesignStatus, 'warning' | 'active' | 'muted'> = {
  received: 'muted',
  in_progress: 'warning',
  review: 'warning',
  done: 'active',
}

export function StatusBadge({ status, className }: { status: DesignStatus; className?: string }) {
  return (
    <StatusDot tone={STATUS_TONE[status]} className={className}>
      {STATUS_LABEL[status]}
    </StatusDot>
  )
}

/** 희망 마감일 + 남은 날. 완료된 요청은 날짜만 보여요. */
export function DueText({ due, status, today }: { due: string; status: DesignStatus; today: string }) {
  if (status === 'done') return <span>{formatDate(due)}까지</span>
  const left = dueLabel(due, today)
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {formatDate(due)}까지
      <Chip size="sm" color={left.late ? 'danger' : 'default'}>
        {left.text}
      </Chip>
    </span>
  )
}

/** 요청 목록 한 줄씩 — 내 요청 · 요청 관리가 같이 써요. 줄을 누르면 상세로 가요. */
export function RequestList({
  rows,
  today,
  empty,
  showRequester = false,
}: {
  rows: RequestRow[]
  today: string
  empty: string
  showRequester?: boolean
}) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>
  return (
    <ul className="list-none p-0">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-col gap-2 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="t-small flex flex-wrap items-center gap-2">
              <Chip size="sm">{KIND_LABEL[r.kind]}</Chip>
              <span className="text-muted">#{r.id}</span>
              <span className="min-w-0 break-words text-muted">{r.size}</span>
            </p>
            <Link href={`/requests/${r.id}`} className="t-small line-clamp-2 break-words font-semibold text-default hover:underline">
              {r.copy_text}
            </Link>
            <p className="t-caption flex flex-wrap items-center gap-x-3 gap-y-1">
              <DueText due={r.due_date} status={r.status} today={today} />
              {showRequester && <span className="break-all">요청 {r.requester_name || r.requester_email}</span>}
              <span>담당 {r.designer_name ?? '아직 없음'}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
            <StatusBadge status={r.status} />
            {r.result_count > 0 && (
              <span className="t-caption inline-flex items-center gap-1">
                <Paperclip size={16} weight="fill" />
                결과물 {r.result_count}개
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

/** 목록 위 검색칸. GET 으로 같은 화면을 다시 열어요. hidden 은 함께 유지할 필터예요. */
export function SearchForm({
  action,
  q,
  label,
  hidden = {},
}: {
  action: string
  q: string
  label: string
  hidden?: Record<string, string>
}) {
  return (
    <form method="get" action={action} role="search" className="flex gap-2">
      {Object.entries(hidden).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label={label} className="min-w-0 flex-1">
        <Input placeholder={label} />
      </TextField>
      <Button type="submit" variant="outline">
        찾기
      </Button>
    </form>
  )
}
