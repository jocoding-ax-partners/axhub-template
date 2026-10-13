import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, EmptyState, buttonVariants } from '@heroui/react'
import { Plus } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, hrefQuery, pageOf } from '@/components/Pager'
import { ShipmentList } from '@/components/ShipmentList'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { CUSTOMER_MAX, formatDate, kstToday, normalizeName } from '@/lib/shipment'
import { listCustomerHistory, type CustomerSummary, type Shipment } from '@/lib/shipment-store'

export const dynamic = 'force-dynamic'

/** 한 고객사의 발송 이력 (?name=고객사). 이름은 대소문자를 가리지 않고 같은 곳으로 봐요. */
export default async function CustomerHistoryPage({ searchParams }: { searchParams: Promise<{ name?: string; page?: string }> }) {
  const params = await searchParams
  const name = normalizeName(params.name ?? '').slice(0, CUSTOMER_MAX)
  if (!name) redirect('/customers')
  const page = pageOf(params.page)
  const self = `/customers/history?${hrefQuery({ name })}`
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title={name} desc="axhub 계정으로 로그인하면 이 고객사의 발송 이력을 볼 수 있어요." returnTo={self} />
      </AppShell>
    )
  }

  const today = kstToday()
  const dbReady = isDbConfigured()
  let rows: Shipment[] = []
  let hasMore = false
  let summary: CustomerSummary | null = null
  if (dbReady) ({ rows, hasMore, summary } = await listCustomerHistory(name, today, page))
  const title = summary?.name ?? name

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title={<span className="break-all">{title}</span>}
          description="이 고객사에 보낸 샘플·자료를 최근 것부터 보여요."
          backTo="/customers"
          backLabel="고객사"
          actions={
            <Link className={buttonVariants({ variant: 'primary' })} href={`/shipments/new?${hrefQuery({ customer: title })}`}>
              <Plus size={16} weight="fill" />
              이 고객사에 발송 기록
            </Link>
          }
        />

        {!dbReady && <DbNotice />}

        {summary && (
          <section aria-label="요약" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="보낸 횟수" value={`${summary.count}건`} sub={`처음 ${formatDate(summary.first_sent)}`} />
            <StatCard label="최근 보낸 날" value={formatDate(summary.last_sent)} />
            <StatCard
              label="남은 후속 연락"
              value={<span className={summary.due > 0 ? 'text-danger' : undefined}>{summary.open}건</span>}
              sub={summary.due > 0 ? `그중 ${summary.due}건은 연락할 때가 됐어요` : '완료하지 않은 연락이에요'}
            />
          </section>
        )}

        <Card>
          <Card.Header>
            <Card.Title>발송 이력</Card.Title>
          </Card.Header>
          <Card.Content>
            {rows.length === 0 ? (
              <EmptyState>{page > 1 ? '이 쪽에는 발송 기록이 없어요.' : '이 고객사에 보낸 기록이 없어요.'}</EmptyState>
            ) : (
              <ShipmentList rows={rows} today={today} visitor={visitor} showCustomer={false} />
            )}
            <Pager basePath="/customers/history" params={{ name }} page={page} hasNext={hasMore} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
