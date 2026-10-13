import Link from 'next/link'
import { Card, Chip, EmptyState, buttonVariants } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard, TabNav } from '@/components/ax'
import { DecisionForm } from '@/components/DecisionForm'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { Amount, HighValueChip, PurchaseItem, SearchForm } from '@/components/PurchaseItem'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { HIGH_VALUE_THRESHOLD, formatDateTime, isApprover, won } from '@/lib/purchase'
import { getPendingSummary, listForAdmin, type AdminView, type Page, type PendingSummary, type Purchase } from '@/lib/purchase-store'

export const dynamic = 'force-dynamic'

// 결재함 — 관리자(axhub 의 is_admin: 앱 소유자 · 워크스페이스 관리자)만 볼 수 있어요.
// 메뉴를 숨기는 것만으론 막히지 않으니, 화면과 Server Action(app/actions.ts) 양쪽에서 확인해요.
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; high?: string; q?: string; page?: string }>
}) {
  const params = await searchParams
  const view: AdminView = params.view === 'done' ? 'done' : 'pending'
  const highOnly = params.high === '1'
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="결재함" desc="관리자 계정으로 로그인하면 들어온 구매 요청을 승인하거나 반려할 수 있어요." returnTo="/admin" />
      </AppShell>
    )
  }
  if (!isApprover(visitor)) {
    return (
      <AppShell>
        <Card className="mx-auto w-full max-w-xl items-center text-center">
          <Card.Header className="items-center">
            <h1 className="t-card-title">관리자만 볼 수 있어요</h1>
            <Card.Description>구매 요청 승인·반려는 이 앱의 관리자만 할 수 있어요. 권한이 필요하면 앱 관리자에게 요청해 주세요.</Card.Description>
          </Card.Header>
        </Card>
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let summary: PendingSummary = { count: 0, high: 0, amount: 0 }
  let list: Page<Purchase> = { rows: [], hasMore: false, total: 0 }
  if (dbReady) {
    ;[summary, list] = await Promise.all([getPendingSummary(), listForAdmin(view, q, highOnly, page)])
  }

  const filters = { view: view === 'done' ? 'done' : '', high: highOnly ? '1' : '' }
  const hrefWith = (next: Partial<typeof filters>) => {
    const qs = new URLSearchParams(Object.entries({ ...filters, q, ...next }).filter(([, v]) => v)).toString()
    return qs ? `/admin?${qs}` : '/admin'
  }
  const label = view === 'pending' ? '대기 요청' : '처리한 요청'

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="결재함"
          description={summary.count > 0 ? `처리를 기다리는 구매 요청이 ${summary.count}건 있어요.` : '처리를 기다리는 구매 요청이 없어요.'}
        />

        {!dbReady && <DbNotice />}

        <section aria-label="결재 대기 요약" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="결재 대기" value={<span className="text-primary">{summary.count}건</span>} sub="먼저 올라온 요청부터 보여요" />
          <StatCard label="그중 고액" value={`${summary.high}건`} sub={`총액 ${won(HIGH_VALUE_THRESHOLD)} 이상`} />
          <StatCard label="대기 금액 합계" value={won(summary.amount)} sub="승인되기 전 금액이에요" />
        </section>

        <Card>
          <Card.Header className="gap-3">
            <TabNav
              activeKey={view}
              tabs={[
                { key: 'pending', to: hrefWith({ view: '' }), label: '결재 대기', badge: summary.count },
                { key: 'done', to: hrefWith({ view: 'done' }), label: '처리 완료' },
              ]}
            />
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex-1">
                <SearchForm action="/admin" q={q} label="품목 · 요청자 이름 · 이메일로 찾기" hidden={filters} />
              </div>
              <Link
                className={buttonVariants({ variant: highOnly ? 'primary' : 'outline' })}
                href={hrefWith({ high: highOnly ? '' : '1' })}
                aria-pressed={highOnly}
              >
                고액만 보기
              </Link>
            </div>
            {(q || highOnly) && (
              <p className="t-small text-muted">
                {[q && `"${q}"`, highOnly && '고액'].filter(Boolean).join(' · ')} 조건으로 찾은 {label}이 {list.total}건이에요.
              </p>
            )}

            {list.rows.length === 0 ? (
              <EmptyState>
                {q || highOnly
                  ? `조건에 맞는 ${label}이 없어요.`
                  : page > 1
                    ? '이 쪽에는 요청이 없어요.'
                    : view === 'pending'
                      ? '새 구매 요청이 들어오면 여기에 보여요.'
                      : '아직 처리한 요청이 없어요.'}
              </EmptyState>
            ) : view === 'done' ? (
              <ul className="list-none p-0">
                {list.rows.map((r) => (
                  <PurchaseItem key={r.id} row={r} showRequester />
                ))}
              </ul>
            ) : (
              <div className="flex flex-col gap-4">
                {list.rows.map((r) => (
                  <Card key={r.id} variant="secondary">
                    <Card.Header>
                      <Card.Title className="flex flex-wrap items-center gap-2 break-all">
                        {r.item}
                        <HighValueChip total={r.total} />
                      </Card.Title>
                      <Card.Description className="break-all">
                        {r.user_name || r.user_email}
                        {r.user_name && r.user_email && ` · ${r.user_email}`}
                      </Card.Description>
                    </Card.Header>
                    <Card.Content className="flex flex-col gap-1">
                      <p className="t-small">
                        <Amount row={r} />
                      </p>
                      <p className="t-small break-words text-muted">사유: {r.reason}</p>
                      <p className="t-caption">{formatDateTime(r.created_at)} 요청</p>
                    </Card.Content>
                    <Card.Footer className="flex-col items-stretch">
                      {r.user_key === visitor.user_id ? (
                        <p className="t-small flex flex-wrap items-center gap-2 text-muted">
                          <Chip size="sm" color="warning">
                            본인 요청
                          </Chip>
                          본인 요청은 다른 관리자가 처리해야 해요.
                        </p>
                      ) : (
                        <DecisionForm id={r.id} summary={`${r.user_name || r.user_email}님의 「${r.item}」 요청`} />
                      )}
                    </Card.Footer>
                  </Card>
                ))}
              </div>
            )}
            <Pager basePath="/admin" params={{ ...filters, q }} page={page} hasNext={list.hasMore} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
