import { notFound } from 'next/navigation'
import { Card, Chip, EmptyState, buttonVariants } from '@heroui/react'
import { DownloadSimple } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard } from '@/components/ax'
import { DeleteTrainingButton, TrainingForm } from '@/components/forms'
import { AdminOnlyCard, DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { SearchForm, queryOf } from '@/components/SearchForm'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatDateTime, formatWhen, isManager, signupState, toKstInput } from '@/lib/training'
import { PAGE_SIZE, getTraining, listSignups } from '@/lib/training-store'

export const dynamic = 'force-dynamic'

// 교육 한 건 — 신청자 명단(검색 · CSV) · 정보 수정 · 지우기. 관리자만.
export default async function TrainingAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const q = queryOf(sp.q)
  const page = pageOf(sp.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="교육 관리" desc="관리자 계정으로 로그인하면 신청자 명단을 볼 수 있어요." returnTo={`/admin/${id}`} />
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
  if (!isDbConfigured()) {
    return (
      <AppShell>
        <DbNotice />
      </AppShell>
    )
  }

  const t = await getTraining(id)
  if (!t) notFound()
  const signups = await listSignups(t.id, q, page)
  const started = signupState(t) === 'started'

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          backTo="/admin"
          backLabel="교육 관리"
          title={<span className="break-words">{t.title}</span>}
          description={`${formatWhen(t.starts_at)} · ${t.location}`}
        />

        <section aria-label="신청 현황" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="신청" value={`${t.signed}명`} sub={started ? '교육이 시작돼 신청이 닫혔어요' : '시작 전까지 신청 · 취소할 수 있어요'} />
          <StatCard label="정원" value={`${t.capacity}명`} />
          <StatCard
            label="남은 자리"
            value={<span className={t.signed >= t.capacity ? 'text-warning' : 'text-primary'}>{`${Math.max(0, t.capacity - t.signed)}자리`}</span>}
            sub={t.signed >= t.capacity ? '정원이 차서 마감됐어요' : undefined}
          />
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="t-section-title">신청자 명단</h2>
            <a className={buttonVariants({ variant: 'primary' })} href={`/admin/${t.id}/roster.csv`} download>
              <DownloadSimple size={16} weight="fill" />
              CSV 내려받기
            </a>
          </div>
          <SearchForm action={`/admin/${t.id}`} q={q} label="이름 · 이메일로 찾기" />
          <Card>
            <Card.Content>
              {signups.rows.length === 0 ? (
                <EmptyState>{q ? '찾는 신청자가 없어요.' : page > 1 ? '이 쪽에는 신청자가 없어요.' : '아직 신청한 사람이 없어요.'}</EmptyState>
              ) : (
                <ol className="list-none p-0">
                  {signups.rows.map((s, i) => (
                    <li
                      key={s.user_key}
                      className="flex flex-col gap-1 border-b border-default py-3 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="t-caption w-8 shrink-0 pt-0.5 tabular-nums">{(page - 1) * PAGE_SIZE + i + 1}</span>
                        <div className="min-w-0">
                          <p className="t-small flex flex-wrap items-center gap-2 font-semibold">
                            {s.user_name || s.user_email || '이름 없음'}
                            {s.user_key === visitor.user_id && <Chip size="sm">나</Chip>}
                          </p>
                          {s.user_name && s.user_email && <p className="t-caption break-all">{s.user_email}</p>}
                        </div>
                      </div>
                      <p className="t-caption pl-11 sm:pl-0">{formatDateTime(s.created_at)} 신청</p>
                    </li>
                  ))}
                </ol>
              )}
              <Pager basePath={`/admin/${t.id}`} q={q} page={page} hasNext={signups.hasMore} />
            </Card.Content>
          </Card>
        </section>

        <Card>
          <Card.Header>
            <Card.Title>교육 정보 수정</Card.Title>
            <Card.Description>일시를 바꾸면 신청 마감 시각도 같이 바뀌어요. 정원은 지금 신청한 인원보다 줄일 수 없어요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <TrainingForm
              training={{
                id: t.id,
                title: t.title,
                description: t.description,
                starts_at: toKstInput(t.starts_at),
                location: t.location,
                capacity: String(t.capacity),
              }}
            />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>교육 지우기</Card.Title>
            <Card.Description>취소된 교육이면 지워요. 신청자 명단도 함께 지워지니 필요하면 먼저 CSV 로 내려받아 두세요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <DeleteTrainingButton id={t.id} title={t.title} signed={t.signed} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
