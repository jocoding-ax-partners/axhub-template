import { notFound } from 'next/navigation'
import { Alert, Card } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatusDot } from '@/components/ax'
import { ScoreForm } from '@/components/Forms'
import { DbNotice, LoginCard } from '@/components/Notices'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { CRITERIA, formatDateTime, formatScore, normalizeEmail, overall } from '@/lib/interview'
import { getMyScorecard } from '@/lib/interview-store'

export const dynamic = 'force-dynamic'

// 면접관 한 명의 평가표. 내가 면접관으로 배정된 지원자만 열려요 (아니면 404 — 있는지조차 알리지 않아요).
// 다른 면접관의 점수는 여기서 보이지 않아요 — 서로의 점수에 끌리지 않게, 모아 보기는 채용 담당자만 해요.
export default async function ScorecardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="면접 평가" desc="axhub 계정으로 로그인하면 맡은 면접의 평가를 남길 수 있어요." returnTo={`/interviews/${id}`} />
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
  const email = normalizeEmail(visitor.email)
  if (!/^\d{1,18}$/.test(id) || !email) notFound()
  const found = await getMyScorecard(id, email)
  if (!found) notFound()
  const { candidate: c, score } = found

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          backTo="/"
          backLabel="내 면접"
          title={`${c.name} 평가`}
          description={`${c.position} · ${formatDateTime(c.interview_at)}`}
        />

        {c.result ? (
          <Card>
            <Card.Header>
              <Card.Title>내 평가</Card.Title>
              <Card.Description>결과가 기록돼서 평가를 더 고칠 수 없어요.</Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-4">
              {score ? (
                <>
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {CRITERIA.map((k) => (
                      <div key={k.key} className="rounded-card border border-default p-4">
                        <dt className="t-caption">{k.label}</dt>
                        <dd className="t-card-title mt-1">{score[k.key]}점</dd>
                      </div>
                    ))}
                    <div className="rounded-card border border-default p-4">
                      <dt className="t-caption">종합</dt>
                      <dd className="t-card-title mt-1 text-primary">{formatScore(overall(score))}</dd>
                    </div>
                  </dl>
                  <p className="t-small whitespace-pre-wrap break-words">{score.comment}</p>
                </>
              ) : (
                <StatusDot tone="muted">평가를 내지 않았어요.</StatusDot>
              )}
            </Card.Content>
          </Card>
        ) : (
          <Card>
            <Card.Header>
              <Card.Title>평가표</Card.Title>
              <Card.Description>
                항목마다 1점(아쉬움)부터 5점(매우 좋음)까지 골라요. 내 평가는 채용 담당자만 보고, 다른 면접관에게는 보이지 않아요.
              </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-6">
              {score && (
                <Alert status="success">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>
                      {formatDateTime(score.updated_at)}에 제출했어요. 결과가 기록되기 전까지 고칠 수 있어요.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
              <ScoreForm
                id={c.id}
                initial={
                  score && {
                    job_skill: score.job_skill,
                    communication: score.communication,
                    culture_fit: score.culture_fit,
                    comment: score.comment,
                  }
                }
              />
            </Card.Content>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
