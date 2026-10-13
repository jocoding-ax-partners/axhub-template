import { Card } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { pageOf } from '@/components/Pager'
import { QuoteBoard } from '@/components/QuoteBoard'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { cleanQuery, isLeader, kstToday, statusOf, type QuoteStatus } from '@/lib/quote'
import { countByStatus, listMembers, listQuotes, touchMember, type Member, type Quote, type QuoteFilter } from '@/lib/quote-store'

export const dynamic = 'force-dynamic'

// 전체 요청 — 팀장(axhub 의 is_admin: 앱 소유자 · 워크스페이스 관리자)만 볼 수 있어요.
// 메뉴를 숨기는 것만으론 막히지 않으니, 화면과 Server Action(app/actions.ts) 양쪽에서 확인해요.
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; unassigned?: string; page?: string }>
}) {
  const params = await searchParams
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="전체 요청" desc="팀장 계정으로 로그인하면 모든 견적 요청에 담당자를 배정하고 상태를 바꿀 수 있어요." returnTo="/admin" />
      </AppShell>
    )
  }
  if (!isLeader(visitor)) {
    return (
      <AppShell>
        <Card className="mx-auto w-full max-w-xl items-center text-center">
          <Card.Header className="items-center">
            <h1 className="t-card-title">팀장만 볼 수 있어요</h1>
            <Card.Description>
              담당자 배정과 상태 변경은 이 앱의 관리자(팀장)만 할 수 있어요. 내 담당 요청은 내 요청 화면에서 볼 수 있어요.
            </Card.Description>
          </Card.Header>
        </Card>
      </AppShell>
    )
  }

  const filter: QuoteFilter = {
    mine: null,
    status: statusOf(params.status),
    q: cleanQuery(params.q),
    unassigned: params.unassigned === '1',
  }
  const page = pageOf(params.page)
  const dbReady = isDbConfigured()
  let rows: Quote[] = []
  let hasMore = false
  let counts: Record<QuoteStatus, number> = { received: 0, quoted: 0, won: 0, lost: 0 }
  let members: Member[] = []
  if (dbReady) {
    await touchMember({ userKey: visitor.user_id, name: visitor.name || visitor.email, email: visitor.email })
    let found
    ;[found, counts, members] = await Promise.all([listQuotes(filter, page), countByStatus(filter), listMembers()])
    ;({ rows, hasMore } = found)
  }
  const open = counts.received + counts.quoted

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="전체 요청"
          description={
            open > 0
              ? `진행 중인 요청(접수 · 견적 발송)이 ${open}건 있어요. 담당자를 배정하고 상태를 바꿔요.`
              : '모든 견적 요청을 보고 담당자를 배정하고 상태를 바꿔요.'
          }
        />

        {!dbReady && <DbNotice />}

        <p className="t-small text-muted">
          담당자는 이 앱에 한 번이라도 들어온 사람 중에서 골라요. 목록에 없으면 그 사람에게 앱 주소를 보내 한 번 열어 보게 해 주세요.
        </p>

        <QuoteBoard
          basePath="/admin"
          filter={filter}
          counts={counts}
          rows={rows}
          page={page}
          hasMore={hasMore}
          today={kstToday()}
          viewer={visitor.user_id}
          manage={{ members }}
        />
      </div>
    </AppShell>
  )
}
