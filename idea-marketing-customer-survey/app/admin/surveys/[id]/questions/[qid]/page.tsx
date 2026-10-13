import { notFound } from 'next/navigation'
import { Button, Card, EmptyState, Input, TextField } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DbNotice, LoginCard, ManagerOnly } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatDateTime, isManager } from '@/lib/survey'
import { getSurvey, listTextAnswers } from '@/lib/survey-store'

export const dynamic = 'force-dynamic'

// 주관식 한 문항의 답 전부 — 쪽으로 나눠 보고, 글자로 찾아요. 담당자만 볼 수 있어요.
export default async function TextAnswersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; qid: string }>
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { id, qid } = await params
  if (!/^\d{1,18}$/.test(id) || !/^\d{1,18}$/.test(qid)) notFound()
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 50)
  const page = pageOf(sp.page)
  const basePath = `/admin/surveys/${id}/questions/${qid}`

  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="주관식 답" desc="관리자 계정으로 로그인하면 설문 결과를 볼 수 있어요." returnTo={basePath} />
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
  const index = found?.questions.findIndex((x) => x.id === qid) ?? -1
  if (!found || index < 0 || found.questions[index].kind !== 'text') notFound()
  const question = found.questions[index]
  const { rows, hasMore, total } = await listTextAnswers(qid, q, page)

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title={`${index + 1}. ${question.prompt}`}
          description={q ? `"${q}" 가 들어간 답이 ${total}개예요.` : `${found.survey.title} · 답 ${total}개`}
          backTo={`/admin/surveys/${id}`}
          backLabel="결과로 돌아가기"
        />

        <Card>
          <Card.Header>
            <Card.Title>주관식 답</Card.Title>
            <Card.Description>최근 답이 먼저 보여요. 누가 적었는지는 보이지 않아요.</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <form method="get" action={basePath} role="search" className="flex gap-2">
              <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="답 내용 검색" className="flex-1">
                <Input placeholder="답에 들어간 글자로 찾기" />
              </TextField>
              <Button type="submit" variant="outline">
                찾기
              </Button>
            </form>
            {rows.length === 0 ? (
              <EmptyState>{q ? '찾는 글자가 들어간 답이 없어요.' : page > 1 ? '이 쪽에는 답이 없어요.' : '아직 답이 없어요.'}</EmptyState>
            ) : (
              <ul className="list-none p-0">
                {rows.map((a) => (
                  <li key={a.response_id} className="border-b border-default py-3 first:pt-0 last:border-0 last:pb-0">
                    <p className="t-small whitespace-pre-wrap break-words">{a.text_value}</p>
                    <p className="t-caption mt-1">{formatDateTime(a.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
            <Pager basePath={basePath} q={q} page={page} hasNext={hasMore} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
