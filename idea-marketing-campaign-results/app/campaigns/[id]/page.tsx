import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, EmptyState, buttonVariants } from '@heroui/react'
import { ArrowLeft, PencilSimple } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard } from '@/components/ax'
import { DailyEditor } from '@/components/DailyEditor'
import { DeleteCampaignButton } from '@/components/DeleteCampaignButton'
import { DbNotice, LoginCard } from '@/components/Notices'
import { TrendChart } from '@/components/TrendChart'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { canEdit, cpa, ctr, formatInt, formatPct, formatPeriod, formatWon, kstToday, periodDays } from '@/lib/campaign'
import { getCampaign, listDaily } from '@/lib/campaign-store'

export const dynamic = 'force-dynamic'

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="캠페인 성과" desc="axhub 계정으로 로그인하면 캠페인 성과를 볼 수 있어요." returnTo={`/campaigns/${id}`} />
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
  const c = await getCampaign(id)
  if (!c) notFound()
  const daily = await listDaily(c.id)
  const editable = canEdit(visitor, c.owner_key)

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <Link className={`${buttonVariants({ variant: 'ghost', size: 'sm' })} self-start`} href="/">
            <ArrowLeft size={16} weight="fill" />
            캠페인 목록
          </Link>
          <PageHeader
            title={c.name}
            description={`${c.channel} · ${formatPeriod(c.start_date, c.end_date)} (${periodDays(c.start_date, c.end_date)}일) · 등록 ${c.owner_name || '알 수 없음'}`}
          />
          {/* 버튼은 제목 아래에 둬요 — 좁은 화면에서 긴 캠페인 이름이 버튼에 밀려 잘게 꺾이지 않게. */}
          {editable && (
            <div className="flex flex-wrap gap-2">
              <Link className={buttonVariants({ variant: 'outline' })} href={`/campaigns/${c.id}/edit`}>
                <PencilSimple size={16} weight="fill" />
                고치기
              </Link>
              <DeleteCampaignButton id={c.id} name={c.name} days={c.days} />
            </div>
          )}
        </div>

        <section aria-label="캠페인 합계" className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="비용" value={formatWon(c.cost)} sub={`${formatInt(c.days)}일 기록`} />
          <StatCard label="클릭률" value={formatPct(ctr(c))} sub="클릭 ÷ 노출" />
          <StatCard label="전환당 비용" value={formatWon(cpa(c))} sub="비용 ÷ 전환" />
          <StatCard label="노출" value={formatInt(c.impressions)} />
          <StatCard label="클릭" value={formatInt(c.clicks)} />
          <StatCard label="전환" value={formatInt(c.conversions)} />
        </section>

        <Card>
          <Card.Header>
            <Card.Title>날짜별 추이</Card.Title>
            <Card.Description>캠페인 기간 전체를 가로축으로 놓고 기록한 날의 클릭·전환을 이어요. 점에 마우스를 올리면 숫자가 보여요.</Card.Description>
          </Card.Header>
          <Card.Content>
            {daily.length === 0 ? (
              <EmptyState>날짜별 성과를 적으면 여기에 선 차트가 그려져요.</EmptyState>
            ) : (
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <TrendChart
                  title="클릭"
                  tone="primary"
                  start={c.start_date}
                  end={c.end_date}
                  points={daily.map((d) => ({ day: d.day, value: d.clicks }))}
                />
                <TrendChart
                  title="전환"
                  tone="success"
                  start={c.start_date}
                  end={c.end_date}
                  points={daily.map((d) => ({ day: d.day, value: d.conversions }))}
                />
              </div>
            )}
          </Card.Content>
        </Card>

        <DailyEditor campaignId={c.id} start={c.start_date} end={c.end_date} today={kstToday()} rows={daily} editable={editable} />
      </div>
    </AppShell>
  )
}
