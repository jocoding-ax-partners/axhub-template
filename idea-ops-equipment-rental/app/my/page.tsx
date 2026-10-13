import { Card, Chip, EmptyState } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatusDot } from '@/components/ax'
import { ConfirmAction } from '@/components/ConfirmAction'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { dueHint, formatDate, formatDateTime, isOverdue, kstToday } from '@/lib/rental'
import { listMyRentals, type MyRental } from '@/lib/rental-store'

export const dynamic = 'force-dynamic'

// 내 대여 — 지금 빌린 장비와 지난 대여 기록. 지금 빌린 것이 맨 위에 와요.
export default async function MyPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageOf((await searchParams).page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="내 대여" desc="axhub 계정으로 로그인하면 내가 빌린 장비와 기록을 볼 수 있어요." returnTo="/my" />
      </AppShell>
    )
  }

  const today = kstToday()
  const dbReady = isDbConfigured()
  let rows: MyRental[] = []
  let hasMore = false
  if (dbReady) ({ rows, hasMore } = await listMyRentals(visitor.user_id, page))

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="내 대여" description={`${visitor.name || visitor.email}님이 빌린 장비와 지난 대여 기록이에요.`} />

        {!dbReady && <DbNotice />}

        <Card>
          <Card.Header>
            <Card.Title>대여 기록</Card.Title>
            <Card.Description>아직 반납하지 않은 장비가 먼저, 그다음 최근에 빌린 순서로 보여요.</Card.Description>
          </Card.Header>
          <Card.Content>
            {rows.length === 0 ? (
              <EmptyState>{page > 1 ? '이 쪽에는 기록이 없어요.' : '아직 빌린 장비가 없어요. 장비 목록에서 빌려 보세요.'}</EmptyState>
            ) : (
              <ul className="list-none p-0">
                {rows.map((r) => {
                  const late = !r.returned_at && isOverdue(r.due_date, today)
                  return (
                    <li
                      key={r.id}
                      className="flex flex-col gap-3 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="t-small flex flex-wrap items-center gap-2 font-semibold">
                          <span className="break-words">{r.name}</span>
                          <Chip size="sm">{r.kind}</Chip>
                        </p>
                        <p className="t-caption break-all font-mono">{r.asset_no}</p>
                        {r.returned_at ? (
                          <p className="t-small text-muted">
                            {formatDateTime(r.rented_at)} 대여 · {formatDateTime(r.returned_at)} 반납
                            {r.returned_by && r.returned_by !== (visitor.name || visitor.email) && ` (${r.returned_by}님이 처리)`}
                          </p>
                        ) : (
                          <div className={`t-small flex flex-wrap items-center gap-x-2 gap-y-1 ${late ? 'text-danger' : ''}`}>
                            <StatusDot tone={late ? 'failed' : 'warning'}>{late ? '반납 지연' : '대여 중'}</StatusDot>
                            <span className={late ? 'font-semibold' : 'text-muted'}>
                              반납 예정 {formatDate(r.due_date)} · {dueHint(r.due_date, today)}
                            </span>
                          </div>
                        )}
                      </div>
                      {!r.returned_at && (
                        <div className="shrink-0">
                          <ConfirmAction
                            action="return"
                            id={r.id}
                            label="반납"
                            confirm={{ title: `${r.name}을(를) 반납할까요?`, description: '반납하면 다른 사람이 바로 빌릴 수 있어요.', confirmLabel: '반납' }}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            <Pager basePath="/my" page={page} hasNext={hasMore} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
