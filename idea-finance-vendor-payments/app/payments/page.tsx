import { Card } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, TabNav } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, hrefWith, pageOf } from '@/components/Pager'
import { PaymentForm } from '@/components/PaymentForm'
import { PaymentList } from '@/components/PaymentList'
import { SearchForm } from '@/components/SearchForm'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { FILTER_LABEL, filterOf, kstToday, type PaymentFilter } from '@/lib/payment'
import { listPayments, listVendorNames, type PaymentRow } from '@/lib/payment-store'

export const dynamic = 'force-dynamic'

const EMPTY: Record<PaymentFilter, string> = {
  unpaid: '아직 지급하지 않은 건이 없어요.',
  overdue: '밀린 지급이 없어요.',
  paid: '지급 완료한 건이 아직 없어요.',
  all: '아직 등록한 지급 건이 없어요. 위에서 첫 지급 건을 등록해 보세요.',
}

// 지급 일정 — 지급 건 등록 + 전체 목록(미지급 · 지연 · 완료 · 전체, 거래처·메모 검색, 30건씩).
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string; page?: string }> }) {
  const params = await searchParams
  const filter = filterOf(params.filter)
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="지급 일정" desc="axhub 계정으로 로그인하면 지급 건을 등록하고 전체 일정을 볼 수 있어요." returnTo="/payments" />
      </AppShell>
    )
  }

  const today = kstToday()
  const dbReady = isDbConfigured()
  let rows: PaymentRow[] = []
  let hasMore = false
  let total = 0
  let vendors: string[] = []
  if (dbReady) {
    let found
    ;[found, vendors] = await Promise.all([listPayments(filter, q, page, today), listVendorNames()])
    ;({ rows, hasMore, total } = found)
  }
  const keep = { filter: filter === 'unpaid' ? undefined : filter, q: q || undefined }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="지급 일정" description="지급 건을 등록하고, 미지급 · 지연 · 지급 완료 건을 거래처나 메모로 찾아봐요." />

        {!dbReady && <DbNotice />}

        <Card id="new" className="scroll-mt-24">
          <Card.Header>
            <Card.Title>지급 건 등록</Card.Title>
            <Card.Description>거래처 · 금액 · 지급 예정일을 적어요. 등록한 건은 팀 모두가 함께 봐요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <PaymentForm vendors={vendors} today={today} />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="gap-4">
            <TabNav
              activeKey={filter}
              tabs={(Object.keys(FILTER_LABEL) as PaymentFilter[]).map((f) => ({
                key: f,
                to: hrefWith('/payments', { filter: f === 'unpaid' ? undefined : f, q: q || undefined }),
                label: FILTER_LABEL[f],
              }))}
            />
            <SearchForm basePath="/payments" q={q} keep={{ filter: keep.filter }} placeholder="거래처 · 메모로 찾기" />
            <p className="t-small text-muted" role="status">
              {q ? `"${q}" 로 찾은 ${FILTER_LABEL[filter]} 건이 ${total}건이에요.` : `${FILTER_LABEL[filter]} ${total}건`}
            </p>
          </Card.Header>
          <Card.Content>
            <PaymentList
              rows={rows}
              today={today}
              viewer={visitor}
              empty={q ? '찾는 지급 건이 없어요. 다른 글자로 찾아보세요.' : page > 1 ? '이 쪽에는 지급 건이 없어요.' : EMPTY[filter]}
            />
            <Pager basePath="/payments" params={keep} page={page} hasNext={hasMore} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
