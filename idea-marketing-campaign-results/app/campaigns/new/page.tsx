import { Card } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { CampaignForm } from '@/components/CampaignForm'
import { DbNotice, LoginCard } from '@/components/Notices'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function NewCampaignPage() {
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="새 캠페인" desc="axhub 계정으로 로그인하면 캠페인을 등록할 수 있어요." returnTo="/campaigns/new" />
      </AppShell>
    )
  }
  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="새 캠페인" description="캠페인을 등록한 뒤 상세 화면에서 날짜별 노출·클릭·전환을 적어요." />
        {!isDbConfigured() && <DbNotice />}
        <Card>
          <Card.Header>
            <Card.Title>캠페인 정보</Card.Title>
            <Card.Description>기간은 최대 366일이에요. 등록한 사람과 관리자만 나중에 고치거나 지울 수 있어요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <CampaignForm />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
