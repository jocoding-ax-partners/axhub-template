import Link from 'next/link'
import { Button, Card, EmptyState, Input, Label, TextField, buttonVariants } from '@heroui/react'
import { Plus } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { ChoiceSelect } from '@/components/ChoiceSelect'
import { ChannelLabel, StatusLabel } from '@/components/ContentBadges'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { CHANNELS, STATUSES, formatDate, isChannel, isStatus, parseDate } from '@/lib/content'
import { listContents, type CalendarItem } from '@/lib/content-store'

export const dynamic = 'force-dynamic'

type Params = { q?: string; channel?: string; status?: string; date?: string; page?: string }

// 목록 보기. ?channel=&status=&q= 로 걸러요 (GET 폼이라 주소를 그대로 공유할 수 있어요).
export default async function ListPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams
  const filter = {
    q: (sp.q ?? '').trim().slice(0, 50),
    channel: isChannel(sp.channel) ? sp.channel : null,
    status: isStatus(sp.status) ? sp.status : null,
    date: sp.date && parseDate(sp.date) ? sp.date : null,
    page: pageOf(sp.page),
  }
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="콘텐츠 목록" desc="axhub 계정으로 로그인하면 팀의 콘텐츠를 채널·상태로 걸러 볼 수 있어요." returnTo="/list" />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let rows: CalendarItem[] = []
  let hasMore = false
  let total = 0
  if (dbReady) ({ rows, hasMore, total } = await listContents(filter))
  const filtered = Boolean(filter.q || filter.channel || filter.status || filter.date)

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <PageHeader
            title="콘텐츠 목록"
            description={filtered ? `조건에 맞는 콘텐츠가 ${total}건이에요.` : `콘텐츠가 모두 ${total}건이에요. 발행 예정일이 늦은 것부터 보여요.`}
          />
          <div>
            <Link className={buttonVariants({ variant: 'primary', size: 'sm' })} href="/new">
              <Plus size={16} weight="fill" />
              콘텐츠 등록
            </Link>
          </div>
        </div>

        {!dbReady && <DbNotice />}

        <Card>
          <Card.Content>
            <form method="get" action="/list" role="search" className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField name="q" type="search" defaultValue={filter.q} maxLength={50}>
                <Label>찾기</Label>
                <Input placeholder="제목 · 담당자" />
              </TextField>
              <ChoiceSelect
                name="channel"
                label="채널"
                defaultValue={filter.channel ?? 'all'}
                options={[{ id: 'all', label: '전체 채널' }, ...Object.entries(CHANNELS).map(([id, c]) => ({ id, label: c.label }))]}
              />
              <ChoiceSelect
                name="status"
                label="상태"
                defaultValue={filter.status ?? 'all'}
                options={[{ id: 'all', label: '전체 상태' }, ...Object.entries(STATUSES).map(([id, label]) => ({ id, label }))]}
              />
              {filter.date && <input type="hidden" name="date" value={filter.date} />}
              <div className="flex gap-2">
                <Button type="submit" className="flex-1 sm:flex-none">
                  걸러 보기
                </Button>
                {filtered && (
                  <Link className={buttonVariants({ variant: 'ghost' })} href="/list">
                    조건 지우기
                  </Link>
                )}
              </div>
            </form>
            {filter.date && <p className="t-small mt-3 text-muted">{formatDate(filter.date)} 발행 예정인 콘텐츠만 보고 있어요.</p>}
          </Card.Content>
        </Card>

        <Card>
          <Card.Content>
            {rows.length === 0 ? (
              <EmptyState>
                {filtered
                  ? '조건에 맞는 콘텐츠가 없어요. 조건을 바꿔 보세요.'
                  : filter.page > 1
                    ? '이 쪽에는 콘텐츠가 없어요.'
                    : '아직 등록한 콘텐츠가 없어요. 첫 콘텐츠를 등록해 보세요.'}
              </EmptyState>
            ) : (
              <ul className="list-none p-0">
                {rows.map((c) => (
                  <li key={c.id} className="border-b border-default last:border-0">
                    <Link href={`/c/${c.id}`} className="flex flex-col gap-2 py-3 hover:bg-muted sm:flex-row sm:items-center sm:gap-4 sm:px-2">
                      <span className="t-small shrink-0 text-muted sm:w-40">{formatDate(c.publish_date)}</span>
                      <span className="t-small min-w-0 flex-1 break-words font-medium">{c.title}</span>
                      <span className="t-small flex flex-wrap items-center gap-x-4 gap-y-1 sm:shrink-0">
                        <span className="sm:w-24">
                          <ChannelLabel channel={c.channel} />
                        </span>
                        <span className="text-muted sm:w-24 sm:truncate">{c.owner}</span>
                        <span className="sm:w-16">
                          <StatusLabel status={c.status} />
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Pager
              basePath="/list"
              params={{ q: filter.q, channel: filter.channel, status: filter.status, date: filter.date }}
              page={filter.page}
              hasNext={hasMore}
            />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
