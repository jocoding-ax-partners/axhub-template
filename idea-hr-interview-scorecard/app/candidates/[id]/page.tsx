import { notFound } from 'next/navigation'
import { Card, EmptyState } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatusDot } from '@/components/ax'
import { CandidateForm, DeleteCandidateButton, ResultForm } from '@/components/Forms'
import { DbNotice, LoginCard, RecruiterOnlyCard } from '@/components/Notices'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { CRITERIA, RESULT_LABEL, RESULT_TONE, formatDateTime, formatScore, isRecruiter, overall, toKstLocal } from '@/lib/interview'
import { getCandidate } from '@/lib/interview-store'

export const dynamic = 'force-dynamic'

const average = (xs: number[]): number | null => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length)

// 지원자 상세 — 면접관 점수 평균과 의견을 모아 보고 결과를 기록해요. 채용 담당자만 볼 수 있어요.
export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="지원자 상세" desc="채용 담당자 계정으로 로그인하면 면접관 평가를 모아 볼 수 있어요." returnTo={`/candidates/${id}`} />
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
  if (!isDbConfigured()) {
    return (
      <AppShell>
        <DbNotice />
      </AppShell>
    )
  }
  if (!/^\d{1,18}$/.test(id)) notFound()
  const found = await getCandidate(id)
  if (!found) notFound()
  const { candidate: c, scorecards } = found

  const submitted = new Set(scorecards.map((s) => s.interviewer_email))
  const waiting = c.interviewers.filter((e) => !submitted.has(e))
  const averages = [
    ...CRITERIA.map((k) => ({ label: k.label, value: average(scorecards.map((s) => s[k.key])) })),
    { label: '종합', value: average(scorecards.map(overall)) },
  ]

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          backTo="/candidates"
          backLabel="지원자 관리"
          title={c.name}
          description={`${c.position} · ${formatDateTime(c.interview_at)}`}
          actions={
            <span className="t-small">
              {c.result ? <StatusDot tone={RESULT_TONE[c.result]}>{RESULT_LABEL[c.result]}</StatusDot> : <StatusDot tone="warning">결과 대기</StatusDot>}
            </span>
          }
        />

        <Card>
          <Card.Header>
            <Card.Title>평균 점수</Card.Title>
            <Card.Description>
              면접관 {c.interviewers.length}명 중 {scorecards.length}명이 평가를 냈어요. 항목마다 1~5점이고, 종합은 세 항목의 평균이에요.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {averages.map((a, i) => (
                <div key={a.label} className="rounded-card border border-default p-4">
                  <dt className="t-caption">{a.label}</dt>
                  <dd className={i === averages.length - 1 ? 't-page-title mt-1 text-primary' : 't-page-title mt-1'}>{formatScore(a.value)}</dd>
                </div>
              ))}
            </dl>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>면접관 의견</Card.Title>
            <Card.Description>면접관끼리는 서로의 평가를 볼 수 없어요. 여기서만 모아 보여요.</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            {scorecards.length === 0 ? (
              <EmptyState>아직 제출된 평가가 없어요. 면접관이 「내 면접」 에서 평가를 내면 여기에 모여요.</EmptyState>
            ) : (
              <ul className="list-none p-0">
                {scorecards.map((s) => (
                  <li key={s.interviewer_email} className="flex flex-col gap-2 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="t-small min-w-0 font-semibold break-all">
                        {s.interviewer_name || s.interviewer_email}
                        {s.interviewer_name && <span className="t-caption ml-2 font-normal">{s.interviewer_email}</span>}
                      </p>
                      <p className="t-caption">{formatDateTime(s.updated_at)}</p>
                    </div>
                    <p className="t-small flex flex-wrap gap-x-3 text-muted">
                      {CRITERIA.map((k) => (
                        <span key={k.key}>
                          {k.label} {s[k.key]}
                        </span>
                      ))}
                      <span className="font-semibold text-default">종합 {formatScore(overall(s))}</span>
                    </p>
                    <p className="t-small whitespace-pre-wrap break-words">{s.comment}</p>
                  </li>
                ))}
              </ul>
            )}
            {waiting.length > 0 && (
              <div className="t-small flex flex-wrap items-center gap-x-3 gap-y-1">
                <StatusDot tone="warning">평가 전</StatusDot>
                <span className="break-all text-muted">{waiting.join(', ')}</span>
              </div>
            )}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>결과 기록</Card.Title>
            <Card.Description>
              {c.result && c.result_at
                ? `${formatDateTime(c.result_at)} ${c.result_by ?? ''}님이 ${RESULT_LABEL[c.result]}(으)로 기록했어요. 기록하면 면접관은 평가를 고칠 수 없어요.`
                : '합격 · 보류 · 불합격 중에서 골라요. 기록하면 면접관은 평가를 고칠 수 없어요.'}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <ResultForm id={c.id} name={c.name} current={c.result} scored={scorecards.length} total={c.interviewers.length} />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>지원자 정보 고치기</Card.Title>
            <Card.Description>
              면접 일정이 바뀌면 여기서 고쳐요. 평가를 이미 낸 면접관은 뺄 수 없어요. {formatDateTime(c.created_at)} {c.created_by}님이 등록했어요.
            </Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-6">
            <CandidateForm
              defaults={{ id: c.id, name: c.name, position: c.position, interviewAt: toKstLocal(c.interview_at), interviewers: c.interviewers }}
            />
            <div className="border-t border-default pt-6">
              <DeleteCandidateButton id={c.id} name={c.name} scored={scorecards.length} />
            </div>
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
