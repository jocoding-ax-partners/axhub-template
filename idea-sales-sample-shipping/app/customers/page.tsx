import Link from 'next/link'
import { Button, Card, Chip, EmptyState, Input, TextField } from '@heroui/react'
import { CaretRight } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { historyHref } from '@/components/ShipmentList'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatDate, kstToday } from '@/lib/shipment'
import { listCustomers, type CustomerSummary } from '@/lib/shipment-store'

export const dynamic = 'force-dynamic'

/** 고객사 — 발송한 적 있는 고객사를 최근 보낸 순으로. 이름으로 찾고, 누르면 발송 이력을 봐요. */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="고객사" desc="axhub 계정으로 로그인하면 고객사별 발송 이력을 볼 수 있어요." returnTo="/customers" />
      </AppShell>
    )
  }

  const today = kstToday()
  const dbReady = isDbConfigured()
  let rows: CustomerSummary[] = []
  let hasMore = false
  let total = 0
  if (dbReady) ({ rows, hasMore, total } = await listCustomers(q, today, page))

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="고객사"
          description={q ? `"${q}" 로 찾은 고객사가 ${total}곳이에요.` : `샘플·자료를 보낸 고객사가 ${total}곳 있어요. 눌러서 발송 이력을 보세요.`}
        />

        {!dbReady && <DbNotice />}

        <section className="flex flex-col gap-4">
          <form method="get" action="/customers" role="search" className="flex gap-2">
            <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="고객사 이름 검색" className="flex-1">
              <Input placeholder="고객사 이름으로 찾기" />
            </TextField>
            <Button type="submit" variant="outline">
              찾기
            </Button>
          </form>
          <Card>
            <Card.Content>
              {rows.length === 0 ? (
                <EmptyState>
                  {q
                    ? '찾는 고객사가 없어요. 이름 일부만 넣어 보세요.'
                    : page > 1
                      ? '이 쪽에는 고객사가 없어요.'
                      : '아직 발송 기록이 없어요. 발송을 기록하면 고객사가 여기에 모여요.'}
                </EmptyState>
              ) : (
                <ul className="list-none p-0">
                  {rows.map((c) => (
                    <li key={c.name} className="border-b border-default last:border-0">
                      <Link
                        href={historyHref(c.name)}
                        className="flex items-center justify-between gap-3 py-4 text-default hover:underline"
                      >
                        <span className="min-w-0">
                          <span className="t-small flex flex-wrap items-center gap-2">
                            <span className="break-all font-semibold">{c.name}</span>
                            {c.due > 0 && (
                              <Chip size="sm" color="danger">
                                연락할 때 {c.due}건
                              </Chip>
                            )}
                          </span>
                          <span className="t-caption mt-1 block">
                            발송 {c.count}건 · 최근 {formatDate(c.last_sent)}
                            {c.open > 0 && ` · 남은 연락 ${c.open}건`}
                          </span>
                        </span>
                        <CaretRight size={16} weight="fill" className="shrink-0 text-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Pager basePath="/customers" params={{ q }} page={page} hasNext={hasMore} />
            </Card.Content>
          </Card>
        </section>
      </div>
    </AppShell>
  )
}
