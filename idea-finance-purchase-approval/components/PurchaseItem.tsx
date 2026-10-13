import { Button, Chip, Input, TextField } from '@heroui/react'
import { StatusDot } from '@/components/ax'
import { STATUS_LABEL, formatDateTime, isHighValue, won, type PurchaseStatus } from '@/lib/purchase'
import type { Purchase } from '@/lib/purchase-store'

const STATUS_TONE: Record<PurchaseStatus, 'warning' | 'active' | 'failed'> = {
  pending: 'warning',
  approved: 'active',
  rejected: 'failed',
}

/** 고액 표시 — 총액이 100만 원 이상일 때만 보여요. */
export function HighValueChip({ total }: { total: number }) {
  return isHighValue(total) ? (
    <Chip size="sm" color="warning">
      고액
    </Chip>
  ) : null
}

/** '2개 × 350,000원 = 700,000원' */
export function Amount({ row }: { row: Pick<Purchase, 'quantity' | 'unit_price' | 'total'> }) {
  return (
    <span>
      {row.quantity.toLocaleString('ko-KR')}개 × {won(row.unit_price)} = <span className="font-semibold">{won(row.total)}</span>
    </span>
  )
}

/** 목록의 요청 한 줄 (내 요청 · 처리 완료). showRequester 면 요청자 이름을 같이 보여요. */
export function PurchaseItem({ row, showRequester = false }: { row: Purchase; showRequester?: boolean }) {
  return (
    <li className="flex flex-col gap-2 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="t-small flex flex-wrap items-center gap-2">
          <span className="break-all font-semibold">{row.item}</span>
          <HighValueChip total={row.total} />
        </p>
        <p className="t-small mt-1 text-muted">
          <Amount row={row} />
        </p>
        <p className="t-small mt-2 break-words text-muted">사유: {row.reason}</p>
        {row.status === 'rejected' && row.reject_reason && (
          <p className="t-small mt-1 break-words text-danger">반려 사유: {row.reject_reason}</p>
        )}
        <p className="t-caption mt-1">
          {showRequester && `${row.user_name || row.user_email} · `}
          {formatDateTime(row.created_at)} 요청
          {row.decided_at && ` · ${formatDateTime(row.decided_at)} ${row.decided_by ?? ''}님이 처리`}
        </p>
      </div>
      <StatusDot tone={STATUS_TONE[row.status]} className="shrink-0">
        {STATUS_LABEL[row.status]}
      </StatusDot>
    </li>
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
      <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label={label} className="flex-1">
        <Input placeholder={label} />
      </TextField>
      <Button type="submit" variant="outline">
        찾기
      </Button>
    </form>
  )
}
