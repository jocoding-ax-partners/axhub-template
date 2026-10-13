import Link from 'next/link'
import { Card, EmptyState, Meter, buttonVariants } from '@heroui/react'
import { DownloadSimple } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard } from '@/components/ax'
import { ExpenseList, MonthNav, SearchForm } from '@/components/ExpenseList'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, hrefWith, pageOf } from '@/components/Pager'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatMonth, formatWon, isAdmin, kstToday, parseMonth } from '@/lib/card'
import { listAll, monthSummary, type ExpenseRow, type MonthSummary } from '@/lib/card-store'

export const dynamic = 'force-dynamic'

type Search = { month?: string; q?: string; missing?: string; page?: string }

// 월별 합계 — 관리자(axhub 의 is_admin: 앱 소유자 · 워크스페이스 관리자)만 볼 수 있어요.
// 메뉴를 숨기는 것만으론 막히지 않으니, 화면과 CSV 내려받기(summary/export) 양쪽에서 확인해요.
export default async function SummaryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams
  const thisMonth = kstToday().slice(0, 7)
  const month = parseMonth(params.month) ?? thisMonth
  const missingOnly = params.missing === '1'
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)

  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="월별 합계" desc="관리자 계정으로 로그인하면 부서별 사용 합계를 볼 수 있어요." returnTo="/summary" />
      </AppShell>
    )
  }
  if (!isAdmin(visitor)) {
    return (
      <AppShell>
        <Card className="mx-auto w-full max-w-xl items-center text-center">
          <Card.Header className="items-center">
            <h1 className="t-card-title">관리자만 볼 수 있어요</h1>
            <Card.Description>
              모든 사람의 사용 내역과 부서별 합계는 이 앱의 관리자만 볼 수 있어요. 내 사용 건은 「내 사용 내역」 에서 볼 수 있어요.
            </Card.Description>
          </Card.Header>
        </Card>
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let summary: MonthSummary = { departments: [], count: 0, total: 0, missing: 0 }
  let rows: ExpenseRow[] = []
  let hasMore = false
  let found = 0
  if (dbReady) {
    let list
    ;[summary, list] = await Promise.all([monthSummary(month), listAll({ month, q, missingOnly, page })])
    ;({ rows, hasMore, total: found } = list)
  }

  const label = formatMonth(month)
  const monthKeep = { month: month !== thisMonth ? month : undefined }
  const keep = { ...monthKeep, missing: missingOnly ? '1' : undefined }
  const tab = (active: boolean) => buttonVariants({ variant: active ? 'primary' : 'outline', size: 'sm' })

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="월별 합계"
          description="월을 고르면 부서별 사용 합계와 전체 합계를 보여 줘요. 사용일 기준이에요."
          actions={
            dbReady && summary.count > 0 ? (
              <a className={buttonVariants({ variant: 'outline' })} href={`/summary/export?month=${month}`} download>
                <DownloadSimple size={16} weight="fill" />
                CSV 내려받기
              </a>
            ) : undefined
          }
        />

        {!dbReady && <DbNotice />}

        <MonthNav basePath="/summary" month={month} thisMonth={thisMonth} />

        <section aria-label={`${label} 합계`} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label={`${label} 전체 합계`} value={<span className="text-primary">{formatWon(summary.total)}</span>} sub={`${summary.count}건`} />
          <StatCard label="부서 수" value={`${summary.departments.length}개`} sub="이 달에 카드를 쓴 부서" />
          <StatCard
            label="용도 미기재"
            value={<span className={summary.missing > 0 ? 'text-warning' : undefined}>{summary.missing}건</span>}
            sub="입력한 사람이 채워야 해요"
          />
        </section>

        <Card>
          <Card.Header>
            <Card.Title>부서별 합계</Card.Title>
            <Card.Description>금액이 큰 부서부터 보여요.</Card.Description>
          </Card.Header>
          <Card.Content>
            {summary.departments.length === 0 ? (
              <EmptyState>{label}에 입력된 사용 건이 없어요.</EmptyState>
            ) : (
              <ul className="list-none p-0">
                {summary.departments.map((d) => (
                  <li key={d.department} className="flex flex-col gap-2 border-b border-default py-3 first:pt-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="t-small min-w-0 break-words font-semibold">{d.department}</p>
                      <p className="t-small shrink-0 font-semibold tabular-nums">{formatWon(d.total)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* 전체 합계에서 차지하는 비율 막대 */}
                      <Meter aria-label={`${d.department} 비율`} value={(d.total / summary.total) * 100} size="sm" className="flex-1">
                        <Meter.Track>
                          <Meter.Fill />
                        </Meter.Track>
                      </Meter>
                      <p className="t-caption shrink-0">
                        {Math.round((d.total / summary.total) * 100)}% · {d.count}건{d.missing > 0 && ` · 미기재 ${d.missing}`}
                      </p>
                    </div>
                  </li>
                ))}
                <li className="flex items-baseline justify-between gap-3 pt-3">
                  <p className="t-small font-semibold">전체 합계</p>
                  <p className="t-small font-semibold tabular-nums text-primary">{formatWon(summary.total)}</p>
                </li>
              </ul>
            )}
          </Card.Content>
        </Card>

        <section className="flex flex-col gap-4" aria-label={`${label} 사용 건`}>
          <h2 className="t-section-title">{label} 사용 건</h2>
          <div className="flex flex-wrap gap-2">
            <Link className={tab(!missingOnly)} href={hrefWith('/summary', { ...monthKeep, q: q || undefined })}>
              전체
            </Link>
            <Link className={tab(missingOnly)} href={hrefWith('/summary', { ...monthKeep, q: q || undefined, missing: '1' })}>
              용도 미기재만
            </Link>
          </div>
          <SearchForm basePath="/summary" q={q} keep={keep} placeholder="가맹점 · 부서 · 용도 · 입력한 사람으로 찾기" />
          <Card>
            <Card.Content>
              {(q || missingOnly) && <p className="t-caption mb-3">조건에 맞는 사용 건이 {found}건이에요.</p>}
              <ExpenseList
                rows={rows}
                viewerKey={visitor.user_id}
                showOwner
                empty={
                  q || missingOnly
                    ? '조건에 맞는 사용 건이 없어요.'
                    : page > 1
                      ? '이 쪽에는 사용 건이 없어요.'
                      : `${label}에 입력된 사용 건이 없어요.`
                }
              />
              <Pager basePath="/summary" params={{ ...keep, q: q || undefined }} page={page} hasNext={hasMore} />
            </Card.Content>
          </Card>
        </section>
      </div>
    </AppShell>
  )
}
