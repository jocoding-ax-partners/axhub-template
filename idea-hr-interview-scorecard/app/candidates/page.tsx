import Link from 'next/link'
import { Button, Card, EmptyState, Input, TextField, buttonVariants } from '@heroui/react'
import { CaretRight } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatusDot } from '@/components/ax'
import { CandidateForm } from '@/components/Forms'
import { DbNotice, LoginCard, RecruiterOnlyCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { RESULT_LABEL, RESULT_TONE, formatDateTime, formatScore, isRecruiter } from '@/lib/interview'
import { RESULT_FILTERS, listCandidates, type ResultFilter } from '@/lib/interview-store'

export const dynamic = 'force-dynamic'

const FILTER_LABEL: Record<ResultFilter, string> = { all: '전체', waiting: '결과 대기', ...RESULT_LABEL }

// 지원자 관리 — 채용 담당자(axhub 의 is_admin: 앱 소유자 · 워크스페이스 관리자)만 볼 수 있어요.
// 메뉴를 숨기는 것만으론 막히지 않으니, 화면과 Server Action(app/actions.ts) 양쪽에서 확인해요.
export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ q?: string; result?: string; page?: string }> }) {
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 50)
  const filter: ResultFilter = (RESULT_FILTERS as readonly string[]).includes(params.result ?? '') ? (params.result as ResultFilter) : 'all'
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="지원자 관리" desc="채용 담당자 계정으로 로그인하면 지원자를 등록하고 평가를 모아 볼 수 있어요." returnTo="/candidates" />
      </AppShell>
    )
  }
  if (!isRecruiter(visitor)) {
    return (
      <AppShell>
        <RecruiterOnlyCard />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  const found = dbReady
    ? await listCandidates(q, filter, page)
    : { rows: [], hasMore: false, counts: { all: 0, waiting: 0, pass: 0, hold: 0, fail: 0 } }
  const filterHref = (f: ResultFilter) => {
    const qs = new URLSearchParams(Object.entries({ q, result: f === 'all' ? '' : f }).filter(([, v]) => v)).toString()
    return qs ? `/candidates?${qs}` : '/candidates'
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="지원자 관리"
          description={
            found.counts.waiting > 0 ? `결과를 기다리는 지원자가 ${found.counts.waiting}명 있어요.` : '지원자를 등록하고 면접관 평가를 모아 봐요.'
          }
        />

        {!dbReady && <DbNotice />}

        <Card>
          <Card.Header>
            <Card.Title>지원자 등록</Card.Title>
            <Card.Description>등록하면 적은 면접관의 「내 면접」 에 바로 보여요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <CandidateForm />
          </Card.Content>
        </Card>

        <section className="flex flex-col gap-4">
          <h2 className="t-section-title">지원자 목록</h2>
          <form method="get" action="/candidates" role="search" className="flex gap-2">
            {filter !== 'all' && <input type="hidden" name="result" value={filter} />}
            <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="이름 · 지원 직무 검색" className="flex-1">
              <Input placeholder="이름 · 지원 직무로 찾기" />
            </TextField>
            <Button type="submit" variant="outline">
              찾기
            </Button>
          </form>
          <nav aria-label="결과로 거르기" className="flex flex-wrap gap-2">
            {RESULT_FILTERS.map((f) => (
              <Link
                key={f}
                href={filterHref(f)}
                aria-current={f === filter ? 'page' : undefined}
                className={buttonVariants({ variant: f === filter ? 'primary' : 'outline', size: 'sm' })}
              >
                {FILTER_LABEL[f]} {found.counts[f]}
              </Link>
            ))}
          </nav>
          <Card>
            <Card.Content>
              {found.rows.length === 0 ? (
                <EmptyState>
                  {q
                    ? `"${q}" 로 찾은 지원자가 없어요.`
                    : filter !== 'all'
                      ? `${FILTER_LABEL[filter]}인 지원자가 없어요.`
                      : page > 1
                        ? '이 쪽에는 지원자가 없어요.'
                        : '아직 등록된 지원자가 없어요. 위에서 첫 지원자를 등록해 보세요.'}
                </EmptyState>
              ) : (
                <ul className="list-none p-0">
                  {found.rows.map((r) => (
                    <li key={r.id} className="border-b border-default last:border-0">
                      <Link href={`/candidates/${r.id}`} className="flex items-center justify-between gap-3 py-4 hover:bg-muted sm:px-2">
                        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                          <div className="min-w-0">
                            <p className="t-small font-semibold break-words">
                              {r.name} <span className="font-normal text-muted">· {r.position}</span>
                            </p>
                            <p className="t-caption mt-1">{formatDateTime(r.interview_at)}</p>
                          </div>
                          <p className="t-small flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-muted">
                              평가 {r.scored}/{r.interviewer_count}
                            </span>
                            <span className="text-muted">종합 {formatScore(r.overall)}</span>
                            {r.result ? (
                              <StatusDot tone={RESULT_TONE[r.result]}>{RESULT_LABEL[r.result]}</StatusDot>
                            ) : (
                              <StatusDot tone="warning">결과 대기</StatusDot>
                            )}
                          </p>
                        </div>
                        <CaretRight size={16} weight="fill" className="shrink-0 text-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Pager basePath="/candidates" params={{ q, result: filter === 'all' ? '' : filter }} page={page} hasNext={found.hasMore} />
            </Card.Content>
          </Card>
        </section>
      </div>
    </AppShell>
  )
}
