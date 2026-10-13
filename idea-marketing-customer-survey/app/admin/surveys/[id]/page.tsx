import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { Card, Chip, EmptyState, Meter, buttonVariants } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard, StatusDot } from '@/components/ax'
import { DbNotice, LoginCard, ManagerOnly } from '@/components/Notices'
import { ShareLink, SurveyActions } from '@/components/SurveyActions'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { KIND_LABEL, STATUS_LABEL, formatDateTime, isManager, percent } from '@/lib/survey'
import { getResults, getSurvey } from '@/lib/survey-store'

export const dynamic = 'force-dynamic'

// 설문 결과 — 객관식은 보기별 응답 비율 막대, 주관식은 최근 답 목록. 담당자만 볼 수 있어요.
export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d{1,18}$/.test(id)) notFound()

  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="설문 결과" desc="관리자 계정으로 로그인하면 설문 결과를 볼 수 있어요." returnTo={`/admin/surveys/${id}`} />
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
  if (!isDbConfigured()) {
    return (
      <AppShell>
        <DbNotice />
      </AppShell>
    )
  }

  const found = await getSurvey(id)
  if (!found) notFound()
  const { survey, questions } = found
  const results = await getResults(id, questions)

  // 응답 링크 = 지금 이 화면을 연 앱 주소 + /s/번호. 프록시 뒤라 x-forwarded-* 를 먼저 봐요.
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const shareUrl = `${h.get('x-forwarded-proto') ?? 'https'}://${host}/s/${id}`

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title={survey.title}
          description={survey.description || `${formatDateTime(survey.created_at)}에 ${survey.created_by_name || '담당자'}님이 만들었어요.`}
          backTo="/admin"
          backLabel="설문 관리"
        />

        <section aria-label="요약" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="응답한 사람" value={<span className="text-primary">{results.total}명</span>} sub="한 사람당 한 번" />
          <StatCard label="문항" value={`${questions.length}개`} sub={`객관식 ${questions.filter((q) => q.kind === 'choice').length} · 주관식 ${questions.filter((q) => q.kind === 'text').length}`} />
          <StatCard
            label="상태"
            value={<StatusDot tone={survey.status === 'open' ? 'active' : 'muted'}>{STATUS_LABEL[survey.status]}</StatusDot>}
            sub={survey.closed_at ? `${formatDateTime(survey.closed_at)} 마감` : '링크로 응답을 받고 있어요'}
          />
        </section>

        <Card>
          <Card.Header>
            <Card.Title>응답 받기</Card.Title>
            <Card.Description>
              {survey.status === 'open'
                ? '아래 링크를 직원들에게 보내 주세요. axhub 로 로그인한 사람만 응답할 수 있어요.'
                : '마감한 설문이에요. 다시 열면 같은 링크로 응답을 받아요.'}
            </Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-3">
            <ShareLink url={shareUrl} />
            <div>
              <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} href={`/s/${id}`}>
                응답 화면 미리 보기
              </Link>
            </div>
          </Card.Content>
          <Card.Footer>
            <SurveyActions id={id} title={survey.title} status={survey.status} />
          </Card.Footer>
        </Card>

        <section className="flex flex-col gap-4">
          <h2 className="t-section-title">문항별 결과</h2>
          {results.questions.map((q, i) => (
            <Card key={q.id}>
              <Card.Header>
                <Card.Title className="flex flex-wrap items-center gap-2 break-words">
                  {i + 1}. {q.prompt}
                  <Chip size="sm">{KIND_LABEL[q.kind]}</Chip>
                </Card.Title>
                <Card.Description>답한 사람 {q.answered}명</Card.Description>
              </Card.Header>
              <Card.Content>
                {q.kind === 'choice' ? (
                  <ul className="flex list-none flex-col gap-4 p-0">
                    {q.options.map((o, j) => {
                      const pct = percent(o.count, q.answered)
                      return (
                        <li key={j} className="flex flex-col gap-1.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="t-small min-w-0 break-words">{o.label}</span>
                            <span className="t-small shrink-0 tabular-nums">
                              <span className="font-semibold">{pct}%</span> <span className="text-muted">· {o.count}명</span>
                            </span>
                          </div>
                          <Meter aria-label={`${o.label} 응답 비율`} value={pct} size="md">
                            <Meter.Track>
                              <Meter.Fill />
                            </Meter.Track>
                          </Meter>
                        </li>
                      )
                    })}
                  </ul>
                ) : q.latest.length === 0 ? (
                  <EmptyState>아직 답이 없어요.</EmptyState>
                ) : (
                  <div className="flex flex-col gap-3">
                    <ul className="list-none p-0">
                      {q.latest.map((text, j) => (
                        <li key={j} className="t-small whitespace-pre-wrap break-words border-b border-default py-3 first:pt-0 last:border-0 last:pb-0">
                          {text}
                        </li>
                      ))}
                    </ul>
                    {q.answered > q.latest.length && (
                      <div>
                        <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`/admin/surveys/${id}/questions/${q.id}`}>
                          답 {q.answered}개 모두 보기
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </Card.Content>
            </Card>
          ))}
        </section>
      </div>
    </AppShell>
  )
}
