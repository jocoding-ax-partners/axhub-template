import Link from 'next/link'
import { Button, Card, Chip, EmptyState, Input, Label, Table, TextField, buttonVariants } from '@heroui/react'
import { CaretLeft, CaretRight, DownloadSimple } from '@phosphor-icons/react/ssr'
import { ActionForm } from '@/components/ActionForm'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { ConfirmButton } from '@/components/ConfirmButton'
import { ExpenseItem } from '@/components/ExpenseItem'
import { DbNotice, LoginNotice, Notice } from '@/components/Notice'
import { reviewExpense } from '@/app/actions'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { currentMonthKst, monthLabel, monthRange, shiftMonth, won } from '@/lib/expense-utils'
import { PAGE_SIZE, isAppAdmin, listMonthExpenses, monthCounts, personLabel, settlement, type Expense } from '@/lib/expenses'

export const dynamic = 'force-dynamic'

// 승인 · 정산 — 관리자만. 월을 골라 직원별 경비를 승인·반려하고, 정산표를 보고 CSV 로 내려받아요.
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ month?: string; page?: string }> }) {
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginNotice returnTo="/admin" />
      </AppShell>
    )
  }
  if (!isAppAdmin(visitor)) {
    return (
      <AppShell>
        <Notice
          title="관리자만 볼 수 있어요"
          desc="경비 승인과 정산은 이 앱의 관리자만 할 수 있어요. 권한이 필요하면 앱을 만든 분께 말해 주세요."
          action={
            <Link className={buttonVariants({ variant: 'outline' })} href="/">
              내 경비로 가기
            </Link>
          }
        />
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

  const params = await searchParams
  const requested = params.month ?? ''
  const thisMonth = currentMonthKst()
  const month = monthRange(requested) ? requested : thisMonth
  const range = monthRange(month)!
  const page = Math.min(Math.max(1, Math.floor(Number(params.page)) || 1), 10_000)

  const [{ rows: expenses, hasNext }, counts, summary] = await Promise.all([
    listMonthExpenses(range, page),
    monthCounts(range),
    settlement(range),
  ])

  // 직원별로 묶기 (쿼리가 이름순이라 순서가 유지돼요). 한 직원의 경비가 다음 쪽으로 이어질 수도 있어요.
  const byUser = new Map<string, Expense[]>()
  for (const e of expenses) byUser.set(e.user_id, [...(byUser.get(e.user_id) ?? []), e])
  const pendingCount = counts.pending
  const lastPage = Math.max(1, Math.ceil(counts.total / PAGE_SIZE))
  const pageHref = (p: number) => `/admin?month=${month}&page=${p}`
  const totalCount = summary.reduce((s, r) => s + r.count, 0)
  const total = summary.reduce((s, r) => s + r.total, 0)

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        {/* 월 이동은 제목 아래 줄에 — 좁은 화면에서 제목이 눌리지 않게요. */}
        <div className="flex flex-col gap-4">
          <PageHeader
            title="승인 · 정산"
            description={`${monthLabel(month)}에 쓴 경비예요.${pendingCount > 0 ? ` 확인을 기다리는 경비가 ${pendingCount}건 있어요.` : ''}`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`/admin?month=${shiftMonth(month, -1)}`} aria-label="지난달">
              <CaretLeft weight="fill" size={16} />
              지난달
            </Link>
            {/* 월 고르기 — 서버로 ?month= 를 보내는 평범한 GET 폼이에요. */}
            <form className="flex items-center gap-2">
              <TextField name="month" type="month" defaultValue={month} isRequired>
                <Label className="sr-only">정산월</Label>
                <Input className="w-40" max={thisMonth} />
              </TextField>
              <Button type="submit" variant="outline" size="sm">
                보기
              </Button>
            </form>
            {month < thisMonth && (
              <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`/admin?month=${shiftMonth(month, 1)}`} aria-label="다음 달">
                다음 달
                <CaretRight weight="fill" size={16} />
              </Link>
            )}
          </div>
        </div>

        <Card>
          <Card.Header className="flex-row flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Card.Title>{monthLabel(month)} 정산표</Card.Title>
              <Card.Description>승인된 경비만 더해요. 대기·반려 경비는 들어가지 않아요.</Card.Description>
            </div>
            {summary.length > 0 && (
              <a className={buttonVariants({ variant: 'primary', size: 'sm' })} href={`/admin/settlement.csv?month=${month}`} download>
                <DownloadSimple weight="fill" size={16} />
                CSV 내려받기
              </a>
            )}
          </Card.Header>
          <Card.Content>
            {summary.length === 0 ? (
              <EmptyState>이 달에 승인된 경비가 아직 없어요.</EmptyState>
            ) : (
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label={`${monthLabel(month)} 정산표`}>
                    <Table.Header>
                      <Table.Column isRowHeader>직원</Table.Column>
                      <Table.Column className="text-right">건수</Table.Column>
                      <Table.Column className="text-right">승인 금액</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {summary.map((r) => (
                        <Table.Row key={r.user_id} id={r.user_id}>
                          <Table.Cell>
                            <span className="block">{personLabel(r)}</span>
                            {r.user_name && <span className="t-caption block break-all text-subtle">{r.user_email}</span>}
                          </Table.Cell>
                          <Table.Cell className="text-right tabular-nums">{r.count}</Table.Cell>
                          <Table.Cell className="text-right tabular-nums">{won(r.total)}</Table.Cell>
                        </Table.Row>
                      ))}
                      <Table.Row id="__total" className="font-semibold">
                        <Table.Cell>합계</Table.Cell>
                        <Table.Cell className="text-right tabular-nums">{totalCount}</Table.Cell>
                        <Table.Cell className="text-right tabular-nums">{won(total)}</Table.Cell>
                      </Table.Row>
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            )}
          </Card.Content>
        </Card>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="t-section-title">직원별 경비</h2>
            {counts.total > 0 && (
              <p className="t-caption">
                전체 {counts.total}건 · {page}/{lastPage}쪽
              </p>
            )}
          </div>
          {byUser.size === 0 ? (
            <Card>
              <Card.Content>
                <EmptyState>이 달에 올라온 경비가 없어요.</EmptyState>
              </Card.Content>
            </Card>
          ) : (
            [...byUser.values()].map((rows) => (
              <Card key={rows[0].user_id}>
                <Card.Header className="flex-row flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <Card.Title>{personLabel(rows[0])}</Card.Title>
                    {rows[0].user_name && <Card.Description className="break-all">{rows[0].user_email}</Card.Description>}
                  </div>
                  <p className="t-caption">
                    {rows.length}건 · {won(rows.reduce((s, e) => s + e.amount, 0))}
                  </p>
                </Card.Header>
                <Card.Content>
                  <ul className="list-none p-0">
                    {rows.map((e) => (
                      <ExpenseItem
                        key={e.id}
                        expense={e}
                        actions={
                          // 본인 경비는 스스로 처리하지 않아요 (서버도 같은 규칙으로 막아요).
                          e.user_id === visitor.user_id ? (
                            <Chip size="sm" variant="soft">
                              본인 경비
                            </Chip>
                          ) : (
                            <ActionForm action={reviewExpense}>
                              <input type="hidden" name="id" value={e.id} />
                              <input type="hidden" name="from" value={e.status} />
                              {e.status !== 'approved' && (
                                <ConfirmButton
                                  variant="primary"
                                  name="status"
                                  value="approved"
                                  confirm={
                                    e.status === 'rejected'
                                      ? {
                                          title: '반려한 경비를 승인할까요?',
                                          description: '이미 반려한 경비예요. 승인으로 바꾸면 정산표에 더해져요.',
                                          confirmLabel: '승인',
                                          variant: 'warning',
                                        }
                                      : undefined
                                  }
                                >
                                  승인
                                </ConfirmButton>
                              )}
                              {e.status !== 'rejected' && (
                                <ConfirmButton
                                  danger
                                  name="status"
                                  value="rejected"
                                  confirm={
                                    e.status === 'approved'
                                      ? {
                                          title: '승인한 경비를 반려할까요?',
                                          description: '이미 승인한 경비예요. 반려하면 정산표에서 빠져요.',
                                          confirmLabel: '반려',
                                          variant: 'warning',
                                        }
                                      : { title: '이 경비를 반려할까요?', confirmLabel: '반려', variant: 'danger' }
                                  }
                                >
                                  반려
                                </ConfirmButton>
                              )}
                            </ActionForm>
                          )
                        }
                      />
                    ))}
                  </ul>
                </Card.Content>
              </Card>
            ))
          )}
          {(page > 1 || hasNext) && (
            <nav className="flex items-center justify-center gap-2" aria-label="쪽 이동">
              {page > 1 && (
                <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={pageHref(page - 1)}>
                  <CaretLeft weight="fill" size={16} />
                  이전
                </Link>
              )}
              {hasNext && (
                <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={pageHref(page + 1)}>
                  다음
                  <CaretRight weight="fill" size={16} />
                </Link>
              )}
            </nav>
          )}
        </section>
      </div>
    </AppShell>
  )
}
