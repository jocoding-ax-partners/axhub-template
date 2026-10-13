import Link from 'next/link'
import { Card, EmptyState, buttonVariants } from '@heroui/react'
import { ActionForm } from '@/components/ActionForm'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { ConfirmButton } from '@/components/ConfirmButton'
import { ExpenseForm } from '@/components/ExpenseForm'
import { ExpenseItem } from '@/components/ExpenseItem'
import { DbNotice, LoginNotice } from '@/components/Notice'
import { deleteExpense } from '@/app/actions'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { todayKst, won } from '@/lib/expense-utils'
import { isAppAdmin, listMyExpenses } from '@/lib/expenses'
import { isStorageConfigured } from '@/lib/storage'

export const dynamic = 'force-dynamic'

// 내 경비 — 경비를 올리고, 내가 올린 경비의 처리 상태를 봐요.
export default async function MyExpensesPage() {
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginNotice returnTo="/" />
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

  const mine = await listMyExpenses(visitor.user_id)
  const pending = mine.filter((e) => e.status === 'pending')

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="내 경비"
          description="쓴 경비를 올리면 관리자가 확인하고 승인하거나 반려해요."
          actions={
            isAppAdmin(visitor) && (
              <Link className={buttonVariants({ variant: 'outline' })} href="/admin">
                승인 · 정산으로 가기
              </Link>
            )
          }
        />

        <Card>
          <Card.Header>
            <Card.Title>경비 올리기</Card.Title>
            <Card.Description>사용일 · 항목 · 금액은 꼭 넣어 주세요. 영수증 사진을 함께 올리면 확인이 빨라요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <ExpenseForm today={todayKst()} storageReady={isStorageConfigured()} />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="flex-row flex-wrap items-baseline justify-between gap-2">
            <Card.Title>올린 경비</Card.Title>
            {pending.length > 0 && (
              <p className="t-caption">
                확인 기다리는 중 {pending.length}건 · {won(pending.reduce((s, e) => s + e.amount, 0))}
              </p>
            )}
          </Card.Header>
          <Card.Content>
            {mine.length === 0 ? (
              <EmptyState>아직 올린 경비가 없어요. 위에서 첫 경비를 올려 보세요.</EmptyState>
            ) : (
              <ul className="list-none p-0">
                {mine.map((e) => (
                  <ExpenseItem
                    key={e.id}
                    expense={e}
                    actions={
                      e.status !== 'approved' && (
                        <ActionForm action={deleteExpense}>
                          <input type="hidden" name="id" value={e.id} />
                          <ConfirmButton
                            danger
                            confirm={{ title: '이 경비를 지울까요?', description: '지우면 되돌릴 수 없어요.', confirmLabel: '지우기', variant: 'danger' }}
                          >
                            지우기
                          </ConfirmButton>
                        </ActionForm>
                      )
                    }
                  />
                ))}
              </ul>
            )}
            {mine.length >= 200 && <p className="t-caption mt-3 text-subtle">최근 200건까지 보여요.</p>}
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
