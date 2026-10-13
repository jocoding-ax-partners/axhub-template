import { Button, Card, Chip, EmptyState, Input, TextField } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { ContractForm } from '@/components/ContractForm'
import { DeleteContractButton } from '@/components/DeleteContractButton'
import { MonthNav } from '@/components/MonthNav'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { canDelete, formatDate, formatMonth, kstToday, monthOf, won } from '@/lib/sales'
import { listContracts, type ContractRow } from '@/lib/sales-store'

export const dynamic = 'force-dynamic'

// 계약 입력과 고른 달의 계약 목록. 누구나 넣을 수 있고, 지우기는 넣은 본인이나 관리자만 돼요.
export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ month?: string; q?: string; page?: string }> }) {
  const params = await searchParams
  const month = monthOf(params.month)
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="계약 입력" desc="axhub 계정으로 로그인하면 계약을 넣고 목록을 볼 수 있어요." returnTo="/contracts" />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let rows: ContractRow[] = []
  let hasMore = false
  let total = 0
  if (dbReady) ({ rows, hasMore, total } = await listContracts(month, q, page))

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="계약 입력" description="계약일 · 고객사 · 금액을 넣으면 그 달 월간 실적에 바로 더해져요." />

        {!dbReady && <DbNotice />}

        <Card>
          <Card.Header>
            <Card.Title>새 계약</Card.Title>
            <Card.Description>담당자는 지금 로그인한 사람으로 저장돼요. 잘못 넣었으면 아래 목록에서 지우고 다시 넣어요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <ContractForm today={kstToday()} repName={visitor.name || visitor.email} />
          </Card.Content>
        </Card>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="t-section-title">계약 목록</h2>
            <p className="t-small text-muted">
              {q ? `${formatMonth(month)}에서 "${q}" 로 찾은 계약이 ${total}건이에요.` : `${formatMonth(month)}에 넣은 계약이 ${total}건이에요. 계약일이 늦은 순서로 보여요.`}
            </p>
          </div>
          <MonthNav basePath="/contracts" month={month} />
          <form method="get" action="/contracts" role="search" className="flex gap-2">
            <input type="hidden" name="month" value={month} />
            <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="고객사 · 담당자 검색" className="flex-1">
              <Input placeholder="고객사나 담당자 이름으로 찾기" />
            </TextField>
            <Button type="submit" variant="outline">
              찾기
            </Button>
          </form>

          <Card>
            <Card.Content>
              {rows.length === 0 ? (
                <EmptyState>
                  {q ? '찾는 계약이 없어요. 다른 글자로 찾아보세요.' : page > 1 ? '이 쪽에는 계약이 없어요.' : '이 달에 넣은 계약이 없어요. 위에서 첫 계약을 넣어 보세요.'}
                </EmptyState>
              ) : (
                <ul className="list-none p-0">
                  {rows.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-col gap-2 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="t-small flex flex-wrap items-center gap-x-2 font-semibold break-all">
                          {r.customer}
                          <span className="tabular-nums">{won(r.amount)}</span>
                        </p>
                        <p className="t-caption mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>{formatDate(r.contract_date)}</span>
                          <span>· 담당 {r.user_name || r.user_email}</span>
                          {r.user_key === visitor.user_id && <Chip size="sm">내 계약</Chip>}
                        </p>
                      </div>
                      {canDelete(visitor, r.user_key) && (
                        <DeleteContractButton id={r.id} summary={`${formatDate(r.contract_date)} ${r.customer} ${won(r.amount)}`} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Pager basePath="/contracts" params={q ? { month, q } : { month }} page={page} hasNext={hasMore} />
            </Card.Content>
          </Card>
        </section>
      </div>
    </AppShell>
  )
}
