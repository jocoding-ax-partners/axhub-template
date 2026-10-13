import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, buttonVariants } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { ResponseForm } from '@/components/ResponseForm'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatDateTime, isManager } from '@/lib/survey'
import { getMyResponse, getSurvey } from '@/lib/survey-store'

export const dynamic = 'force-dynamic'

// 응답 화면 — 담당자가 보낸 링크(/s/번호)로 들어와요. 로그인한 사람은 누구나 열 수 있어요.
export default async function Respond({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d{1,18}$/.test(id)) notFound()

  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="설문 응답" desc="axhub 계정으로 로그인하면 이 설문에 응답할 수 있어요." returnTo={`/s/${id}`} />
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

  const [found, respondedAt] = await Promise.all([getSurvey(id), getMyResponse(id, visitor.user_id)])
  if (!found) notFound()
  const { survey, questions } = found

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title={survey.title}
          description={survey.description || '한 사람당 한 번 응답할 수 있어요.'}
          // 담당자에게만 제목 위에 "결과 보기" 링크가 보여요.
          backTo={isManager(visitor) ? `/admin/surveys/${id}` : undefined}
          backLabel="결과 보기"
        />

        {respondedAt ? (
          <Notice title="응답해 주셔서 고마워요" desc={`${formatDateTime(respondedAt)}에 응답했어요. 설문마다 한 번만 응답할 수 있어요.`} />
        ) : survey.status !== 'open' ? (
          <Notice title="마감된 설문이에요" desc="이 설문은 더 이상 응답을 받지 않아요. 궁금한 점은 설문 담당자에게 물어봐 주세요." />
        ) : questions.length === 0 ? (
          <Notice title="문항이 없는 설문이에요" desc="설문 담당자에게 알려 주세요." />
        ) : (
          <ResponseForm surveyId={id} questions={questions.map(({ id, kind, prompt, options }) => ({ id, kind, prompt, options }))} />
        )}
      </div>
    </AppShell>
  )
}

function Notice({ title, desc }: { title: string; desc: string }) {
  return (
    <Card className="items-center text-center">
      <Card.Header className="items-center">
        <Card.Title>{title}</Card.Title>
        <Card.Description>{desc}</Card.Description>
      </Card.Header>
      <Card.Footer className="justify-center">
        <Link className={buttonVariants({ variant: 'outline' })} href="/">
          다른 설문 보기
        </Link>
      </Card.Footer>
    </Card>
  )
}
