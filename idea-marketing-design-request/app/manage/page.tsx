import { Card } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard, TabNav } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { RequestList, SearchForm } from '@/components/RequestList'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { STATUS_LABEL, isDesigner, isStatus, kstToday, type DesignStatus } from '@/lib/design'
import { countByStatus, listAllRequests, type Page, type RequestRow } from '@/lib/design-store'

export const dynamic = 'force-dynamic'

// 요청 관리 — 디자이너(axhub 의 is_admin: 앱 소유자 · 워크스페이스 관리자)만 볼 수 있어요.
// 메뉴를 숨기는 것만으론 막히지 않으니, 화면과 Server Action(app/actions.ts) 양쪽에서 확인해요.
export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>
}) {
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const status: DesignStatus | '' = isStatus(params.status ?? '') ? (params.status as DesignStatus) : ''
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="요청 관리" desc="디자이너 계정으로 로그인하면 들어온 요청을 맡고 진행 단계를 바꿀 수 있어요." returnTo="/manage" />
      </AppShell>
    )
  }
  if (!isDesigner(visitor)) {
    return (
      <AppShell>
        <Card className="mx-auto w-full max-w-xl items-center text-center">
          <Card.Header className="items-center">
            <h1 className="t-card-title">디자이너만 볼 수 있어요</h1>
            <Card.Description>요청 관리는 이 앱의 관리자(디자이너)만 할 수 있어요. 내가 올린 요청은 「내 요청」 에서 볼 수 있어요.</Card.Description>
          </Card.Header>
        </Card>
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let list: Page<RequestRow> = { rows: [], hasMore: false, total: 0 }
  let counts: Record<DesignStatus, number> = { received: 0, in_progress: 0, review: 0, done: 0 }
  if (dbReady) [list, counts] = await Promise.all([listAllRequests(status, q, page), countByStatus()])

  const hrefWith = (next: { status?: string }) => {
    const qs = new URLSearchParams(Object.entries({ status, q, ...next }).filter(([, v]) => v)).toString()
    return qs ? `/manage?${qs}` : '/manage'
  }
  const open = counts.received + counts.in_progress + counts.review

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="요청 관리"
          description={
            counts.received > 0 ? `아무도 맡지 않은 요청이 ${counts.received}건 있어요.` : '새로 들어온 요청은 모두 담당자가 있어요.'
          }
        />

        {!dbReady && <DbNotice />}

        <section aria-label="요청 요약" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="새 요청 (접수)" value={<span className="text-primary">{counts.received}건</span>} sub="맡을 디자이너를 기다려요" />
          <StatCard label="진행 중" value={`${counts.in_progress + counts.review}건`} sub={`작업 중 ${counts.in_progress} · 검토 요청 ${counts.review}`} />
          <StatCard label="완료" value={`${counts.done}건`} sub="결과물을 전달했어요" />
        </section>

        <Card>
          <Card.Header className="gap-3">
            <TabNav
              activeKey={status || 'all'}
              tabs={[
                { key: 'all', to: hrefWith({ status: '' }), label: '전체', badge: open || undefined },
                ...(Object.keys(STATUS_LABEL) as DesignStatus[]).map((s) => ({
                  key: s,
                  to: hrefWith({ status: s }),
                  label: STATUS_LABEL[s],
                  badge: s !== 'done' && counts[s] > 0 ? counts[s] : undefined,
                })),
              ]}
            />
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <SearchForm action="/manage" q={q} label="요청자 · 문구 · 디자이너로 찾기" hidden={{ status }} />
            <p className="t-small text-muted">
              {q ? `"${q}" 로 찾은 요청이 ${list.total}건이에요.` : status === 'done' ? '최근에 끝난 요청부터 보여요.' : '끝나지 않은 요청부터, 희망 마감일이 급한 순서로 보여요.'}
            </p>
            <RequestList
              rows={list.rows}
              today={kstToday()}
              showRequester
              empty={q ? '찾는 요청이 없어요.' : page > 1 ? '이 쪽에는 요청이 없어요.' : status ? `${STATUS_LABEL[status]} 단계인 요청이 없어요.` : '아직 들어온 요청이 없어요.'}
            />
            <Pager basePath="/manage" q={q} page={page} hasNext={list.hasMore} filters={{ status }} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
