import { Button, Card, Chip, EmptyState, Input, TextField } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DecisionForm } from '@/components/DecisionForm'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { ANNUAL_QUOTA, KIND_LABEL, formatDateTime, formatDays, formatPeriod, isApprover, kstToday } from '@/lib/leave'
import { listEmployeeUsage, listPending, type EmployeeUsage, type PendingLeave } from '@/lib/leave-store'

export const dynamic = 'force-dynamic'

// 승인 관리 — 관리자(axhub 의 is_admin: 앱 소유자 · 워크스페이스 관리자)만 볼 수 있어요.
// 메뉴를 숨기는 것만으론 막히지 않으니, 화면과 Server Action(app/actions.ts) 양쪽에서 확인해요.
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="승인 관리" desc="관리자 계정으로 로그인하면 대기 중인 휴가 신청을 처리할 수 있어요." returnTo="/admin" />
      </AppShell>
    )
  }
  if (!isApprover(visitor)) {
    return (
      <AppShell>
        <Card className="mx-auto w-full max-w-xl items-center text-center">
          <Card.Header className="items-center">
            <h1 className="t-card-title">관리자만 볼 수 있어요</h1>
            <Card.Description>휴가 승인·반려는 이 앱의 관리자만 할 수 있어요. 권한이 필요하면 앱 관리자에게 요청해 주세요.</Card.Description>
          </Card.Header>
        </Card>
      </AppShell>
    )
  }

  const year = Number(kstToday().slice(0, 4))
  const dbReady = isDbConfigured()
  let pending: PendingLeave[] = []
  let hasMore = false
  let total = 0
  let employees: EmployeeUsage[] = []
  if (dbReady) {
    let found
    ;[found, employees] = await Promise.all([listPending(q, page), listEmployeeUsage(year)])
    ;({ rows: pending, hasMore, total } = found)
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="승인 관리"
          description={
            q
              ? `"${q}" 로 찾은 대기 신청이 ${total}건이에요.`
              : total > 0
                ? `처리를 기다리는 신청이 ${total}건 있어요.`
                : '처리를 기다리는 신청이 없어요.'
          }
        />

        {!dbReady && <DbNotice />}

        <section className="flex flex-col gap-4">
          <h2 className="t-section-title">대기 중인 신청</h2>
          <form method="get" action="/admin" role="search" className="flex gap-2">
            <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="신청자 이름 · 이메일 검색" className="flex-1">
              <Input placeholder="신청자 이름 · 이메일로 찾기" />
            </TextField>
            <Button type="submit" variant="outline">
              찾기
            </Button>
          </form>
          {pending.length === 0 ? (
            <Card>
              <Card.Content>
                <EmptyState>
                  {q ? '찾는 신청자의 대기 신청이 없어요.' : page > 1 ? '이 쪽에는 대기 신청이 없어요.' : '새 신청이 들어오면 여기에 보여요.'}
                </EmptyState>
              </Card.Content>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {pending.map((r) => (
                <Card key={r.id}>
                  <Card.Header>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Card.Title className="flex flex-wrap items-center gap-2">
                        {r.user_name || r.user_email}
                        <Chip size="sm">{KIND_LABEL[r.kind]}</Chip>
                      </Card.Title>
                      {r.kind !== 'sick' && (
                        <span className="t-caption">
                          {r.start_date.slice(0, 4)}년 남은 연차 {formatDays(ANNUAL_QUOTA - r.used)}
                        </span>
                      )}
                    </div>
                    {r.user_name && r.user_email && <Card.Description className="break-all">{r.user_email}</Card.Description>}
                  </Card.Header>
                  <Card.Content className="flex flex-col gap-1">
                    <p className="t-small">
                      {formatPeriod(r.start_date, r.end_date)} · {formatDays(r.days)}
                    </p>
                    <p className="t-small break-words text-muted">사유: {r.reason}</p>
                    <p className="t-caption">{formatDateTime(r.created_at)} 신청</p>
                  </Card.Content>
                  <Card.Footer className="flex-col items-stretch">
                    {r.user_key === visitor.user_id ? (
                      <p className="t-small flex flex-wrap items-center gap-2 text-muted">
                        <Chip size="sm" color="warning">
                          본인 신청
                        </Chip>
                        본인 신청은 다른 관리자가 처리해야 해요.
                      </p>
                    ) : (
                      <DecisionForm id={r.id} summary={`${r.user_name || r.user_email}님의 ${KIND_LABEL[r.kind]} 신청`} />
                    )}
                  </Card.Footer>
                </Card>
              ))}
            </div>
          )}
          <Pager basePath="/admin" q={q} page={page} hasNext={hasMore} />
        </section>

        <Card>
          <Card.Header>
            <Card.Title>{year}년 직원별 연차</Card.Title>
            <Card.Description>올해 휴가를 신청한 적이 있는 직원만 보여요. 한 해 연차는 {ANNUAL_QUOTA}일이에요.</Card.Description>
          </Card.Header>
          <Card.Content>
            {employees.length === 0 ? (
              <EmptyState>올해 신청 기록이 아직 없어요.</EmptyState>
            ) : (
              <ul className="list-none p-0">
                {employees.map((e) => (
                  <li key={e.user_key} className="flex flex-col gap-1 border-b border-default py-3 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="t-small font-semibold">{e.user_name || e.user_email}</p>
                      {e.user_name && e.user_email && <p className="t-caption break-all">{e.user_email}</p>}
                    </div>
                    <p className="t-small flex flex-wrap gap-x-3">
                      <span className="font-semibold">남은 연차 {formatDays(ANNUAL_QUOTA - e.used)}</span>
                      <span className="text-muted">쓴 연차 {formatDays(e.used)}</span>
                      {e.pending > 0 && <span className="text-muted">대기 {formatDays(e.pending)}</span>}
                      {e.sick > 0 && <span className="text-muted">병가 {formatDays(e.sick)}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
