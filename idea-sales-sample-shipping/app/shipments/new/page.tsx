import { Card } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { ShipmentForm } from '@/components/ShipmentForm'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { CUSTOMER_MAX, kstToday, normalizeName } from '@/lib/shipment'
import { listCustomerNames } from '@/lib/shipment-store'

export const dynamic = 'force-dynamic'

/** 새 발송 기록. ?customer= 로 들어오면 고객사 칸을 미리 채워요 (고객사 이력 화면의 버튼). */
export default async function NewShipmentPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const customer = normalizeName((await searchParams).customer ?? '').slice(0, CUSTOMER_MAX)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="발송 기록하기" desc="axhub 계정으로 로그인하면 보낸 샘플·자료를 기록할 수 있어요." returnTo="/shipments/new" />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  const customers = dbReady ? await listCustomerNames() : []

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="발송 기록하기"
          description="누구에게 무엇을 언제 보냈는지 적어 두세요. 후속 연락 예정일을 잡으면 그날 홈에서 알려 줘요."
          backTo="/shipments"
          backLabel="발송 기록"
        />

        {!dbReady && <DbNotice />}

        <Card>
          <Card.Content>
            <ShipmentForm today={kstToday()} customers={customers} defaultCustomer={customer} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
