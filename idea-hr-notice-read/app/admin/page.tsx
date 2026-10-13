import Link from 'next/link'
import { Card, Chip, EmptyState } from '@heroui/react'
import { CaretRight } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DbNotice, LoginCard, ManagerOnly } from '@/components/Gate'
import { NoticeForm } from '@/components/NoticeForms'
import { Pager, pageOf } from '@/components/Pager'
import { SearchForm, queryOf } from '@/components/SearchForm'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatDateTime, isManager, readRate } from '@/lib/notice'
import { countMembers, listNoticeStats, type NoticeStat } from '@/lib/notice-store'

export const dynamic = 'force-dynamic'

// 공지 관리 — 관리자(axhub 의 is_admin: 앱 소유자 · 워크스페이스 관리자)만 볼 수 있어요.
// 메뉴를 숨기는 것만으론 막히지 않으니, 화면과 Server Action(app/actions.ts) 양쪽에서 확인해요.
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams
  const q = queryOf(params.q)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="공지 관리" desc="관리자 계정으로 로그인하면 공지를 올리고 확인 현황을 볼 수 있어요." returnTo="/admin" />
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
  let rows: NoticeStat[] = []
  let hasMore = false
  let total = 0
  let members = 0
  if (dbReady) {
    let found
    ;[found, members] = await Promise.all([listNoticeStats(q, page), countMembers()])
    ;({ rows, hasMore, total } = found)
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="공지 관리" description={`공지를 올리고 공지마다 누가 확인했는지 봐요. 확인률은 앱에 들어온 적이 있는 ${members}명 기준이에요.`} />

        {!dbReady && <DbNotice />}

        <Card>
          <Card.Header>
            <Card.Title>새 공지</Card.Title>
            <Card.Description>올리면 바로 직원 목록에 &ldquo;안 읽음&rdquo; 으로 보여요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <NoticeForm />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>확인 현황</Card.Title>
            <Card.Description>{q ? `"${q}" 로 찾은 공지가 ${total}개예요.` : `올린 공지 ${total}개 · 최신순`}</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <SearchForm action="/admin" q={q} label="공지 제목 검색" placeholder="제목으로 찾기" />
            {rows.length === 0 ? (
              <EmptyState>{q ? `"${q}" 가 들어간 공지가 없어요.` : page > 1 ? '이 쪽에는 공지가 없어요.' : '아직 올린 공지가 없어요. 위에서 첫 공지를 올려 보세요.'}</EmptyState>
            ) : (
              <ul className="list-none p-0">
                {rows.map((s) => (
                  <li key={s.id} className="border-b border-default last:border-0">
                    <Link href={`/admin/${s.id}`} className="flex items-center gap-3 py-3">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="flex flex-wrap items-center gap-2">
                          {s.important && (
                            <Chip size="sm" color="danger">
                              중요
                            </Chip>
                          )}
                          <span className="t-small break-words font-semibold">{s.title}</span>
                        </p>
                        <p className="t-caption">
                          {s.author_name || '관리자'} · {formatDateTime(s.created_at)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="t-small font-semibold">{readRate(s.reads, members)}%</p>
                        <p className="t-caption">
                          {s.reads}/{members}명
                        </p>
                      </div>
                      <CaretRight size={16} weight="fill" className="shrink-0 text-muted" aria-hidden />
                    </Link>
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
