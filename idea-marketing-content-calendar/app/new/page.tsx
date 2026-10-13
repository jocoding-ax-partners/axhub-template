import { Card } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { ContentForm } from '@/components/ContentForm'
import { DbNotice, LoginCard } from '@/components/Notices'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { OWNER_MAX, kstToday, parseDate } from '@/lib/content'

export const dynamic = 'force-dynamic'

// 콘텐츠 등록. ?date=YYYY-MM-DD 로 들어오면 발행 예정일을 그 날로 채워 둬요.
export default async function NewPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="콘텐츠 등록" desc="axhub 계정으로 로그인하면 콘텐츠 발행 일정을 등록할 수 있어요." returnTo="/new" />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="콘텐츠 등록" description="등록하면 달력의 발행 예정일 칸에 채널 색으로 나타나요." backTo="/" backLabel="달력" />
        {!isDbConfigured() && <DbNotice />}
        <Card>
          <Card.Content>
            <ContentForm
              initial={{
                title: '',
                channel: 'blog',
                publish_date: date && parseDate(date) ? date : kstToday(),
                owner: (visitor.name || visitor.email).slice(0, OWNER_MAX),
                status: 'planning',
                memo: '',
              }}
            />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
