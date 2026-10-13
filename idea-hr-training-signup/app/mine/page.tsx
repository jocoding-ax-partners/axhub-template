import Link from 'next/link'
import { Card, EmptyState, buttonVariants } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { TrainingCard } from '@/components/TrainingCard'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { listMine, type Training } from '@/lib/training-store'

export const dynamic = 'force-dynamic'

// 내 신청 — 내가 신청한 교육. 다가오는 교육(가까운 순)이 먼저, 지난 교육은 뒤에 보여요.
export default async function MinePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageOf((await searchParams).page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="내 신청" desc="axhub 계정으로 로그인하면 내가 신청한 교육을 볼 수 있어요." returnTo="/mine" />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let rows: Training[] = []
  let hasMore = false
  let total = 0
  if (dbReady) ({ rows, hasMore, total } = await listMine(visitor.user_id, page))

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="내 신청"
          description={total > 0 ? `${visitor.name || visitor.email}님이 신청한 교육이 ${total}개예요. 시작 전까지 취소할 수 있어요.` : '내가 신청한 교육이 여기에 모여요.'}
        />

        {!dbReady && <DbNotice />}

        <section className="flex flex-col gap-4">
          {rows.length === 0 ? (
            <Card>
              <Card.Content className="flex flex-col items-center gap-4">
                <EmptyState>{page > 1 ? '이 쪽에는 신청한 교육이 없어요.' : '아직 신청한 교육이 없어요.'}</EmptyState>
                {page === 1 && (
                  <Link className={buttonVariants({ variant: 'primary' })} href="/">
                    교육 둘러보기
                  </Link>
                )}
              </Card.Content>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {rows.map((t) => (
                <TrainingCard key={t.id} t={t} />
              ))}
            </div>
          )}
          <Pager basePath="/mine" q="" page={page} hasNext={hasMore} />
        </section>
      </div>
    </AppShell>
  )
}
