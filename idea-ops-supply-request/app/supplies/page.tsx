import { Button, Card, EmptyState, Input, TextField } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { EditSupplyForm, ReceiveForm, SupplyForm } from '@/components/forms'
import { AdminOnlyCard, DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { SupplyItem } from '@/components/SupplyItem'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { isAdmin } from '@/lib/supply'
import { listSupplies, type SupplyRow } from '@/lib/supply-store'

export const dynamic = 'force-dynamic'

// 비품 관리 — 등록 · 입고 · 이름/최소 재고 고치기. 관리자만 (화면과 app/actions.ts 양쪽에서 확인해요).
export default async function SuppliesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="비품 관리" desc="관리자 계정으로 로그인하면 비품을 등록하고 입고할 수 있어요." returnTo="/supplies" />
      </AppShell>
    )
  }
  if (!isAdmin(visitor)) {
    return (
      <AppShell>
        <AdminOnlyCard desc="비품 등록·입고는 이 앱의 관리자만 할 수 있어요." />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let rows: SupplyRow[] = []
  let hasMore = false
  let total = 0
  if (dbReady) ({ rows, hasMore, total } = await listSupplies(q, page))

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="비품 관리" description="비품을 등록하고, 들어온 수량만큼 입고해요. 재고가 최소 재고 아래로 내려가면 「부족」으로 표시돼요." />

        {!dbReady && <DbNotice />}

        <Card>
          <Card.Header>
            <Card.Title>비품 등록</Card.Title>
            <Card.Description>최소 재고를 0 으로 두면 「부족」 표시를 하지 않아요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <SupplyForm />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>재고 · 입고</Card.Title>
            <Card.Description>{q ? `"${q}" 로 찾은 비품이 ${total}종이에요.` : '재고가 부족한 비품이 맨 위예요. 입고 수량을 적으면 재고에 더해져요.'}</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <form method="get" action="/supplies" role="search" className="flex gap-2">
              <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="비품 이름 검색" className="flex-1">
                <Input placeholder="비품 이름으로 찾기" />
              </TextField>
              <Button type="submit" variant="outline">
                찾기
              </Button>
            </form>

            {rows.length === 0 ? (
              <EmptyState>{q ? '찾는 비품이 없어요.' : page > 1 ? '이 쪽에는 비품이 없어요.' : '아직 등록된 비품이 없어요. 위에서 첫 비품을 등록해 보세요.'}</EmptyState>
            ) : (
              <ul className="list-none p-0">
                {rows.map((item) => (
                  <SupplyItem
                    key={item.id}
                    item={item}
                    actions={<ReceiveForm id={item.id} name={item.name} />}
                    below={<EditSupplyForm id={item.id} name={item.name} minStock={item.min_stock} />}
                  />
                ))}
              </ul>
            )}
            <Pager basePath="/supplies" q={q} page={page} hasNext={hasMore} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
