import { Button, Card, Chip, EmptyState, Input, TextField } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard, TabNav } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { ParcelAction } from '@/components/ParcelAction'
import { ParcelForm } from '@/components/ParcelForm'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { KIND_LABEL, STALE_DAYS, daysWaiting, formatDateTime, isDesk, recipientLabel, waitingLabel } from '@/lib/parcel'
import { deskSummary, listReceived, listWaiting, type DeskSummary, type Parcel } from '@/lib/parcel-store'

export const dynamic = 'force-dynamic'

// 안내데스크 — 담당자(axhub 의 is_admin: 앱 소유자 · 워크스페이스 관리자)만 볼 수 있어요.
// 메뉴를 숨기는 것만으론 막히지 않으니, 화면과 Server Action(app/actions.ts) 양쪽에서 확인해요.
export default async function DeskPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; view?: string }> }) {
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const view = params.view === 'done' ? 'done' : 'waiting'
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="안내데스크" desc="담당자 계정으로 로그인하면 도착한 택배를 등록하고 미수령 목록을 볼 수 있어요." returnTo="/desk" />
      </AppShell>
    )
  }
  if (!isDesk(visitor)) {
    return (
      <AppShell>
        <Card className="mx-auto w-full max-w-xl items-center text-center">
          <Card.Header className="items-center">
            <h1 className="t-card-title">담당자만 볼 수 있어요</h1>
            <Card.Description>택배 등록과 전체 미수령 목록은 안내데스크 담당자만 볼 수 있어요. 권한이 필요하면 앱 관리자에게 요청해 주세요.</Card.Description>
          </Card.Header>
        </Card>
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let summary: DeskSummary = { waiting: 0, stale: 0, arrivedToday: 0 }
  let rows: Parcel[] = []
  let hasMore = false
  let total = 0
  if (dbReady) {
    let found
    ;[summary, found] = await Promise.all([deskSummary(), view === 'done' ? listReceived(q, page) : listWaiting(q, page)])
    ;({ rows, hasMore, total } = found)
  }

  const filters = { view: view === 'done' ? 'done' : '', q }
  const tabHref = (v: string) => {
    const qs = new URLSearchParams(Object.entries({ view: v, q }).filter(([, x]) => x)).toString()
    return qs ? `/desk?${qs}` : '/desk'
  }
  const what = view === 'done' ? '수령 완료' : '미수령'

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="안내데스크"
          description={summary.waiting > 0 ? `아직 안 찾아간 택배가 ${summary.waiting}건 있어요.` : '아직 안 찾아간 택배가 없어요.'}
        />

        {!dbReady && <DbNotice />}

        <section aria-label="택배 현황" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="미수령" value={<span className="text-primary">{summary.waiting}건</span>} sub="받는 사람이 아직 안 가져갔어요" />
          <StatCard label={`${STALE_DAYS}일 넘게 보관 중`} value={`${summary.stale}건`} sub="받는 사람에게 한 번 더 알려 주세요" />
          <StatCard label="오늘 도착" value={`${summary.arrivedToday}건`} sub="오늘 등록한 택배·우편" />
        </section>

        <Card>
          <Card.Header>
            <Card.Title>택배 등록</Card.Title>
            <Card.Description>도착한 택배를 등록하면 받는 사람 화면 맨 위에 바로 보여요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <ParcelForm />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="gap-3">
            <TabNav
              activeKey={view}
              tabs={[
                { key: 'waiting', to: tabHref(''), label: '미수령', badge: summary.waiting },
                { key: 'done', to: tabHref('done'), label: '수령 완료' },
              ]}
            />
            <Card.Description>
              {view === 'done' ? '최근에 받아 간 것부터 보여요.' : '먼저 도착한 것부터 보여요. 데스크에서 직접 건넸다면 대신 수령 처리해요.'}
            </Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <form method="get" action="/desk" role="search" className="flex gap-2">
              {filters.view && <input type="hidden" name="view" value={filters.view} />}
              <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="받는 사람 · 보낸 곳 · 보관 위치 검색" className="min-w-0 flex-1">
                <Input placeholder="받는 사람 · 보낸 곳 · 보관 위치로 찾기" />
              </TextField>
              <Button type="submit" variant="outline">
                찾기
              </Button>
            </form>
            {q && (
              <p className="t-small text-muted" role="status">
                &quot;{q}&quot; 로 찾은 {what} 택배가 {total}건이에요.
              </p>
            )}

            {rows.length === 0 ? (
              <EmptyState>
                {q
                  ? `찾는 ${what} 택배가 없어요.`
                  : page > 1
                    ? '이 쪽에는 택배가 없어요.'
                    : view === 'done'
                      ? '아직 수령 처리된 택배가 없어요.'
                      : '미수령 택배가 없어요. 도착한 택배를 위에서 등록해 주세요.'}
              </EmptyState>
            ) : (
              <ul className="list-none p-0">
                {rows.map((p) => (view === 'done' ? <ReceivedRow key={p.id} p={p} /> : <WaitingRow key={p.id} p={p} />))}
              </ul>
            )}
            <Pager basePath="/desk" params={filters} page={page} hasNext={hasMore} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}

const ROW = 'flex flex-col gap-3 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0'

function WaitingRow({ p }: { p: Parcel }) {
  const days = daysWaiting(p.arrived_at)
  const who = p.recipient_name || p.recipient_email
  return (
    <li className={`${ROW} sm:flex-row sm:items-start sm:justify-between`}>
      <div className="min-w-0">
        <p className="t-small flex flex-wrap items-center gap-2 font-semibold">
          <span className="break-all">{recipientLabel(p.recipient_name, p.recipient_email)}</span>
          <Chip size="sm">{KIND_LABEL[p.kind]}</Chip>
          {days >= STALE_DAYS && (
            <Chip size="sm" color="warning">
              {waitingLabel(days)}
            </Chip>
          )}
        </p>
        <p className="t-small mt-2 break-words">
          {p.sender} · 보관 위치 <span className="font-semibold">{p.location}</span>
        </p>
        {p.memo && <p className="t-small mt-1 break-words text-muted">메모: {p.memo}</p>}
        <p className="t-caption mt-1">
          {formatDateTime(p.arrived_at)} 도착{days < STALE_DAYS && ` · ${waitingLabel(days)}`} · {p.registered_by_name}님이 등록
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <ParcelAction
          action="receive"
          id={p.id}
          label="대신 수령 처리"
          confirm={{
            title: `${who}님의 ${KIND_LABEL[p.kind]}을 건넸나요?`,
            description: '받는 사람 화면에서도 수령으로 바뀌고 되돌릴 수 없어요.',
            confirmLabel: '수령 처리',
          }}
        />
        <ParcelAction
          action="cancel"
          id={p.id}
          label="등록 취소"
          confirm={{
            title: `${who}님의 ${p.sender} ${KIND_LABEL[p.kind]} 등록을 취소할까요?`,
            description: '잘못 등록했을 때만 써요. 받는 사람 화면에서도 사라지고 되돌릴 수 없어요.',
            confirmLabel: '등록 취소',
            variant: 'danger',
          }}
        />
      </div>
    </li>
  )
}

function ReceivedRow({ p }: { p: Parcel }) {
  return (
    <li className={ROW}>
      <p className="t-small flex flex-wrap items-center gap-2 font-semibold">
        <span className="break-all">{recipientLabel(p.recipient_name, p.recipient_email)}</span>
        <Chip size="sm">{KIND_LABEL[p.kind]}</Chip>
      </p>
      <p className="t-small break-words">
        {p.sender} · 보관 위치 {p.location}
      </p>
      <p className="t-caption">
        {formatDateTime(p.arrived_at)} 도착 · {p.received_at && formatDateTime(p.received_at)} 수령 ({p.received_by_name}님이 처리)
      </p>
    </li>
  )
}
