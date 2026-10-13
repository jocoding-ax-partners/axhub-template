import { notFound } from 'next/navigation'
import { Card } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { CampaignForm } from '@/components/CampaignForm'
import { DbNotice, LoginCard } from '@/components/Notices'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { canEdit } from '@/lib/campaign'
import { getCampaign } from '@/lib/campaign-store'

export const dynamic = 'force-dynamic'

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="캠페인 고치기" desc="axhub 계정으로 로그인하면 캠페인 정보를 고칠 수 있어요." returnTo={`/campaigns/${id}/edit`} />
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
  const c = await getCampaign(id)
  if (!c) notFound()
  if (!canEdit(visitor, c.owner_key)) {
    return (
      <AppShell>
        <Card className="mx-auto w-full max-w-xl items-center text-center">
          <Card.Header className="items-center">
            <h1 className="t-card-title">고칠 수 없는 캠페인이에요</h1>
            <Card.Description>캠페인은 등록한 사람({c.owner_name || '알 수 없음'})과 관리자만 고칠 수 있어요.</Card.Description>
          </Card.Header>
        </Card>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="캠페인 고치기" description={c.name} />
        <Card>
          <Card.Header>
            <Card.Title>캠페인 정보</Card.Title>
            <Card.Description>기간을 줄이면 바뀐 기간 밖의 날짜별 기록을 먼저 지워야 해요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <CampaignForm
              campaign={{ id: c.id, name: c.name, channel: c.channel, start_date: c.start_date, end_date: c.end_date, cost: c.cost }}
            />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
