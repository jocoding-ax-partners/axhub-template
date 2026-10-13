import { Card, EmptyState } from '@heroui/react'
import { Trash } from '@phosphor-icons/react/ssr'
import { removeExpense } from '@/app/actions'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { ConfirmButton } from '@/components/ConfirmButton'
import { ExpenseForm } from '@/components/ExpenseForm'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { SearchForm } from '@/components/SearchForm'
import { YearNav } from '@/components/YearNav'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatDate, formatWon, isBudgetAdmin, kstToday, normalizeEmail, parseYear } from '@/lib/budget'
import { listEntryDepartments, listExpenses, type Department, type ExpenseRow } from '@/lib/budget-store'

export const dynamic = 'force-dynamic'

type Params = { year?: string; q?: string; page?: string }

// 집행 내역 — 로그인한 사람은 모두 볼 수 있고, 입력은 부서 담당자와 관리자만 해요.
export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const today = kstToday()
  const year = parseYear(params.year, Number(today.slice(0, 4)))
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="집행 내역" desc="axhub 계정으로 로그인하면 집행 건을 보고, 담당 부서의 집행 건을 넣을 수 있어요." returnTo="/expenses" />
      </AppShell>
    )
  }

  const admin = isBudgetAdmin(visitor)
  const dbReady = isDbConfigured()
  let departments: Department[] = []
  let rows: ExpenseRow[] = []
  let hasMore = false
  if (dbReady) {
    let found
    ;[departments, found] = await Promise.all([listEntryDepartments(normalizeEmail(visitor.email), admin), listExpenses(year, q, page)])
    ;({ rows, hasMore } = found)
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <PageHeader
            title="집행 내역"
            description="부서 담당자가 쓴 돈을 날짜 · 내용 · 금액으로 넣어요. 넣으면 바로 예산 현황에 반영돼요."
          />
          <YearNav basePath="/expenses" year={year} />
        </div>

        {!dbReady && <DbNotice />}

        <Card>
          <Card.Header>
            <Card.Title>집행 건 넣기</Card.Title>
            <Card.Description>
              {admin ? '관리자는 모든 부서의 집행 건을 넣을 수 있어요.' : '내가 담당자로 지정된 부서만 고를 수 있어요.'} 집행 날짜의 연도 예산에서 빠져요.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            {departments.length > 0 ? (
              <ExpenseForm departments={departments} today={today} />
            ) : (
              <EmptyState>
                {admin
                  ? '아직 부서가 없어요. 부서 · 예산 관리에서 부서를 먼저 만들어 주세요.'
                  : `담당 부서가 아직 없어요. 관리자에게 ${visitor.email || '내 이메일'} 을 부서 담당자로 지정해 달라고 해 주세요.`}
              </EmptyState>
            )}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>{year}년 집행 내역</Card.Title>
            <Card.Description>집행 날짜가 늦은 순서예요. 넣은 사람과 관리자만 지울 수 있어요.</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <SearchForm action="/expenses" year={year} q={q} placeholder="내용 · 부서 · 넣은 사람으로 찾기" />
            {rows.length === 0 ? (
              <EmptyState>
                {q ? `'${q}' 로 찾은 집행 건이 없어요.` : page > 1 ? '이 쪽에는 집행 건이 없어요.' : `${year}년 집행 건이 아직 없어요.`}
              </EmptyState>
            ) : (
              <ul className="list-none p-0">
                {rows.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0">
                    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                      <p className="t-small w-36 shrink-0 text-muted">{formatDate(r.spent_on)}</p>
                      <div className="min-w-0 flex-1">
                        <p className="t-small break-words font-semibold">{r.description}</p>
                        <p className="t-caption break-all">
                          {r.department} · {r.user_name || '이름 없음'}
                        </p>
                      </div>
                      <p className="t-small shrink-0 font-semibold tabular-nums sm:text-right">{formatWon(r.amount)}</p>
                    </div>
                    {(admin || r.user_key === visitor.user_id) && (
                      <ConfirmButton
                        action={removeExpense}
                        fields={{ id: r.id }}
                        title="이 집행 건을 지울까요?"
                        description={`${r.department} · ${r.description} · ${formatWon(r.amount)}. 지우면 예산 현황에서도 빠지고 되돌릴 수 없어요.`}
                        confirmLabel="지우기"
                        label="집행 건 지우기"
                      >
                        <Trash size={16} weight="fill" />
                      </ConfirmButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Pager basePath="/expenses" query={{ year: String(year), q }} page={page} hasNext={hasMore} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
