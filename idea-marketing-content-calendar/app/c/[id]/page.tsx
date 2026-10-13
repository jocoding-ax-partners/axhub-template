import { notFound } from 'next/navigation'
import { Card } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { ChannelLabel, StatusLabel } from '@/components/ContentBadges'
import { ContentForm } from '@/components/ContentForm'
import { DeleteButton } from '@/components/DeleteButton'
import { DbNotice, LoginCard } from '@/components/Notices'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { canDelete, formatDate, formatDateTime } from '@/lib/content'
import { getContent } from '@/lib/content-store'

export const dynamic = 'force-dynamic'

// 콘텐츠 상세 — 내용을 보고, 로그인한 팀원은 고칠 수 있어요. 지우기는 등록한 사람·관리자만.
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d{1,18}$/.test(id)) notFound()
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="콘텐츠 상세" desc="axhub 계정으로 로그인하면 콘텐츠 내용을 보고 고칠 수 있어요." returnTo={`/c/${id}`} />
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
  const c = await getContent(id)
  if (!c) notFound()
  const month = c.publish_date.slice(0, 7)

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title={<span className="break-words">{c.title}</span>}
          description={`${formatDate(c.publish_date)} 발행 예정`}
          backTo={`/?m=${month}`}
          backLabel="달력"
        />

        <Card>
          <Card.Header>
            <Card.Title>상세</Card.Title>
          </Card.Header>
          <Card.Content>
            <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              <Row label="채널">
                <ChannelLabel channel={c.channel} />
              </Row>
              <Row label="상태">
                <StatusLabel status={c.status} />
              </Row>
              <Row label="발행 예정일">{formatDate(c.publish_date)}</Row>
              <Row label="담당자">{c.owner}</Row>
              <Row label="등록">
                {c.created_by_name || '알 수 없음'} · {formatDateTime(c.created_at)}
              </Row>
              <Row label="마지막 수정">
                {c.version > 1 ? `${c.updated_by_name || '알 수 없음'} · ${formatDateTime(c.updated_at)}` : '아직 고친 적 없어요'}
              </Row>
            </dl>
            {c.memo && (
              <div className="mt-4 border-t border-default pt-4">
                <p className="t-caption">메모</p>
                <p className="t-small mt-1 whitespace-pre-wrap break-words">{c.memo}</p>
              </div>
            )}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>고치기</Card.Title>
            <Card.Description>상태를 바꾸거나 일정을 옮길 때 여기서 고쳐요. 로그인한 팀원 누구나 고칠 수 있어요.</Card.Description>
          </Card.Header>
          <Card.Content>
            {/* key — 저장해서 version 이 바뀌면 폼을 새 값으로 다시 그려요. */}
            <ContentForm
              key={c.version}
              initial={{ id: c.id, version: c.version, title: c.title, channel: c.channel, publish_date: c.publish_date, owner: c.owner, status: c.status, memo: c.memo }}
            />
          </Card.Content>
        </Card>

        {canDelete(visitor, c.created_by_key) && (
          <Card>
            <Card.Header>
              <Card.Title>지우기</Card.Title>
              <Card.Description>등록한 사람과 관리자만 지울 수 있어요. 지우면 되돌릴 수 없어요.</Card.Description>
            </Card.Header>
            <Card.Footer>
              <DeleteButton id={c.id} title={c.title} />
            </Card.Footer>
          </Card>
        )}
      </div>
    </AppShell>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-default py-2.5">
      <dt className="t-caption shrink-0">{label}</dt>
      <dd className="t-small min-w-0 break-words text-right">{children}</dd>
    </div>
  )
}
