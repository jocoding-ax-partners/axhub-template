import type { ReactNode } from 'react'
import { Chip } from '@heroui/react'
import { StatusDot } from '@/components/ax'
import { dueHint, formatDate, isOverdue } from '@/lib/rental'
import type { EquipmentRow } from '@/lib/rental-store'

/**
 * 장비 목록의 한 줄 — 이름 · 종류 · 자산 번호, 그리고 지금 빌린 사람과 반납 예정일.
 * 반납 예정일이 지난 대여는 빨간색으로 보여요. 오른쪽 버튼(대여 · 반납 · 빼기)은 화면마다 달라서 actions 로 받아요.
 */
export function EquipmentItem({ item, today, actions }: { item: EquipmentRow; today: string; actions?: ReactNode }) {
  const late = item.due_date !== null && isOverdue(item.due_date, today)
  return (
    <li className="flex flex-col gap-3 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="t-small flex flex-wrap items-center gap-2 font-semibold">
          <span className="break-words">{item.name}</span>
          <Chip size="sm">{item.kind}</Chip>
        </p>
        <p className="t-caption break-all font-mono">{item.asset_no}</p>
        {item.rental_id && item.due_date ? (
          <div className={`t-small flex flex-wrap items-center gap-x-2 gap-y-1 ${late ? 'text-danger' : ''}`}>
            <StatusDot tone={late ? 'failed' : 'warning'}>{late ? '반납 지연' : '대여 중'}</StatusDot>
            <span className="break-all">{item.borrower_name || item.borrower_email}</span>
            <span className={late ? 'font-semibold' : 'text-muted'}>
              반납 예정 {formatDate(item.due_date)} · {dueHint(item.due_date, today)}
            </span>
          </div>
        ) : (
          <StatusDot tone="active" className="t-small">
            대여 가능
          </StatusDot>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </li>
  )
}
