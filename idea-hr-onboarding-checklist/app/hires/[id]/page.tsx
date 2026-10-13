import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, EmptyState, buttonVariants } from '@heroui/react'
import { ArrowLeft } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { ChecklistItem, DeleteHireButton, FlashToast, HireForm } from '@/components/OnboardingForms'
import { Progress } from '@/components/Progress'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatDate, formatDateTime, isAdmin, startLabel } from '@/lib/onboarding'
import { getHire } from '@/lib/onboarding-store'

export const dynamic = 'force-dynamic'

// 입사자 한 명의 체크리스트 — 로그인한 사람은 누구나 체크·메모하고 정보를 고칠 수 있어요. 삭제는 관리자만.
export default async function HirePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const { id } = await params
  const { created } = await searchParams
  if (!/^\d{1,18}$/.test(id)) notFound()
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="입사자 체크리스트" desc="axhub 계정으로 로그인하면 이 입사자의 체크리스트를 볼 수 있어요." returnTo={`/hires/${id}`} />
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

  const found = await getHire(id)
  if (!found) notFound()
  const { hire, items } = found
  const done = items.filter((i) => i.done).length

  return (
    <AppShell>
      {created === '1' && <FlashToast message={`${hire.name}님을 등록했어요. 체크리스트 ${items.length}개가 붙었어요.`} />}
      <div className="flex flex-col gap-10">
        <PageHeader
          title={hire.name}
          description={`${hire.department} · ${formatDate(hire.start_date)} 입사 · ${startLabel(hire.start_date)}`}
          actions={
            <Link className={buttonVariants({ variant: 'outline' })} href="/">
              <ArrowLeft size={16} weight="fill" />
              목록으로
            </Link>
          }
        />

        <Card>
          <Card.Header>
            <Card.Title>체크리스트</Card.Title>
            <Card.Description>체크하면 바로 저장돼요. 메모는 적은 뒤 「메모 저장」을 눌러요.</Card.Description>
            {items.length > 0 && <Progress done={done} total={items.length} label={hire.name} className="mt-3" />}
          </Card.Header>
          <Card.Content>
            {items.length === 0 ? (
              <EmptyState>등록할 때 기본 체크리스트가 비어 있어서 붙은 항목이 없어요.</EmptyState>
            ) : (
              <ul className="list-none p-0">
                {items.map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={{
                      id: item.id,
                      title: item.title,
                      done: item.done,
                      memo: item.memo,
                      updatedLabel: item.updated_at ? `${item.updated_by ?? ''} · ${formatDateTime(item.updated_at)}` : null,
                    }}
                  />
                ))}
              </ul>
            )}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>입사자 정보</Card.Title>
            <Card.Description>
              {hire.created_by_name ? `${hire.created_by_name}님이 ` : ''}
              {formatDateTime(hire.created_at)}에 등록했어요.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            {/* key — 다른 사람이 고친 값이 들어오면 입력칸도 새 값으로 다시 그려요. */}
            <HireForm key={`${hire.name}|${hire.department}|${hire.start_date}`} hire={{ id: hire.id, name: hire.name, department: hire.department, startDate: hire.start_date }} />
          </Card.Content>
          {isAdmin(visitor) && (
            <Card.Footer className="flex-col items-stretch">
              <DeleteHireButton id={hire.id} name={hire.name} />
            </Card.Footer>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
