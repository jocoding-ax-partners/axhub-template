import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { Card } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatusDot } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { DeleteShipmentButton, FollowUpButton } from '@/components/ShipmentButtons'
import { ShipmentForm } from '@/components/ShipmentForm'
import { followUpTone, historyHref } from '@/components/ShipmentList'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { canManage, followUpLabel, followUpState, formatDate, formatDateTime, kstToday } from '@/lib/shipment'
import { getShipment, listCustomerNames } from '@/lib/shipment-store'

export const dynamic = 'force-dynamic'

/** 발송 한 건 — 내용 보기. 기록한 사람과 관리자는 여기서 고치고 지워요. */
export default async function ShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d{1,18}$/.test(id)) notFound()
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="발송 기록" desc="axhub 계정으로 로그인하면 발송 기록을 볼 수 있어요." returnTo={`/shipments/${id}`} />
      </AppShell>
    )
  }
  if (!isDbConfigured()) {
    return (
      <AppShell>
        <DbNotice />
      </AppShell>
    )
  }

  const row = await getShipment(id)
  if (!row) notFound()
  const today = kstToday()
  const manage = canManage(visitor, row.created_by)
  const state = followUpState(row.follow_up_on, row.done, today)
  const customers = manage ? await listCustomerNames() : []

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title={<span className="break-all">{row.customer}</span>}
          description={`${formatDate(row.sent_on)}에 보낸 발송 기록이에요.`}
          backTo="/shipments"
          backLabel="발송 기록"
        />

        <Card>
          <Card.Header>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Card.Title>발송 내용</Card.Title>
              {state !== 'none' && (
                <StatusDot tone={followUpTone(state)}>
                  {followUpLabel(row.follow_up_on, row.done, today)}
                </StatusDot>
              )}
            </div>
          </Card.Header>
          <Card.Content>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-[8rem_1fr]">
              <Item label="받는 고객사">
                <Link href={historyHref(row.customer)} className="break-all font-semibold text-default hover:underline">
                  {row.customer}
                </Link>
              </Item>
              <Item label="받는 담당자">{row.contact || <span className="text-muted">적지 않았어요</span>}</Item>
              <Item label="보낸 것">{row.items}</Item>
              <Item label="보낸 날">{formatDate(row.sent_on)}</Item>
              <Item label="후속 연락 예정일">
                {row.follow_up_on ? formatDate(row.follow_up_on) : <span className="text-muted">잡지 않았어요</span>}
                {row.done && row.done_at && (
                  <span className="t-caption block">
                    {formatDateTime(row.done_at)} {row.done_by ?? ''}님이 연락 완료로 표시
                  </span>
                )}
              </Item>
              <Item label="메모">{row.memo ? <span className="whitespace-pre-wrap">{row.memo}</span> : <span className="text-muted">없어요</span>}</Item>
              <Item label="기록">
                {row.created_by_name || '알 수 없음'} · {formatDateTime(row.created_at)}
                {row.updated_at && <span className="t-caption block">{formatDateTime(row.updated_at)}에 고침</span>}
              </Item>
            </dl>
          </Card.Content>
          {manage && state !== 'none' && (
            <Card.Footer>
              <FollowUpButton id={row.id} done={row.done} />
            </Card.Footer>
          )}
        </Card>

        {manage ? (
          <>
            <Card>
              <Card.Header>
                <Card.Title>고치기</Card.Title>
                <Card.Description>후속 연락 예정일을 바꾸면 연락 완료 표시가 풀려요. 새로 잡은 연락은 아직 안 한 거라서요.</Card.Description>
              </Card.Header>
              <Card.Content>
                <ShipmentForm
                  today={today}
                  customers={customers}
                  draft={{
                    id: row.id,
                    customer: row.customer,
                    contact: row.contact,
                    items: row.items,
                    sent_on: row.sent_on,
                    follow_up_on: row.follow_up_on,
                    memo: row.memo,
                  }}
                />
              </Card.Content>
            </Card>
            <Card>
              <Card.Header>
                <Card.Title>지우기</Card.Title>
                <Card.Description>잘못 기록한 건만 지워요. 지운 기록은 되돌릴 수 없어요.</Card.Description>
              </Card.Header>
              <Card.Footer>
                <DeleteShipmentButton id={row.id} summary={row.customer} />
              </Card.Footer>
            </Card>
          </>
        ) : (
          <p className="t-small text-muted">이 기록은 {row.created_by_name || '기록한 사람'}님이나 관리자만 고칠 수 있어요.</p>
        )}
      </div>
    </AppShell>
  )
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="t-small text-muted">{label}</dt>
      <dd className="t-small -mt-3 break-words sm:mt-0">{children}</dd>
    </div>
  )
}
