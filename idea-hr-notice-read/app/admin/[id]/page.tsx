import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, Chip, EmptyState, buttonVariants } from '@heroui/react'
import { ArrowLeft, Eye } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard, TabNav } from '@/components/ax'
import { DbNotice, LoginCard, ManagerOnly } from '@/components/Gate'
import { DeleteNoticeButton } from '@/components/NoticeForms'
import { Pager, pageOf } from '@/components/Pager'
import { SearchForm, queryOf } from '@/components/SearchForm'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatDateTime, isManager, isNoticeId, readRate } from '@/lib/notice'
import { countMembers, getNoticeSummary, listPeople } from '@/lib/notice-store'

export const dynamic = 'force-dynamic'

// 공지 한 건의 확인 현황 — 관리자만. 확인한 사람 / 아직 안 본 사람을 탭으로 나눠 보여요.
export default async function NoticeReadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const tab = sp.tab === 'read' ? 'read' : 'unread'
  const q = queryOf(sp.q)
  const page = pageOf(sp.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="확인 현황" desc="관리자 계정으로 로그인하면 이 공지를 누가 확인했는지 볼 수 있어요." returnTo={isNoticeId(id) ? `/admin/${id}` : '/admin'} />
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
  if (!isNoticeId(id)) notFound()
  if (!isDbConfigured()) {
    return (
      <AppShell>
        <DbNotice />
      </AppShell>
    )
  }

  const [notice, members, people] = await Promise.all([getNoticeSummary(id), countMembers(), listPeople(id, tab, q, page)])
  if (!notice) notFound()
  const unread = Math.max(0, members - notice.reads)
  const base = `/admin/${id}`

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        {/* 좁은 화면에서도 제목이 좁아지지 않게 버튼은 제목 아래 줄에 둬요. */}
        <div className="flex flex-col gap-4">
          <PageHeader title={notice.title} description={`${notice.author_name || '관리자'} · ${formatDateTime(notice.created_at)}에 올렸어요.`} />
          <div className="flex flex-wrap items-center gap-2">
            {notice.important && (
              <Chip size="sm" color="danger">
                중요 공지
              </Chip>
            )}
            <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href="/admin">
              <ArrowLeft size={16} weight="fill" aria-hidden />
              공지 관리로
            </Link>
            <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`/notices/${id}`}>
              <Eye size={16} weight="fill" aria-hidden />
              공지 보기
            </Link>
          </div>
        </div>

        <section aria-label="확인 요약" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="확인률" value={<span className="text-primary">{readRate(notice.reads, members)}%</span>} sub={`앱에 들어온 적이 있는 ${members}명 기준`} />
          <StatCard label="확인한 사람" value={`${notice.reads}명`} sub='"확인했어요" 를 누른 사람' />
          <StatCard label="아직 안 본 사람" value={`${unread}명`} sub="확인 버튼을 아직 안 누른 사람" />
        </section>

        <Card>
          <Card.Header>
            <TabNav
              activeKey={tab}
              tabs={[
                { key: 'unread', to: `${base}?tab=unread`, label: '아직 안 본 사람', badge: unread },
                { key: 'read', to: `${base}?tab=read`, label: '확인한 사람', badge: notice.reads },
              ]}
            />
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <SearchForm action={base} q={q} label="이름 · 이메일 검색" placeholder="이름이나 이메일로 찾기" hidden={{ tab }} />
            {people.rows.length === 0 ? (
              <EmptyState>
                {q
                  ? `"${q}" 로 찾은 사람이 없어요.`
                  : page > 1
                    ? '이 쪽에는 사람이 없어요.'
                    : tab === 'read'
                      ? '아직 아무도 확인하지 않았어요.'
                      : members === 0
                        ? '아직 앱에 들어온 사람이 없어요.'
                        : '모두 확인했어요.'}
              </EmptyState>
            ) : (
              <ul className="list-none p-0">
                {people.rows.map((p) => (
                  <li key={p.user_key} className="flex flex-col gap-1 border-b border-default py-3 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="t-small break-words font-semibold">{p.name || p.email || '이름 없음'}</p>
                      {p.name && p.email && <p className="t-caption break-all">{p.email}</p>}
                    </div>
                    {p.read_at && <p className="t-caption shrink-0">{formatDateTime(p.read_at)} 확인</p>}
                  </li>
                ))}
              </ul>
            )}
            <Pager basePath={base} q={q} page={page} hasNext={people.hasMore} keep={{ tab }} />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>공지 지우기</Card.Title>
            <Card.Description>잘못 올린 공지는 지울 수 있어요. 직원 목록에서도 사라지고 확인 기록도 함께 지워져요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <DeleteNoticeButton id={notice.id} title={notice.title} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
