import { Card, EmptyState } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatusDot } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { STATUS_LABEL, formatCount, formatDateTime, type RequestStatus } from '@/lib/supply'
import { listMyRequests, type MyRequest } from '@/lib/supply-store'

export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<RequestStatus, 'warning' | 'active' | 'muted'> = {
  pending: 'warning',
  issued: 'active',
  rejected: 'muted',
}

export default async function MyRequests({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageOf((await searchParams).page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="내 신청" desc="axhub 계정으로 로그인하면 내가 신청한 비품과 지급 상태를 볼 수 있어요." returnTo="/my" />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let rows: MyRequest[] = []
  let hasMore = false
  if (dbReady) ({ rows, hasMore } = await listMyRequests(visitor.user_id, page))

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="내 신청" description={`${visitor.name || visitor.email}님이 신청한 비품과 처리 상태예요.`} />

        {!dbReady && <DbNotice />}

        <Card>
          <Card.Header>
            <Card.Title>신청 목록</Card.Title>
            <Card.Description>최근에 신청한 순서로 보여요.</Card.Description>
          </Card.Header>
          <Card.Content>
            {rows.length === 0 ? (
              <EmptyState>{page > 1 ? '이 쪽에는 신청이 없어요.' : '아직 신청한 비품이 없어요. 비품 화면에서 필요한 비품을 신청해 보세요.'}</EmptyState>
            ) : (
              <ul className="list-none p-0">
                {rows.map((r) => (
                  <li key={r.id} className="flex flex-col gap-2 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="t-small font-semibold break-words">
                        {r.supply_name} <span className="text-muted">× {formatCount(r.qty)}</span>
                      </p>
                      {r.note && <p className="t-small mt-1 break-words text-muted">메모: {r.note}</p>}
                      {r.status === 'rejected' && r.reject_reason && <p className="t-small mt-1 break-words text-danger">반려 사유: {r.reject_reason}</p>}
                      <p className="t-caption mt-1">
                        {formatDateTime(r.created_at)} 신청
                        {r.decided_at && ` · ${formatDateTime(r.decided_at)} ${r.decided_by ?? ''}님이 처리`}
                      </p>
                    </div>
                    <StatusDot tone={STATUS_TONE[r.status]} className="shrink-0">
                      {STATUS_LABEL[r.status]}
                    </StatusDot>
                  </li>
                ))}
              </ul>
            )}
            <Pager basePath="/my" q="" page={page} hasNext={hasMore} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
