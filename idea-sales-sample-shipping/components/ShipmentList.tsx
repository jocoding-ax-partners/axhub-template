import Link from 'next/link'
import { buttonVariants } from '@heroui/react'
import { StatusDot, TabNav } from '@/components/ax'
import { FollowUpButton } from '@/components/ShipmentButtons'
import { hrefQuery } from '@/components/Pager'
import type { AxhubMe } from '@/lib/axhub-server'
import { canManage, followUpLabel, followUpState, formatDate, type FollowUpState } from '@/lib/shipment'
import type { Shipment } from '@/lib/shipment-store'

/** 후속 연락 상태 점 색 — 지남 빨강 · 오늘 노랑 · 완료 초록 · 예정 기본. */
export const followUpTone = (state: FollowUpState) =>
  state === 'overdue' ? 'failed' : state === 'today' ? 'warning' : state === 'done' ? 'active' : undefined

/** 고객사 발송 이력 주소. 이름에 / ? & 가 있어도 안전하게 query 로 넘겨요. */
export const historyHref = (name: string) => `/customers/history?${hrefQuery({ name })}`

/**
 * 발송 기록 목록. 고객사 이름을 누르면 그 고객사의 이력으로 가요.
 * "완료" 버튼은 기록한 사람과 관리자에게만 보여요 (서버에서도 다시 확인해요).
 */
export function ShipmentList({
  rows,
  today,
  visitor,
  showCustomer = true,
}: {
  rows: Shipment[]
  today: string
  visitor: AxhubMe
  showCustomer?: boolean
}) {
  return (
    <ul className="list-none p-0">
      {rows.map((s) => {
        const state = followUpState(s.follow_up_on, s.done, today)
        return (
          <li
            key={s.id}
            className="flex flex-col gap-3 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              {(showCustomer || s.contact) && (
              <p className="t-small flex flex-wrap items-center gap-x-2 gap-y-1">
                {showCustomer && (
                  <Link href={historyHref(s.customer)} className="break-all font-semibold text-default hover:underline">
                    {s.customer}
                  </Link>
                )}
                {s.contact && <span className="break-all text-muted">{s.contact}</span>}
              </p>
              )}
              <p className={`t-small break-words ${showCustomer || s.contact ? 'mt-1' : ''}`}>{s.items}</p>
              {s.memo && <p className="t-caption mt-1 line-clamp-3 whitespace-pre-wrap break-words">{s.memo}</p>}
              <p className="t-caption mt-1">
                {formatDate(s.sent_on)} 보냄{s.created_by_name && ` · ${s.created_by_name}`}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
              {state !== 'none' && (
                <StatusDot tone={followUpTone(state)}>
                  {followUpLabel(s.follow_up_on, s.done, today)}
                </StatusDot>
              )}
              <div className="flex flex-wrap gap-2">
                {state !== 'none' && canManage(visitor, s.created_by) && <FollowUpButton id={s.id} done={s.done} />}
                <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} href={`/shipments/${s.id}`}>
                  자세히
                </Link>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** 전체 / 내가 기록한 건 탭. 검색어(q)는 그대로 유지해요. */
export function ScopeTabs({ basePath, mine, q = '' }: { basePath: string; mine: boolean; q?: string }) {
  const to = (m: boolean) => {
    const qs = hrefQuery({ q, mine: m ? '1' : '' })
    return qs ? `${basePath}?${qs}` : basePath
  }
  return (
    <TabNav
      activeKey={mine ? 'mine' : 'all'}
      tabs={[
        { key: 'all', to: to(false), label: '팀 전체' },
        { key: 'mine', to: to(true), label: '내가 기록한 건' },
      ]}
    />
  )
}
