import { notFound } from 'next/navigation'
import { Card } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DealForm } from '@/components/DealForm'
import { DbNotice, LoginCard } from '@/components/Notices'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { canDelete, formatDateTime } from '@/lib/pipeline'
import { getDeal } from '@/lib/pipeline-store'

export const dynamic = 'force-dynamic'

// 거래 고치기 · 지우기. 고치기는 로그인한 누구나, 지우기는 등록한 사람과 관리자만 (서버에서도 다시 확인해요).
export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d{1,18}$/.test(id)) notFound()
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="거래" desc="axhub 계정으로 로그인하면 거래를 보고 고칠 수 있어요." returnTo={`/deals/${id}`} />
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

  const deal = await getDeal(id)
  if (!deal) notFound()

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title={deal.company} description="거래 내용을 고치거나 단계를 바꿔요." backTo="/" backLabel="보드" />
        <Card>
          <Card.Content>
            <DealForm
              defaults={{
                id: deal.id,
                updated_at: deal.updated_at.toISOString(),
                company: deal.company,
                amount: BigInt(deal.amount).toLocaleString('ko-KR'),
                owner: deal.owner,
                expected_close: deal.expected_close,
                stage: deal.stage,
              }}
              canDelete={canDelete(visitor, deal.created_by_key)}
            />
          </Card.Content>
          <Card.Footer>
            <p className="t-caption">
              {formatDateTime(deal.created_at)} {deal.created_by_name}님이 등록
              {deal.updated_at.getTime() !== deal.created_at.getTime() &&
                ` · ${formatDateTime(deal.updated_at)} ${deal.updated_by_name}님이 마지막으로 바꿈`}
            </p>
          </Card.Footer>
        </Card>
      </div>
    </AppShell>
  )
}
