import Link from 'next/link'
import { Button, Card, EmptyState, Input, TextField, buttonVariants } from '@heroui/react'
import { Plus } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { ScopeTabs, ShipmentList } from '@/components/ShipmentList'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { kstToday } from '@/lib/shipment'
import { listShipments, type Shipment } from '@/lib/shipment-store'

export const dynamic = 'force-dynamic'

/** 발송 기록 전체 — 최근에 보낸 것부터. 고객사 · 담당자 · 보낸 것 · 메모로 찾아요. */
export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mine?: string; page?: string }>
}) {
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 50)
  const mine = params.mine === '1'
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="발송 기록" desc="axhub 계정으로 로그인하면 팀의 발송 기록을 볼 수 있어요." returnTo="/shipments" />
      </AppShell>
    )
  }

  const today = kstToday()
  const dbReady = isDbConfigured()
  let rows: Shipment[] = []
  let hasMore = false
  let total = 0
  if (dbReady) ({ rows, hasMore, total } = await listShipments(q, mine ? visitor.user_id : null, page))

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="발송 기록"
          description={q ? `"${q}" 로 찾은 발송이 ${total}건이에요.` : `${mine ? '내가 기록한' : '팀이 기록한'} 발송이 ${total}건 있어요.`}
          actions={
            <Link className={buttonVariants({ variant: 'primary' })} href="/shipments/new">
              <Plus size={16} weight="fill" />
              발송 기록하기
            </Link>
          }
        />

        {!dbReady && <DbNotice />}

        <section className="flex flex-col gap-4">
          <ScopeTabs basePath="/shipments" mine={mine} q={q} />
          <form method="get" action="/shipments" role="search" className="flex gap-2">
            {mine && <input type="hidden" name="mine" value="1" />}
            <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="발송 기록 검색" className="flex-1">
              <Input placeholder="고객사 · 담당자 · 보낸 것으로 찾기" />
            </TextField>
            <Button type="submit" variant="outline">
              찾기
            </Button>
          </form>
          <Card>
            <Card.Content>
              {rows.length === 0 ? (
                <EmptyState>
                  {q
                    ? '찾는 발송 기록이 없어요. 다른 글자로 찾아보세요.'
                    : page > 1
                      ? '이 쪽에는 발송 기록이 없어요.'
                      : '아직 기록한 발송이 없어요. 오른쪽 위 "발송 기록하기" 로 시작해 보세요.'}
                </EmptyState>
              ) : (
                <ShipmentList rows={rows} today={today} visitor={visitor} />
              )}
              <Pager basePath="/shipments" params={{ q, mine: mine ? '1' : '' }} page={page} hasNext={hasMore} />
            </Card.Content>
          </Card>
        </section>
      </div>
    </AppShell>
  )
}
