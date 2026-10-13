import type { ReactNode } from 'react'
import { Chip, Link, type ChipProps } from '@heroui/react'
import { STATUS_LABEL, dayLabel, won, type ExpenseStatus } from '@/lib/expense-utils'
import type { Expense } from '@/lib/expenses'

const STATUS_COLOR: Record<ExpenseStatus, ChipProps['color']> = { pending: 'warning', approved: 'success', rejected: 'default' }

export function StatusBadge({ status }: { status: ExpenseStatus }) {
  return (
    <Chip size="sm" variant="soft" color={STATUS_COLOR[status]} className="whitespace-nowrap">
      {STATUS_LABEL[status]}
    </Chip>
  )
}

// 마지막으로 승인·반려한 시각 — 한국 시간으로.
const decidedAt = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * 경비 한 건 (목록의 한 줄). 좁은 화면에선 버튼이 아래 줄로 내려가요.
 * actions 자리에 승인·반려·삭제 버튼을 넣어요.
 */
export function ExpenseItem({ expense: e, actions }: { expense: Expense; actions?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-default py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1 basis-48">
        <p className="t-small font-semibold">
          {e.category} <span className="font-normal text-muted">· {dayLabel(e.spent_on)}</span>
        </p>
        <p className="t-caption mt-0.5 break-words">
          {e.memo || '메모 없음'}
          {e.has_receipt && (
            <>
              {' · '}
              <Link className="text-caption-01 text-primary underline" href={`/receipts/${e.id}`} target="_blank" rel="noreferrer">
                영수증 보기
              </Link>
            </>
          )}
        </p>
        {e.reviewed_at && (
          <p className="t-caption mt-0.5 text-subtle">
            {STATUS_LABEL[e.status]} · {e.reviewer_name || '관리자'} · {decidedAt(e.reviewed_at)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="t-small font-semibold tabular-nums">{won(e.amount)}</span>
        <StatusBadge status={e.status} />
      </div>
      {actions && <div className="flex w-full justify-end gap-2 sm:w-auto">{actions}</div>}
    </li>
  )
}
