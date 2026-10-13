import { Card } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { RequestForm } from '@/components/RequestForm'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { DUE_MAX_DAYS, addDays, kstToday } from '@/lib/design'
import { isStorageConfigured } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export default async function NewRequest() {
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="새 디자인 요청" desc="axhub 계정으로 로그인하면 디자인을 요청할 수 있어요." returnTo="/new" />
      </AppShell>
    )
  }

  const today = kstToday()
  const maxDue = addDays(today, DUE_MAX_DAYS)

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="새 디자인 요청" description="필요한 디자인을 적어 보내면 디자이너가 맡아서 작업해요." backTo="/" backLabel="내 요청" />

        {!isDbConfigured() && <DbNotice />}

        <Card>
          <Card.Header>
            <Card.Title>요청 내용</Card.Title>
            <Card.Description>크기와 문구를 자세히 적을수록 다시 묻는 일이 줄어요. 참고 이미지가 있으면 함께 올려 주세요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <RequestForm today={today} maxDue={maxDue} storageReady={isStorageConfigured()} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
