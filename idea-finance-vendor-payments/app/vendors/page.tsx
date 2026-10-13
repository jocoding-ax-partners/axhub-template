import Link from 'next/link'
import { Card, Chip, EmptyState, buttonVariants } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, hrefWith, pageOf } from '@/components/Pager'
import { PaymentList } from '@/components/PaymentList'
import { SearchForm } from '@/components/SearchForm'
import { me, type AxhubMe } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { VENDOR_MAX, formatDate, formatWon, kstToday } from '@/lib/payment'
import { getVendor, listVendorHistory, listVendors } from '@/lib/payment-store'

export const dynamic = 'force-dynamic'

// 거래처 — 거래처별 합계 목록(?q= 검색, 30곳씩). ?v=거래처 로 들어오면 그 거래처의 지급 이력이에요.
export default async function VendorsPage({ searchParams }: { searchParams: Promise<{ v?: string; q?: string; page?: string }> }) {
  const params = await searchParams
  const vendor = (params.v ?? '').trim().slice(0, VENDOR_MAX)
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="거래처별 지급 이력" desc="axhub 계정으로 로그인하면 거래처마다 지급한 내역과 남은 금액을 볼 수 있어요." returnTo="/vendors" />
      </AppShell>
    )
  }
  const today = kstToday()
  return (
    <AppShell>
      {!isDbConfigured() ? (
        <div className="flex flex-col gap-10">
          <PageHeader title="거래처" />
          <DbNotice />
        </div>
      ) : vendor ? (
        <VendorHistory vendor={vendor} page={page} today={today} visitor={visitor} />
      ) : (
        <VendorList q={q} page={page} today={today} />
      )}
    </AppShell>
  )
}

async function VendorList({ q, page, today }: { q: string; page: number; today: string }) {
  const { rows, hasMore, total } = await listVendors(q, page, today)
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="거래처"
        description={q ? `"${q}" 로 찾은 거래처가 ${total}곳이에요.` : `지급 건이 있는 거래처 ${total}곳이에요. 거래처를 누르면 지급 이력을 볼 수 있어요.`}
      />
      <Card>
        <Card.Header>
          <SearchForm basePath="/vendors" q={q} placeholder="거래처 이름으로 찾기" />
        </Card.Header>
        <Card.Content>
          {rows.length === 0 ? (
            <EmptyState>
              {q ? '찾는 거래처가 없어요. 다른 글자로 찾아보세요.' : page > 1 ? '이 쪽에는 거래처가 없어요.' : '아직 등록한 지급 건이 없어요. 지급 일정에서 첫 건을 등록하면 여기에 거래처가 생겨요.'}
            </EmptyState>
          ) : (
            <ul className="list-none p-0">
              {rows.map((r) => (
                <li key={r.vendor} className="border-b border-default py-4 first:pt-0 last:border-0 last:pb-0">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <Link href={hrefWith('/vendors', { v: r.vendor })} className="t-small break-words font-semibold hover:underline">
                          {r.vendor}
                        </Link>
                        {r.overdue_count > 0 && (
                          <Chip size="sm" color="danger">
                            지연 {r.overdue_count}건
                          </Chip>
                        )}
                      </p>
                      <p className="t-caption mt-1">
                        {r.count}건
                        {r.last_paid_date && ` · 마지막 지급 ${formatDate(r.last_paid_date, today)}`}
                        {r.next_due_date && ` · 다음 예정 ${formatDate(r.next_due_date, today)}`}
                      </p>
                    </div>
                    <dl className="t-small flex shrink-0 gap-x-4 tabular-nums sm:text-right">
                      <div>
                        <dt className="t-caption">미지급</dt>
                        <dd className="font-semibold">{formatWon(r.unpaid_total)}</dd>
                      </div>
                      <div>
                        <dt className="t-caption">지급 완료</dt>
                        <dd>{formatWon(r.paid_total)}</dd>
                      </div>
                    </dl>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Pager basePath="/vendors" params={{ q: q || undefined }} page={page} hasNext={hasMore} />
        </Card.Content>
      </Card>
    </div>
  )
}

async function VendorHistory({ vendor, page, today, visitor }: { vendor: string; page: number; today: string; visitor: AxhubMe }) {
  const [summary, history] = await Promise.all([getVendor(vendor, today), listVendorHistory(vendor, page)])
  if (!summary) {
    return (
      <div className="flex flex-col gap-10">
        <PageHeader title={vendor} backTo="/vendors" backLabel="거래처" />
        <Card className="mx-auto w-full max-w-xl items-center text-center">
          <Card.Header className="items-center">
            <Card.Title>이 거래처의 지급 건이 없어요</Card.Title>
            <Card.Description>이름이 바뀌었거나 지급 건이 모두 지워졌어요.</Card.Description>
          </Card.Header>
          <Card.Footer>
            <Link className={buttonVariants({ variant: 'outline' })} href="/vendors">
              거래처 목록으로
            </Link>
          </Card.Footer>
        </Card>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-10">
      <PageHeader title={vendor} description={`지급 건 ${summary.count}건의 이력이에요.`} backTo="/vendors" backLabel="거래처" />
      <section aria-label={`${vendor} 요약`} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="미지급"
          value={<span className="text-primary tabular-nums">{formatWon(summary.unpaid_total)}</span>}
          sub={summary.unpaid_count > 0 ? `${summary.unpaid_count}건${summary.overdue_count > 0 ? ` · 그중 지연 ${summary.overdue_count}건` : ''}` : '남은 지급이 없어요'}
        />
        <StatCard label="지급 완료 합계" value={<span className="tabular-nums">{formatWon(summary.paid_total)}</span>} sub={`${summary.count - summary.unpaid_count}건`} />
        <StatCard
          label="마지막 지급일"
          value={summary.last_paid_date ? formatDate(summary.last_paid_date, today) : '없음'}
          sub={summary.next_due_date ? `다음 예정 ${formatDate(summary.next_due_date, today)}` : '예정된 지급이 없어요'}
        />
      </section>
      <Card>
        <Card.Header>
          <Card.Title>지급 이력</Card.Title>
          <Card.Description>지급일(아직 안 냈으면 예정일)이 늦은 순서예요.</Card.Description>
        </Card.Header>
        <Card.Content>
          <PaymentList rows={history.rows} today={today} viewer={visitor} showVendor={false} empty="이 쪽에는 지급 건이 없어요." />
          <Pager basePath="/vendors" params={{ v: vendor }} page={page} hasNext={history.hasMore} />
        </Card.Content>
      </Card>
    </div>
  )
}
