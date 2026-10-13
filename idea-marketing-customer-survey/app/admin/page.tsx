import Link from 'next/link'
import { Button, Card, EmptyState, Input, TextField, buttonVariants } from '@heroui/react'
import { Plus } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatusDot } from '@/components/ax'
import { DbNotice, LoginCard, ManagerOnly } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { STATUS_LABEL, formatDateTime, isManager } from '@/lib/survey'
import { listSurveys, type ManagedSurvey } from '@/lib/survey-store'

export const dynamic = 'force-dynamic'

// 설문 관리 — 담당자(axhub 의 is_admin: 앱 소유자 · 워크스페이스 관리자)만 볼 수 있어요.
// 메뉴를 숨기는 것만으론 막히지 않으니, 화면과 Server Action(app/actions.ts) 양쪽에서 확인해요.
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="설문 관리" desc="관리자 계정으로 로그인하면 설문을 만들고 결과를 볼 수 있어요." returnTo="/admin" />
      </AppShell>
    )
  }
  if (!isManager(visitor)) {
    return (
      <AppShell>
        <ManagerOnly />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let rows: ManagedSurvey[] = []
  let hasMore = false
  let total = 0
  if (dbReady) ({ rows, hasMore, total } = await listSurveys(q, page))

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="설문 관리"
          description={q ? `"${q}" 로 찾은 설문이 ${total}개예요.` : total > 0 ? `설문이 ${total}개 있어요.` : '설문을 만들고 응답 링크를 직원들에게 보내 보세요.'}
          actions={
            dbReady ? (
              <Link className={buttonVariants({ variant: 'primary' })} href="/admin/new">
                <Plus size={16} weight="fill" />새 설문
              </Link>
            ) : undefined
          }
        />

        {!dbReady && <DbNotice />}

        <Card>
          <Card.Header>
            <Card.Title>설문 목록</Card.Title>
            <Card.Description>최근에 만든 설문이 먼저 보여요. 제목을 누르면 결과를 봐요.</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <form method="get" action="/admin" role="search" className="flex gap-2">
              <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="설문 제목 검색" className="flex-1">
                <Input placeholder="설문 제목으로 찾기" />
              </TextField>
              <Button type="submit" variant="outline">
                찾기
              </Button>
            </form>
            {rows.length === 0 ? (
              <EmptyState>{q ? '찾는 설문이 없어요.' : page > 1 ? '이 쪽에는 설문이 없어요.' : '아직 만든 설문이 없어요. 오른쪽 위 "새 설문" 으로 시작해 보세요.'}</EmptyState>
            ) : (
              <ul className="list-none p-0">
                {rows.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-col gap-2 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <Link href={`/admin/surveys/${s.id}`} className="t-small break-words font-semibold text-primary hover:underline">
                        {s.title}
                      </Link>
                      <p className="t-caption mt-1">
                        {formatDateTime(s.created_at)} · {s.created_by_name || '담당자'}님이 만듦
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <span className="t-small">응답 {s.response_count}명</span>
                      <StatusDot tone={s.status === 'open' ? 'active' : 'muted'}>{STATUS_LABEL[s.status]}</StatusDot>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Pager basePath="/admin" q={q} page={page} hasNext={hasMore} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
