import { Button, Card, EmptyState, Input, TextField } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { ConfirmAction } from '@/components/ConfirmAction'
import { EquipmentForm } from '@/components/EquipmentForm'
import { EquipmentItem } from '@/components/EquipmentItem'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { isAdmin, kstToday } from '@/lib/rental'
import { listEquipment, type EquipmentRow } from '@/lib/rental-store'

export const dynamic = 'force-dynamic'

// 장비 관리 — 관리자(axhub 의 is_admin: 앱 소유자 · 워크스페이스 관리자)만 볼 수 있어요.
// 메뉴를 숨기는 것만으론 막히지 않으니, 화면과 Server Action(app/actions.ts) 양쪽에서 확인해요.
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="장비 관리" desc="관리자 계정으로 로그인하면 장비를 등록하고 관리할 수 있어요." returnTo="/admin" />
      </AppShell>
    )
  }
  if (!isAdmin(visitor)) {
    return (
      <AppShell>
        <Card className="mx-auto w-full max-w-xl items-center text-center">
          <Card.Header className="items-center">
            <h1 className="t-card-title">관리자만 볼 수 있어요</h1>
            <Card.Description>장비 등록 · 정리는 이 앱의 관리자만 할 수 있어요. 권한이 필요하면 앱 관리자에게 요청해 주세요.</Card.Description>
          </Card.Header>
        </Card>
      </AppShell>
    )
  }

  const today = kstToday()
  const dbReady = isDbConfigured()
  let rows: EquipmentRow[] = []
  let hasMore = false
  let total = 0
  if (dbReady) ({ rows, hasMore, total } = await listEquipment(q, 'all', page, today))

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="장비 관리" description="빌려줄 장비를 등록하고, 더 이상 빌려주지 않는 장비는 목록에서 빼요." />

        {!dbReady && <DbNotice />}

        <Card>
          <Card.Header>
            <Card.Title>장비 등록</Card.Title>
            <Card.Description>자산 번호는 장비마다 달라야 해요. 등록하면 바로 장비 목록에 보여요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <EquipmentForm />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>등록된 장비</Card.Title>
            <Card.Description>
              {q ? `"${q}" 로 찾은 장비가 ${total}대예요.` : `${total}대예요. 목록에서 빼도 지난 대여 기록은 남아요.`}
            </Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <form method="get" action="/admin" role="search" className="flex gap-2">
              <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="장비 검색" className="flex-1">
                <Input placeholder="이름 · 종류 · 자산 번호 · 빌린 사람으로 찾기" />
              </TextField>
              <Button type="submit" variant="outline">
                찾기
              </Button>
            </form>
            {rows.length === 0 ? (
              <EmptyState>
                {q ? '찾는 장비가 없어요.' : page > 1 ? '이 쪽에는 장비가 없어요.' : '아직 등록된 장비가 없어요. 위에서 첫 장비를 등록해 보세요.'}
              </EmptyState>
            ) : (
              <ul className="list-none p-0">
                {rows.map((item) => (
                  <EquipmentItem
                    key={item.id}
                    item={item}
                    today={today}
                    actions={
                      // 빌려 간 장비는 반납된 뒤에 뺄 수 있어요 (서버에서도 막아요).
                      !item.rental_id && (
                        <ConfirmAction
                          action="retire"
                          id={item.id}
                          label="목록에서 빼기"
                          danger
                          confirm={{
                            title: `${item.name}(${item.asset_no})을(를) 목록에서 뺄까요?`,
                            description: '더 이상 빌릴 수 없게 돼요. 지난 대여 기록은 남아요.',
                            confirmLabel: '빼기',
                            variant: 'danger',
                          }}
                        />
                      )
                    }
                  />
                ))}
              </ul>
            )}
            <Pager basePath="/admin" params={{ q }} page={page} hasNext={hasMore} />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
