import Link from 'next/link'
import { Card, EmptyState, buttonVariants } from '@heroui/react'
import { PageHeader } from '@/components/ax'
import { EventForm } from '@/components/forms'
import { Gate } from '@/components/Gate'
import { likeOf, Pager, pageOf, SearchForm } from '@/components/Pager'
import { db, ensureSchema } from '@/lib/db'
import { kst, rate } from '@/lib/format'

const PAGE_SIZE = 20

type EventRow = { id: string; name: string; starts_at: Date; venue: string; capacity: number; applied: number; attended: number }

// 첫 화면 — 이벤트 목록(검색 · 쪽 나눔)과 새 이벤트 만들기.
export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q: rawQ = '', page: rawPage } = await searchParams
  const q = rawQ.trim().slice(0, 100)
  const page = pageOf(rawPage)

  return (
    <Gate path="/">
      <div className="flex flex-col gap-10">
        <PageHeader
          title="이벤트"
          description="이벤트를 만들고 참가 신청자와 당일 출석을 관리해요."
          actions={
            <a className={buttonVariants({ variant: 'primary' })} href="#new-event">
              새 이벤트
            </a>
          }
        />
        <EventList q={q} page={page} />
        <Card id="new-event" className="scroll-mt-[calc(var(--topbar-height)+1rem)]">
          <Card.Header>
            <Card.Title>새 이벤트 만들기</Card.Title>
            <Card.Description>만든 뒤 바로 참가 신청자를 등록할 수 있어요.</Card.Description>
          </Card.Header>
          <Card.Content>
              <EventForm />
          </Card.Content>
        </Card>
      </div>
    </Gate>
  )
}

async function EventList({ q, page }: { q: string; page: number }) {
  await ensureSchema()
  const like = likeOf(q)
  const rows = await db()<EventRow[]>`
    SELECT e.id::text, e.name, e.starts_at, e.venue, e.capacity,
           count(a.id)::int AS applied, count(a.checked_in_at)::int AS attended
    FROM events e LEFT JOIN attendees a ON a.event_id = e.id
    WHERE ${q} = '' OR e.name ILIKE ${like} OR e.venue ILIKE ${like}
    GROUP BY e.id
    ORDER BY e.starts_at DESC, e.id DESC
    LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`
  const events = rows.slice(0, PAGE_SIZE)

  return (
    <Card>
      <Card.Header className="flex-row flex-wrap items-center justify-between gap-3">
        <Card.Title>이벤트 목록</Card.Title>
        <SearchForm action="/" q={q} placeholder="이름 · 장소 검색" label="이벤트 검색" />
      </Card.Header>
      <Card.Content>
        {events.length === 0 ? (
          <EmptyState>{q ? `"${q}" 에 맞는 이벤트가 없어요.` : '아직 이벤트가 없어요. 아래에서 첫 이벤트를 만들어 보세요.'}</EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="block rounded-card border border-default p-4 hover:bg-muted">
                  <p className="m-0 break-words text-body-03 font-semibold text-default">{e.name}</p>
                  <p className="t-caption mt-1 mb-0">
                    {kst(e.starts_at)} · {e.venue}
                  </p>
                  <p className="mt-2 mb-0 text-caption-01 text-subtle">
                    신청 {e.applied}/{e.capacity}명 · 출석 {e.attended}명 · 출석률 {rate(e.attended, e.applied)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pager basePath="/" q={q} page={page} hasNext={rows.length > PAGE_SIZE} />
      </Card.Content>
    </Card>
  )
}
