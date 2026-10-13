import { Button, Card, EmptyState, Input, TextField } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, TabNav } from '@/components/ax'
import { HandleForm } from '@/components/HandleForm'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { ReportBody } from '@/components/ReportItem'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { STATUS_LABEL, isManager, isStatus } from '@/lib/facility'
import { countByStatus, listForManager, type AdminView, type Page, type Report, type StatusCounts } from '@/lib/facility-store'

export const dynamic = 'force-dynamic'

const VIEW_LABEL: Record<AdminView, string> = { ...STATUS_LABEL, all: '전체' }

// 신고 관리 — 담당자(axhub 의 is_admin: 앱 소유자 · 워크스페이스 관리자)만 볼 수 있어요.
// 메뉴를 숨기는 것만으론 막히지 않으니, 화면과 Server Action(app/actions.ts) 양쪽에서 확인해요.
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; page?: string }> }) {
  const params = await searchParams
  const view: AdminView = params.view === 'all' || isStatus(params.view ?? '') ? (params.view as AdminView) : 'received'
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="신고 관리" desc="담당자 계정으로 로그인하면 들어온 고장 신고를 처리할 수 있어요." returnTo="/admin" />
      </AppShell>
    )
  }
  if (!isManager(visitor)) {
    return (
      <AppShell>
        <Card className="mx-auto w-full max-w-xl items-center text-center">
          <Card.Header className="items-center">
            <h1 className="t-card-title">담당자만 볼 수 있어요</h1>
            <Card.Description>신고 처리는 이 앱의 관리자(담당자)만 할 수 있어요. 권한이 필요하면 앱 관리자에게 요청해 주세요.</Card.Description>
          </Card.Header>
        </Card>
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let counts: StatusCounts = { received: 0, in_progress: 0, done: 0 }
  let list: Page<Report> & { total: number } = { rows: [], hasMore: false, total: 0 }
  if (dbReady) {
    ;[counts, list] = await Promise.all([countByStatus(), listForManager(view, q, page)])
  }

  const open = counts.received + counts.in_progress
  const tabHref = (v: AdminView) => {
    const qs = new URLSearchParams()
    if (v !== 'received') qs.set('view', v)
    if (q) qs.set('q', q)
    const s = qs.toString()
    return s ? `/admin?${s}` : '/admin'
  }
  const label = VIEW_LABEL[view]

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="신고 관리"
          description={
            open > 0
              ? `처리할 신고가 ${open}건 있어요. 접수 · 처리 중 탭은 오래된 신고부터 보여요.`
              : '처리할 신고가 없어요. 새 신고가 들어오면 접수 탭에 보여요.'
          }
        />

        {!dbReady && <DbNotice />}

        <Card>
          <Card.Header className="gap-3">
            <TabNav
              activeKey={view}
              tabs={[
                { key: 'received', to: tabHref('received'), label: '접수', badge: counts.received || undefined },
                { key: 'in_progress', to: tabHref('in_progress'), label: '처리 중', badge: counts.in_progress || undefined },
                { key: 'done', to: tabHref('done'), label: '완료' },
                { key: 'all', to: tabHref('all'), label: '전체' },
              ]}
            />
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <form method="get" action="/admin" role="search" className="flex gap-2">
              {view !== 'received' && <input type="hidden" name="view" value={view} />}
              <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="위치 · 내용 · 신고자로 찾기" className="flex-1">
                <Input placeholder="위치 · 내용 · 신고자로 찾기" />
              </TextField>
              <Button type="submit" variant="outline">
                찾기
              </Button>
            </form>
            {q && (
              <p className="t-small text-muted">
                &quot;{q}&quot; 로 찾은 {label} 신고가 {list.total}건이에요.
              </p>
            )}

            {list.rows.length === 0 ? (
              <EmptyState>
                {q
                  ? `찾는 ${label} 신고가 없어요.`
                  : page > 1
                    ? '이 쪽에는 신고가 없어요.'
                    : view === 'received'
                      ? '새로 접수된 신고가 없어요. 새 신고가 들어오면 여기에 보여요.'
                      : `${label} 신고가 없어요.`}
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-4">
                {list.rows.map((r) => (
                  <Card key={r.id} variant="secondary">
                    <Card.Content>
                      <ReportBody report={r} showReporter />
                    </Card.Content>
                    <Card.Footer className="flex-col items-stretch">
                      <HandleForm id={r.id} status={r.status} memo={r.memo} version={r.version} />
                    </Card.Footer>
                  </Card>
                ))}
              </div>
            )}
            <Pager basePath="/admin" params={{ view: view === 'received' ? '' : view, q }} page={page} hasNext={list.hasMore} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
