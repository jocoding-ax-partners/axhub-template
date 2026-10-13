import { Card } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DealForm } from '@/components/DealForm'
import { DbNotice, LoginCard } from '@/components/Notices'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { stageOf } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

// 새 거래. ?stage=proposal 처럼 주면 그 단계로 시작해요.
export default async function NewDealPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const stage = stageOf((await searchParams).stage) ?? 'contact'
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="새 거래" desc="axhub 계정으로 로그인하면 거래 카드를 만들 수 있어요." returnTo="/deals/new" />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="새 거래" description="고객사와 예상 금액을 적으면 보드의 단계 열에 카드로 놓여요." backTo="/" backLabel="보드" />
        {!isDbConfigured() && <DbNotice />}
        <Card>
          <Card.Content>
            <DealForm defaults={{ company: '', amount: '', owner: visitor.name || visitor.email, expected_close: null, stage }} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
