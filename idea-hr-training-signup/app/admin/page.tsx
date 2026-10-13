import Link from 'next/link'
import { Card, Chip, EmptyState, buttonVariants } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { TrainingForm } from '@/components/forms'
import { AdminOnlyCard, DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { SearchForm, queryOf } from '@/components/SearchForm'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatWhen, isManager, signupState } from '@/lib/training'
import { listAll, type Training } from '@/lib/training-store'

export const dynamic = 'force-dynamic'

// 교육 관리 — 관리자(axhub 의 is_admin: 앱 소유자 · 워크스페이스 관리자)만 볼 수 있어요.
// 메뉴를 숨기는 것만으론 막히지 않으니, 화면과 Server Action(app/actions.ts) 양쪽에서 확인해요.
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams
  const q = queryOf(params.q)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="교육 관리" desc="관리자 계정으로 로그인하면 교육을 등록하고 신청자 명단을 볼 수 있어요." returnTo="/admin" />
      </AppShell>
    )
  }
  if (!isManager(visitor)) {
    return (
      <AppShell>
        <AdminOnlyCard />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let rows: Training[] = []
  let hasMore = false
  let total = 0
  if (dbReady) ({ rows, hasMore, total } = await listAll(q, page))

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="교육 관리" description="교육을 등록하고, 교육별 신청자 명단을 보고 CSV 로 내려받아요." />

        {!dbReady && <DbNotice />}

        <Card>
          <Card.Header>
            <Card.Title>교육 등록</Card.Title>
            <Card.Description>등록하면 바로 「교육 신청」 화면에 보이고 직원이 신청할 수 있어요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <TrainingForm />
          </Card.Content>
        </Card>

        <section className="flex flex-col gap-4">
          <h2 className="t-section-title">교육 목록 {total > 0 && <span className="text-muted">{total}</span>}</h2>
          <SearchForm action="/admin" q={q} label="교육 제목 · 장소로 찾기" />
          <Card>
            <Card.Content>
              {rows.length === 0 ? (
                <EmptyState>{q ? '찾는 교육이 없어요.' : page > 1 ? '이 쪽에는 교육이 없어요.' : '아직 등록한 교육이 없어요. 위에서 첫 교육을 등록해 보세요.'}</EmptyState>
              ) : (
                <ul className="list-none p-0">
                  {rows.map((t) => {
                    const state = signupState(t)
                    return (
                      <li
                        key={t.id}
                        className="flex flex-col gap-3 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="t-small flex flex-wrap items-center gap-2 font-semibold break-words">
                            {t.title}
                            {state === 'started' ? (
                              <Chip size="sm">지난 교육</Chip>
                            ) : (
                              t.signed >= t.capacity && (
                                <Chip size="sm" color="warning">
                                  마감
                                </Chip>
                              )
                            )}
                          </p>
                          <p className="t-caption mt-1 break-words">
                            {formatWhen(t.starts_at)} · {t.location}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                          <span className="t-small">
                            신청 <strong>{t.signed}</strong> / {t.capacity}명
                          </span>
                          <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`/admin/${t.id}`}>
                            명단 · 수정
                          </Link>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              <Pager basePath="/admin" q={q} page={page} hasNext={hasMore} />
            </Card.Content>
          </Card>
        </section>
      </div>
    </AppShell>
  )
}
