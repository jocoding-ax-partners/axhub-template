import Link from 'next/link'
import { Button, Card, Chip, EmptyState, Input, TextField } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, TabNav } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { STAGES, STAGE_LABEL, cleanQuery, formatShortDate, formatWon, isOverdue, kstToday, stageOf } from '@/lib/pipeline'
import { listDeals, type DealRow } from '@/lib/pipeline-store'

export const dynamic = 'force-dynamic'

/** 단계 탭 · 검색 · 쪽 이동이 서로의 값을 유지하도록 주소를 만들어요. */
function dealsHref(stage: string | null, q: string): string {
  const params = new URLSearchParams()
  if (stage) params.set('stage', stage)
  if (q) params.set('q', q)
  const qs = params.toString()
  return qs ? `/deals?${qs}` : '/deals'
}

// 거래 목록 — 보드 한 열에 다 안 들어가는 거래까지 전부, 최근에 바뀐 순으로 30개씩 봐요.
export default async function DealsPage({ searchParams }: { searchParams: Promise<{ q?: string; stage?: string; page?: string }> }) {
  const params = await searchParams
  const q = cleanQuery(params.q)
  const stage = stageOf(params.stage)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="거래 목록" desc="axhub 계정으로 로그인하면 팀의 거래를 찾아볼 수 있어요." returnTo="/deals" />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let rows: DealRow[] = []
  let hasMore = false
  let total = 0
  if (dbReady) ({ rows, hasMore, total } = await listDeals(q, stage, page))
  const today = kstToday()
  const scope = stage ? `${STAGE_LABEL[stage]} 단계` : '전체'

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="거래 목록" description={q ? `${scope}에서 "${q}" 로 찾은 거래가 ${total}건이에요.` : `${scope} 거래가 ${total}건이에요.`} />

        {!dbReady && <DbNotice />}

        <section className="flex flex-col gap-4">
          <TabNav
            tabs={[{ key: 'all', to: dealsHref(null, q), label: '전체' }, ...STAGES.map((s) => ({ key: s, to: dealsHref(s, q), label: STAGE_LABEL[s] }))]}
            activeKey={stage ?? 'all'}
            className="overflow-x-auto"
          />
          <form method="get" action="/deals" role="search" className="flex gap-2">
            {stage && <input type="hidden" name="stage" value={stage} />}
            <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="고객사 · 담당자 검색" className="flex-1">
              <Input placeholder="고객사 · 담당자로 찾기" />
            </TextField>
            <Button type="submit" variant="outline">
              찾기
            </Button>
          </form>

          <Card>
            <Card.Content>
              {rows.length === 0 ? (
                <EmptyState>
                  {q ? '찾는 거래가 없어요.' : page > 1 ? '이 쪽에는 거래가 없어요.' : '아직 거래가 없어요. 보드에서 「새 거래」 로 만들어 보세요.'}
                </EmptyState>
              ) : (
                <ul className="list-none p-0">
                  {rows.map((d) => {
                    const overdue = isOverdue(d.stage, d.expected_close, today)
                    return (
                      <li key={d.id} className="flex flex-col gap-1 border-b border-default py-3 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          <p className="t-small flex flex-wrap items-center gap-2">
                            <Chip size="sm">{STAGE_LABEL[d.stage]}</Chip>
                            <Link href={`/deals/${d.id}`} className="break-words font-semibold text-default hover:underline">
                              {d.company}
                            </Link>
                          </p>
                          <p className="t-caption mt-1">
                            담당 {d.owner}
                            {d.expected_close && (
                              <span className={overdue ? 'font-semibold text-danger' : undefined}>
                                {' · '}
                                {formatShortDate(d.expected_close, today)} {overdue ? '지남' : '계약 예정'}
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="t-small shrink-0 font-semibold tabular-nums">{formatWon(d.amount)}</p>
                      </li>
                    )
                  })}
                </ul>
              )}
              <Pager basePath="/deals" q={q} page={page} hasNext={hasMore} keep={stage ? { stage } : {}} />
            </Card.Content>
          </Card>
        </section>
      </div>
    </AppShell>
  )
}
