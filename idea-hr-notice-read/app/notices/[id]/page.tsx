import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, Chip, buttonVariants } from '@heroui/react'
import { ArrowLeft, ChartBar } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatusDot } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Gate'
import { ConfirmReadForm } from '@/components/NoticeForms'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatDateTime, isManager, isNoticeId } from '@/lib/notice'
import { getNotice, touchMember } from '@/lib/notice-store'

export const dynamic = 'force-dynamic'

// 공지 읽기 — 로그인한 누구나. 끝에서 "확인했어요" 를 눌러요.
export default async function NoticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="사내 공지" desc="axhub 계정으로 로그인하면 이 공지를 읽고 확인을 남길 수 있어요." returnTo={isNoticeId(id) ? `/notices/${id}` : '/'} />
      </AppShell>
    )
  }
  if (!isNoticeId(id)) notFound()
  if (!isDbConfigured()) {
    return (
      <AppShell>
        <DbNotice />
      </AppShell>
    )
  }

  await touchMember({ userKey: visitor.user_id, name: visitor.name || visitor.email, email: visitor.email })
  const n = await getNotice(id, visitor.user_id)
  if (!n) notFound()

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        {/* 좁은 화면에서도 제목이 좁아지지 않게 버튼은 제목 아래 줄에 둬요. */}
        <div className="flex flex-col gap-4">
          <PageHeader title={n.title} description={`${n.author_name || '관리자'} · ${formatDateTime(n.created_at)}`} />
          <div className="flex flex-wrap items-center gap-2">
            {n.important && (
              <Chip size="sm" color="danger">
                중요 공지
              </Chip>
            )}
            <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href="/">
              <ArrowLeft size={16} weight="fill" aria-hidden />
              목록으로
            </Link>
            {isManager(visitor) && (
              <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`/admin/${n.id}`}>
                <ChartBar size={16} weight="fill" aria-hidden />
                확인 현황
              </Link>
            )}
          </div>
        </div>

        <Card>
          <Card.Content>
            <p className="t-body whitespace-pre-wrap break-words">{n.body}</p>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>읽음 확인</Card.Title>
            <Card.Description>
              {n.read_at ? '관리자에게 확인했다고 전달됐어요.' : '내용을 다 읽었으면 아래 버튼을 눌러 주세요. 관리자가 누가 확인했는지 봐요.'}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            {n.read_at ? (
              <StatusDot tone="active">{formatDateTime(n.read_at)}에 확인했어요</StatusDot>
            ) : (
              <ConfirmReadForm id={n.id} />
            )}
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
