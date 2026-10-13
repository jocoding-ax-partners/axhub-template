import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, Chip, EmptyState, buttonVariants } from '@heroui/react'
import { deleteApplicant, deleteEvent, toggleCheckIn } from '@/app/actions'
import { PageHeader, StatCard } from '@/components/ax'
import { CsvImport } from '@/components/CsvImport'
import { ActionForm, ApplicantForm, ConfirmSubmit, SubmitButton } from '@/components/forms'
import { Gate } from '@/components/Gate'
import { likeOf, Pager, pageOf, SearchForm } from '@/components/Pager'
import { db, ensureSchema } from '@/lib/db'
import { kst, kstTime, rate } from '@/lib/format'

const PAGE_SIZE = 50

type EventRow = { id: string; name: string; starts_at: Date; venue: string; capacity: number; applied: number; attended: number }
type Attendee = { id: string; name: string; company: string; email: string; checked_in_at: Date | null }

// 이벤트 상세 — 신청·출석 현황, 신청자 등록(한 명 · CSV), 당일 출석 체크.
export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { id } = await params
  const { q: rawQ = '', page: rawPage } = await searchParams
  if (!/^\d{1,18}$/.test(id)) notFound()

  return (
    <Gate path={`/events/${id}`}>
      <EventDetail id={id} q={rawQ.trim().slice(0, 100)} page={pageOf(rawPage)} />
    </Gate>
  )
}

async function EventDetail({ id, q, page }: { id: string; q: string; page: number }) {
  await ensureSchema()
  const [event] = await db()<EventRow[]>`
    SELECT e.id::text, e.name, e.starts_at, e.venue, e.capacity,
           count(a.id)::int AS applied, count(a.checked_in_at)::int AS attended
    FROM events e LEFT JOIN attendees a ON a.event_id = e.id
    WHERE e.id = ${id}
    GROUP BY e.id`
  if (!event) notFound()

  const like = likeOf(q)
  const rows = await db()<Attendee[]>`
    SELECT id::text, name, company, email, checked_in_at FROM attendees
    WHERE event_id = ${id} AND (${q} = '' OR name ILIKE ${like} OR company ILIKE ${like} OR email ILIKE ${like})
    ORDER BY name, attendees.id
    LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`
  const attendees = rows.slice(0, PAGE_SIZE)
  const seatsLeft = Math.max(0, event.capacity - event.applied)
  const basePath = `/events/${id}`

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={<span className="break-words">{event.name}</span>}
        description={`${kst(event.starts_at)} · ${event.venue}`}
        actions={
          <Link className={buttonVariants({ variant: 'outline' })} href="/">
            목록으로
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="신청 인원" value={`${event.applied}명`} sub={`정원 ${event.capacity}명 · 남은 자리 ${seatsLeft}명`} />
        <StatCard label="출석 인원" value={`${event.attended}명`} sub={`미출석 ${event.applied - event.attended}명`} />
        <StatCard label="출석률" value={rate(event.attended, event.applied)} sub="출석 인원 ÷ 신청 인원" />
      </div>

      <Card id="list" className="scroll-mt-[calc(var(--topbar-height)+1rem)]">
        <Card.Header className="flex-row flex-wrap items-center justify-between gap-3">
          <Card.Title>참가자 명단 · 출석 체크</Card.Title>
          <SearchForm action={`${basePath}#list`} q={q} placeholder="이름 · 회사 · 이메일 검색" label="참가자 검색" />
        </Card.Header>
        <Card.Content>
          {attendees.length === 0 ? (
            <EmptyState>{q ? `"${q}" 에 맞는 참가자가 없어요.` : '아직 신청자가 없어요. 아래에서 등록해 주세요.'}</EmptyState>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {attendees.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-default py-3 last:border-0">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-03 font-semibold text-default">
                      <span className="break-words">{a.name}</span>
                      {a.checked_in_at && (
                        <Chip color="success" size="sm">
                          출석 {kstTime(a.checked_in_at)}
                        </Chip>
                      )}
                    </p>
                    <p className="t-caption mt-1 mb-0 truncate">
                      {a.company ? `${a.company} · ` : ''}
                      {a.email}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <ActionForm action={toggleCheckIn} fields={{ event_id: id, attendee_id: a.id }}>
                      <SubmitButton pending="처리 중…" size="sm" variant={a.checked_in_at ? 'outline' : 'primary'}>
                        {a.checked_in_at ? '출석 취소' : '출석'}
                      </SubmitButton>
                    </ActionForm>
                    <ActionForm action={deleteApplicant} fields={{ event_id: id, attendee_id: a.id }}>
                      <ConfirmSubmit size="sm" title={`${a.name} 님의 신청을 지울까요?`} description="출석 기록도 함께 지워져요. 되돌릴 수 없어요.">
                        삭제
                      </ConfirmSubmit>
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Pager basePath={basePath} q={q} page={page} hasNext={rows.length > PAGE_SIZE} />
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>참가 신청자 등록</Card.Title>
          {seatsLeft === 0 ? (
            <Card.Description className="text-danger">정원({event.capacity}명)이 다 찼어요. 더 받으려면 신청자를 정리해 주세요.</Card.Description>
          ) : (
            <Card.Description>남은 자리 {seatsLeft}명. 같은 이메일은 한 번만 신청할 수 있어요.</Card.Description>
          )}
        </Card.Header>
        {seatsLeft > 0 && (
          <Card.Content className="flex flex-col gap-8">
            <ApplicantForm eventId={id} />
            <section className="flex flex-col gap-3">
              <h3 className="text-body-03 font-semibold text-default">CSV 로 한 번에 올리기</h3>
              <CsvImport eventId={id} />
            </section>
          </Card.Content>
        )}
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>이벤트 지우기</Card.Title>
          <Card.Description>이벤트와 신청자 명단 · 출석 기록이 모두 지워져요. 되돌릴 수 없어요.</Card.Description>
        </Card.Header>
        <Card.Footer>
          <ActionForm action={deleteEvent} fields={{ event_id: id }} className="items-start">
            <ConfirmSubmit title={`"${event.name}" 이벤트를 지울까요?`} description={`신청자 ${event.applied}명의 명단과 출석 기록이 모두 지워져요. 되돌릴 수 없어요.`}>
              이벤트 지우기
            </ConfirmSubmit>
          </ActionForm>
        </Card.Footer>
      </Card>
    </div>
  )
}
