import { Button, Card, Chip, EmptyState, Input, TextField } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DecisionForm } from '@/components/DecisionForm'
import { AdminOnlyCard, DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatCount, formatDateTime, isAdmin, isShort } from '@/lib/supply'
import { listPending, type PendingRequest } from '@/lib/supply-store'

export const dynamic = 'force-dynamic'

// 신청 처리 — 관리자(axhub 의 is_admin: 앱 소유자 · 워크스페이스 관리자)만 볼 수 있어요.
// 메뉴를 숨기는 것만으론 막히지 않으니, 화면과 Server Action(app/actions.ts) 양쪽에서 확인해요.
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="신청 처리" desc="관리자 계정으로 로그인하면 대기 중인 비품 신청을 지급하거나 반려할 수 있어요." returnTo="/admin" />
      </AppShell>
    )
  }
  if (!isAdmin(visitor)) {
    return (
      <AppShell>
        <AdminOnlyCard desc="비품 지급·반려는 이 앱의 관리자만 할 수 있어요." />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let rows: PendingRequest[] = []
  let hasMore = false
  let total = 0
  if (dbReady) ({ rows, hasMore, total } = await listPending(q, page))

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="신청 처리"
          description={
            q ? `"${q}" 로 찾은 대기 신청이 ${total}건이에요.` : total > 0 ? `지급을 기다리는 신청이 ${total}건 있어요. 먼저 들어온 순서예요.` : '지급을 기다리는 신청이 없어요.'
          }
        />

        {!dbReady && <DbNotice />}

        <section className="flex flex-col gap-4">
          <form method="get" action="/admin" role="search" className="flex gap-2">
            <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="신청자 · 비품 검색" className="flex-1">
              <Input placeholder="신청자 이름 · 이메일 · 비품 이름으로 찾기" />
            </TextField>
            <Button type="submit" variant="outline">
              찾기
            </Button>
          </form>
          {rows.length === 0 ? (
            <Card>
              <Card.Content>
                <EmptyState>{q ? '찾는 대기 신청이 없어요.' : page > 1 ? '이 쪽에는 대기 신청이 없어요.' : '새 신청이 들어오면 여기에 보여요.'}</EmptyState>
              </Card.Content>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {rows.map((r) => {
                const who = r.user_name || r.user_email
                const lacking = r.stock < r.qty
                return (
                  <Card key={r.id}>
                    <Card.Header>
                      <Card.Title className="flex flex-wrap items-center gap-2 break-words">
                        {r.supply_name} × {formatCount(r.qty)}
                        {lacking && (
                          <Chip size="sm" color="danger">
                            재고 모자람
                          </Chip>
                        )}
                      </Card.Title>
                      <Card.Description className="break-all">
                        {who}
                        {r.user_name && r.user_email && ` · ${r.user_email}`}
                      </Card.Description>
                    </Card.Header>
                    <Card.Content className="flex flex-col gap-1">
                      <p className={lacking ? 't-small text-danger' : 't-small'}>
                        지금 재고 {formatCount(r.stock)} · 최소 {formatCount(r.min_stock)}
                        {!lacking && ` · 지급하면 ${formatCount(r.stock - r.qty)}${isShort(r.stock - r.qty, r.min_stock) ? ' (부족)' : ''}`}
                      </p>
                      {r.note && <p className="t-small break-words text-muted">메모: {r.note}</p>}
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
                        <DecisionForm
                          id={r.id}
                          summary={`${who}님의 ${r.supply_name} ${formatCount(r.qty)}개 신청`}
                          short={!lacking && isShort(r.stock - r.qty, r.min_stock)}
                        />
                      )}
                    </Card.Footer>
                  </Card>
                )
              })}
            </div>
          )}
          <Pager basePath="/admin" q={q} page={page} hasNext={hasMore} />
        </section>
      </div>
    </AppShell>
  )
}
