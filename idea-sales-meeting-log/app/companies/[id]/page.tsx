import { notFound } from 'next/navigation'
import { Card, buttonVariants } from '@heroui/react'
import { EnvelopeSimple, Phone } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { CompanyForm, DeleteCompanyButton, DeleteMeetingButton, MeetingForm } from '@/components/MeetingLogForms'
import { DbMissing, LoginRequired } from '@/components/Notices'
import { db, ensureSchema, isDbConfigured } from '@/lib/db'
import { formatDate, relativeDay, todayKst } from '@/lib/dates'
import { canManageCompany, currentUser } from '@/lib/user'

// 고객사 한 곳 — 정보 · 미팅 기록 남기기 · 지난 기록.
// 정보 수정과 고객사 지우기는 담당자·관리자에게만 보여요 (서버 액션도 같은 조건으로 다시 확인해요).

const MEETING_MAX = 200

type Company = { id: string; name: string; contact_name: string; contact_info: string; owner_key: string; owner_name: string }
type Meeting = {
  id: string
  met_on: string
  attendees: string
  notes: string
  next_action: string
  next_contact_on: string | null
  author_key: string
  author_name: string
}

// 연락처가 전화번호·이메일처럼 보이면 휴대폰에서 바로 걸거나 쓸 수 있게 링크로.
function contactHref(info: string): string | null {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info)) return `mailto:${info}`
  if (/^\+?[\d\s()-]{7,20}$/.test(info)) return `tel:${info.replace(/[^\d+]/g, '')}`
  return null
}

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d{1,18}$/.test(id)) notFound()
  const user = await currentUser()
  if (!user) return <LoginRequired returnTo={`/companies/${id}`} />
  if (!isDbConfigured()) return <DbMissing />

  await ensureSchema()
  const [company] = await db()<Company[]>`
    SELECT id::text, name, contact_name, contact_info, owner_key, owner_name FROM companies WHERE id = ${id}`
  if (!company) notFound()
  const meetings = await db()<Meeting[]>`
    SELECT id::text, met_on::text, attendees, notes, next_action, next_contact_on::text, author_key, author_name
    FROM meetings WHERE company_id = ${id} ORDER BY met_on DESC, meetings.id DESC LIMIT ${MEETING_MAX}`

  const today = todayKst()
  const manage = canManageCompany(user, company.owner_key)
  const owner = company.owner_key === user.key ? '나' : company.owner_name || '알 수 없음'
  const next = meetings[0]?.next_contact_on ?? null
  const href = contactHref(company.contact_info)

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title={company.name}
          titleClassName="break-words"
          description={
            <>
              담당 {owner}
              {next && ` · 다음 연락 ${formatDate(next, today)} (${relativeDay(next, today)})`}
            </>
          }
          backTo="/"
          backLabel="고객사 목록"
        />

        <Card>
          <Card.Header>
            <Card.Title>고객사 정보</Card.Title>
          </Card.Header>
          <Card.Content>
            {manage ? (
              <CompanyForm initial={company} />
            ) : (
              <>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Info label="회사명">{company.name}</Info>
                  <Info label="담당자">{company.contact_name || '—'}</Info>
                  <Info label="연락처">
                    {href ? <a href={href} className="text-primary">{company.contact_info}</a> : company.contact_info || '—'}
                  </Info>
                </dl>
                <p className="t-caption mt-4">정보는 담당자나 관리자가 고칠 수 있어요.</p>
              </>
            )}
          </Card.Content>
          {manage && href && (
            <Card.Footer>
              <a href={href} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                {href.startsWith('tel:') ? <Phone weight="fill" size={16} aria-hidden /> : <EnvelopeSimple weight="fill" size={16} aria-hidden />}
                {href.startsWith('tel:') ? '전화 걸기' : '메일 쓰기'}
              </a>
            </Card.Footer>
          )}
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>미팅 기록 남기기</Card.Title>
            <Card.Description>가장 최근 미팅의 다음 연락일이 이 고객사의 다음 연락일이 돼요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <MeetingForm companyId={company.id} today={today} />
          </Card.Content>
        </Card>

        <section className="flex flex-col gap-4">
          <h2 className="t-section-title">
            지난 미팅 {meetings.length > 0 && <span className="text-muted">{meetings.length}</span>}
          </h2>
          {meetings.length === 0 ? (
            <Card className="items-center py-8 text-center">
              <p className="t-small text-muted">아직 미팅 기록이 없어요. 위에서 첫 기록을 남겨 보세요.</p>
            </Card>
          ) : (
            <ul className="grid list-none grid-cols-1 gap-3 p-0">
              {meetings.map((m) => (
                <li key={m.id}>
                  <Card>
                    <Card.Header>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Card.Title>{formatDate(m.met_on, today)}</Card.Title>
                        {(manage || m.author_key === user.key) && (
                          <DeleteMeetingButton id={m.id} companyId={company.id} label={formatDate(m.met_on, today)} />
                        )}
                      </div>
                      <Card.Description>
                        {m.attendees ? `참석 ${m.attendees} · ` : ''}기록 {m.author_key === user.key ? '나' : m.author_name || '알 수 없음'}
                      </Card.Description>
                    </Card.Header>
                    <Card.Content className="flex flex-col gap-4">
                      <p className="t-small whitespace-pre-wrap break-words">{m.notes}</p>
                      {(m.next_action || m.next_contact_on) && (
                        <dl className="grid grid-cols-1 gap-3 rounded-input bg-muted p-3 sm:grid-cols-2">
                          <Info label="다음 할 일">{m.next_action || '—'}</Info>
                          <Info label="다음 연락일">{m.next_contact_on ? formatDate(m.next_contact_on, today) : '—'}</Info>
                        </dl>
                      )}
                    </Card.Content>
                  </Card>
                </li>
              ))}
            </ul>
          )}
          {meetings.length === MEETING_MAX && <p className="t-caption">최근 {MEETING_MAX}건까지 보여요.</p>}
        </section>

        {manage && (
          <Card>
            <Card.Header>
              <Card.Title>고객사 지우기</Card.Title>
              <Card.Description>이 고객사의 미팅 기록도 모두 함께 지워지고 되돌릴 수 없어요.</Card.Description>
            </Card.Header>
            <Card.Footer>
              <DeleteCompanyButton id={company.id} name={company.name} />
            </Card.Footer>
          </Card>
        )}
      </div>
    </AppShell>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="t-caption">{label}</dt>
      <dd className="t-small mt-1 break-words">{children}</dd>
    </div>
  )
}
