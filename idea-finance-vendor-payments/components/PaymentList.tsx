import Link from 'next/link'
import { EmptyState } from '@heroui/react'
import { StatusDot } from '@/components/ax'
import { PaymentActions } from '@/components/PaymentActions'
import { hrefWith } from '@/components/Pager'
import type { AxhubMe } from '@/lib/axhub-server'
import { canEdit, daysBetween, formatDate, formatWon, isManager, paymentState } from '@/lib/payment'
import type { PaymentRow } from '@/lib/payment-store'

/**
 * 지급 건 목록. 한 줄 = 거래처 · 금액 · 상태(예정 / 지연 n일 / 지급 완료) · 예정일 · 메모,
 * 그 아래에 그 사람이 할 수 있는 버튼(PaymentActions)이 붙어요.
 * showVendor=false 는 한 거래처의 이력 화면 — 거래처 이름을 줄마다 다시 쓰지 않아요.
 */
export function PaymentList({
  rows,
  today,
  viewer,
  empty,
  showVendor = true,
}: {
  rows: PaymentRow[]
  today: string
  viewer: AxhubMe
  empty: string
  showVendor?: boolean
}) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>
  return (
    <ul className="list-none p-0">
      {rows.map((p) => {
        const state = paymentState(p, today)
        const summary = `${p.vendor} ${formatWon(p.amount)}`
        return (
          <li key={p.id} className="flex flex-col gap-3 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {showVendor && (
                  <Link href={hrefWith('/vendors', { v: p.vendor })} className="t-small break-words font-semibold hover:underline">
                    {p.vendor}
                  </Link>
                )}
                <p className={`t-caption ${showVendor ? 'mt-1' : ''}`}>
                  예정일 {formatDate(p.due_date, today)}
                  {p.created_by_name && ` · ${p.created_by_name}님 등록`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <p className="t-small font-semibold tabular-nums">{formatWon(p.amount)}</p>
                {state === 'paid' ? (
                  <StatusDot tone="active">지급 완료</StatusDot>
                ) : state === 'overdue' ? (
                  <StatusDot tone="failed">{daysBetween(p.due_date, today)}일 지연</StatusDot>
                ) : (
                  <StatusDot tone="warning">{p.due_date === today ? '오늘 지급' : '지급 예정'}</StatusDot>
                )}
              </div>
            </div>
            {p.memo && <p className="t-small break-words text-muted">{p.memo}</p>}
            {p.paid_date && (
              <p className="t-caption">
                {formatDate(p.paid_date, today)} 지급{p.paid_by && ` · ${p.paid_by}님 처리`}
              </p>
            )}
            <PaymentActions
              payment={{ id: p.id, vendor: p.vendor, amount: p.amount, due_date: p.due_date, memo: p.memo, paid: Boolean(p.paid_date) }}
              summary={summary}
              today={today}
              manager={isManager(viewer)}
              editable={canEdit(viewer, p.created_by_key)}
            />
          </li>
        )
      })}
    </ul>
  )
}
