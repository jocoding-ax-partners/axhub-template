import { Card, Chip, EmptyState, Input, Label, TextField } from '@heroui/react'
import { Plus, Trash, X } from '@phosphor-icons/react/ssr'
import { addDepartment, addManager, removeDepartment, removeManager, setBudget } from '@/app/actions'
import { ActionForm } from '@/components/ActionForm'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { ConfirmButton } from '@/components/ConfirmButton'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { SearchForm } from '@/components/SearchForm'
import { YearNav } from '@/components/YearNav'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { DEPT_NAME_MAX, EMAIL_MAX, formatRate, formatWon, isBudgetAdmin, isWarn, kstToday, parseYear, usageRate } from '@/lib/budget'
import { listAdminDepartments, type AdminDept } from '@/lib/budget-store'

export const dynamic = 'force-dynamic'

type Params = { year?: string; q?: string; page?: string }

// 부서 · 예산 관리 — 관리자(axhub 의 is_admin: 앱 소유자 · 워크스페이스 관리자)만 볼 수 있어요.
// 메뉴를 숨기는 것만으론 막히지 않으니, 화면과 Server Action(app/actions.ts) 양쪽에서 확인해요.
export default async function AdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const year = parseYear(params.year, Number(kstToday().slice(0, 4)))
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="부서 · 예산 관리" desc="관리자 계정으로 로그인하면 부서와 연간 예산, 부서 담당자를 관리할 수 있어요." returnTo="/admin" />
      </AppShell>
    )
  }
  if (!isBudgetAdmin(visitor)) {
    return (
      <AppShell>
        <Card className="mx-auto w-full max-w-xl items-center text-center">
          <Card.Header className="items-center">
            <h1 className="t-card-title">관리자만 볼 수 있어요</h1>
            <Card.Description>부서 예산 등록은 이 앱의 관리자만 할 수 있어요. 권한이 필요하면 앱 관리자에게 요청해 주세요.</Card.Description>
          </Card.Header>
        </Card>
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let rows: AdminDept[] = []
  let hasMore = false
  if (dbReady) ({ rows, hasMore } = await listAdminDepartments(year, q, page))

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <PageHeader
            title="부서 · 예산 관리"
            description="부서를 만들고 연간 예산을 등록해요. 부서 담당자로 지정한 사람이 그 부서의 집행 건을 넣어요."
          />
          <YearNav basePath="/admin" year={year} />
        </div>

        {!dbReady && <DbNotice />}

        <Card>
          <Card.Header>
            <Card.Title>부서 추가</Card.Title>
            <Card.Description>부서 이름은 겹칠 수 없어요. 만든 뒤 아래에서 예산과 담당자를 정해요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <ActionForm action={addDepartment} submitLabel="부서 추가" icon={<Plus size={16} weight="fill" />}>
              <TextField name="name" isRequired maxLength={DEPT_NAME_MAX} className="min-w-0 flex-1">
                <Label>부서 이름</Label>
                <Input placeholder="예: 재무팀" />
              </TextField>
            </ActionForm>
          </Card.Content>
        </Card>

        <section className="flex flex-col gap-4">
          <h2 className="t-section-title">{year}년 부서별 예산</h2>
          <SearchForm action="/admin" year={year} q={q} placeholder="부서 이름으로 찾기" />
          {rows.length === 0 ? (
            <Card>
              <Card.Content>
                <EmptyState>
                  {q ? `'${q}' 가 들어간 부서가 없어요.` : page > 1 ? '이 쪽에는 부서가 없어요.' : '아직 부서가 없어요. 위에서 첫 부서를 추가해 보세요.'}
                </EmptyState>
              </Card.Content>
            </Card>
          ) : (
            rows.map((d) => <DepartmentCard key={d.id} d={d} year={year} />)
          )}
          <Pager basePath="/admin" query={{ year: String(year), q }} page={page} hasNext={hasMore} />
        </section>
      </div>
    </AppShell>
  )
}

function DepartmentCard({ d, year }: { d: AdminDept; year: number }) {
  const warn = d.budget !== null && isWarn(d.budget, d.spent)
  return (
    <Card>
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Card.Title className="flex min-w-0 flex-wrap items-center gap-2 break-all">
            {d.name}
            {warn && <Chip size="sm" color="danger">주의</Chip>}
          </Card.Title>
          <ConfirmButton
            action={removeDepartment}
            fields={{ id: d.id }}
            title={`'${d.name}' 부서를 지울까요?`}
            description="모든 연도의 예산과 담당자 지정이 함께 지워지고 되돌릴 수 없어요. 집행 건이 남아 있으면 지워지지 않아요."
            confirmLabel="지우기"
          >
            <Trash size={16} weight="fill" />
            부서 지우기
          </ConfirmButton>
        </div>
        <Card.Description className={warn ? 'text-danger' : undefined}>
          {d.budget === null
            ? `${year}년 예산이 아직 없어요. 예산을 등록해야 이 해의 집행 건을 넣을 수 있어요.`
            : `예산 ${formatWon(d.budget)} · 집행 ${formatWon(d.spent)} · 남은 예산 ${formatWon(d.budget - d.spent)} · 집행률 ${formatRate(usageRate(d.budget, d.spent))}`}
        </Card.Description>
      </Card.Header>
      <Card.Content className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActionForm key={d.budget ?? 'none'} action={setBudget} hidden={{ department_id: d.id, year: String(year) }} submitLabel="예산 저장">
          <TextField name="amount" isRequired inputMode="numeric" defaultValue={d.budget === null ? '' : d.budget.toLocaleString('ko-KR')} className="min-w-0 flex-1">
            <Label>{year}년 예산 (원)</Label>
            <Input placeholder="예: 50,000,000" />
          </TextField>
        </ActionForm>

        <div className="flex flex-col gap-3">
          <ActionForm action={addManager} hidden={{ department_id: d.id }} submitLabel="담당자 지정">
            <TextField name="email" type="email" isRequired maxLength={EMAIL_MAX} className="min-w-0 flex-1">
              <Label>부서 담당자 이메일</Label>
              <Input placeholder="axhub 로그인 이메일" />
            </TextField>
          </ActionForm>
          {d.managers.length === 0 ? (
            <p className="t-small text-muted">담당자가 없어요. 지금은 관리자만 이 부서 집행 건을 넣을 수 있어요.</p>
          ) : (
            <ul className="flex list-none flex-wrap gap-2 p-0" aria-label={`${d.name} 담당자`}>
              {d.managers.map((email) => (
                <li key={email} className="flex items-center gap-1 rounded-button-sm border border-default py-0.5 pl-3 pr-1">
                  <span className="t-small break-all">{email}</span>
                  <ConfirmButton
                    action={removeManager}
                    fields={{ department_id: d.id, email }}
                    title={`${email} 을 담당자에서 뺄까요?`}
                    description={`이 사람은 더 이상 ${d.name} 집행 건을 넣을 수 없어요. 이미 넣은 집행 건은 그대로 남아요.`}
                    confirmLabel="빼기"
                    label={`${email} 담당자에서 빼기`}
                  >
                    <X size={16} weight="bold" />
                  </ConfirmButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card.Content>
    </Card>
  )
}
