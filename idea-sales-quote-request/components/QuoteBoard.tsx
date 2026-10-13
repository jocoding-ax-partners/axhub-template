import Link from 'next/link'
import { Button, Card, Checkbox, Chip, EmptyState, Input, Label, TextField, buttonVariants } from '@heroui/react'
import { StatusDot, TabNav } from '@/components/ax'
import { AssignForm } from '@/components/AssignForm'
import { Pager } from '@/components/Pager'
import { STATUSES, STATUS_LABEL, dueLabel, formatDate, formatDateTime, isClosed, type QuoteStatus } from '@/lib/quote'
import type { Member, Quote, QuoteFilter } from '@/lib/quote-store'

// 접수 = 손이 가야 함(노랑), 견적 발송 = 진행 중(기본), 수주 = 성공(초록), 실패 = 빨강.
const STATUS_TONE: Record<QuoteStatus, 'warning' | 'active' | 'failed' | undefined> = {
  received: 'warning',
  quoted: undefined,
  won: 'active',
  lost: 'failed',
}

/** 조건을 주소 쿼리로 — 탭 · 쪽 이동 링크가 검색어 등을 잃지 않게. */
function queryOf(f: { q: string; status: QuoteStatus | null; unassigned: boolean }): Record<string, string> {
  const query: Record<string, string> = {}
  if (f.status) query.status = f.status
  if (f.q) query.q = f.q
  if (f.unassigned) query.unassigned = '1'
  return query
}

function hrefOf(basePath: string, query: Record<string, string>): string {
  const qs = new URLSearchParams(query).toString()
  return qs ? `${basePath}?${qs}` : basePath
}

/**
 * 견적 요청 목록 한 묶음 — 상태 탭(건수) · 검색 · 목록 · 쪽 이동.
 * manage 가 있으면(팀장 화면) 줄마다 담당자 · 상태를 바꾸는 폼이 붙어요.
 */
export function QuoteBoard({
  basePath,
  filter,
  counts,
  rows,
  page,
  hasMore,
  today,
  viewer,
  manage,
}: {
  basePath: string
  filter: QuoteFilter
  counts: Record<QuoteStatus, number>
  rows: Quote[]
  page: number
  hasMore: boolean
  today: string
  viewer: string
  manage?: { members: Member[] }
}) {
  const total = STATUSES.reduce((n, s) => n + counts[s], 0)
  const query = queryOf(filter)
  const searched = Boolean(filter.q || filter.unassigned)
  const tabs = [
    { key: 'all', to: hrefOf(basePath, queryOf({ ...filter, status: null })), label: '전체', badge: String(total) },
    ...STATUSES.map((s) => ({
      key: s,
      to: hrefOf(basePath, queryOf({ ...filter, status: s })),
      label: STATUS_LABEL[s],
      badge: String(counts[s]),
    })),
  ]

  return (
    <section className="flex flex-col gap-4">
      <TabNav tabs={tabs} activeKey={filter.status ?? 'all'} />

      {/* 주소(?q=&status=)로 거르는 평범한 GET 폼이라 브라우저 쪽 코드가 필요 없어요. */}
      <form className="flex flex-wrap items-center gap-3" action={basePath} role="search">
        {filter.status && <input type="hidden" name="status" value={filter.status} />}
        <TextField className="min-w-0 flex-1 basis-56" name="q" type="search" defaultValue={filter.q} maxLength={50} aria-label="견적 요청 검색">
          <Input placeholder="회사명 · 품목 · 고객으로 찾기" />
        </TextField>
        {manage && (
          <Checkbox name="unassigned" value="1" defaultSelected={filter.unassigned}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label>미배정만</Label>
            </Checkbox.Content>
          </Checkbox>
        )}
        <div className="flex gap-2">
          <Button type="submit" variant="outline">
            찾기
          </Button>
          {searched && (
            <Link className={buttonVariants({ variant: 'ghost' })} href={hrefOf(basePath, queryOf({ q: '', unassigned: false, status: filter.status }))}>
              조건 지우기
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <Card>
          <Card.Content>
            <EmptyState>
              {searched
                ? '조건에 맞는 요청이 없어요.'
                : page > 1
                  ? '이 쪽에는 요청이 없어요.'
                  : filter.status
                    ? `${STATUS_LABEL[filter.status]} 상태인 요청이 없어요.`
                    : manage
                      ? '아직 등록된 견적 요청이 없어요. 팀원이 요청을 등록하면 여기에 보여요.'
                      : '아직 내 요청이 없어요. 위에서 받은 견적 요청을 등록하거나, 팀장이 배정해 주면 여기에 보여요.'}
            </EmptyState>
          </Card.Content>
        </Card>
      ) : (
        <ul className="flex list-none flex-col gap-4 p-0">
          {rows.map((r) => {
            const due = dueLabel(r.due_date, today, r.status)
            const overdue = !isClosed(r.status) && r.due_date < today
            return (
              <li key={r.id}>
                <Card>
                  <Card.Header>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Card.Title className="min-w-0 break-words">{r.company}</Card.Title>
                      <StatusDot tone={STATUS_TONE[r.status]} className="shrink-0">
                        {STATUS_LABEL[r.status]}
                      </StatusDot>
                    </div>
                    <Card.Description className="break-words">
                      {r.item} · {r.quantity.toLocaleString('ko-KR')}개
                    </Card.Description>
                  </Card.Header>
                  <Card.Content className="flex flex-col gap-1">
                    <p className="t-small flex flex-wrap items-center gap-x-2">
                      <span>희망 납기 {formatDate(r.due_date)}</span>
                      {due && (
                        <Chip size="sm" color={overdue ? 'danger' : 'default'}>
                          {due}
                        </Chip>
                      )}
                    </p>
                    <p className="t-small break-words">
                      고객 {r.contact_name} ·{' '}
                      <a className="text-primary underline-offset-2 hover:underline" href={`tel:${r.contact_phone.replace(/[^0-9+]/g, '')}`}>
                        {r.contact_phone}
                      </a>
                    </p>
                    {/* 팀장 화면은 아래 폼이 담당자를 보여 줘요. */}
                    {!manage && (
                      <p className="t-small flex flex-wrap items-center gap-2">
                        <span className="text-muted">담당자</span>
                        {r.assignee_key ? <span>{r.assignee_name || '(이름 없음)'}</span> : <span className="text-muted">미배정</span>}
                        {r.assignee_key === viewer && <Chip size="sm">내 담당</Chip>}
                        {r.created_by_key === viewer && r.assignee_key !== viewer && <Chip size="sm">내가 등록</Chip>}
                      </p>
                    )}
                    <p className="t-caption">
                      {formatDateTime(r.created_at)} {r.created_by_name}님 등록
                      {r.updated_at && ` · ${formatDateTime(r.updated_at)} ${r.updated_by_name ?? ''}님이 바꿈`}
                    </p>
                  </Card.Content>
                  {manage && (
                    <Card.Footer className="flex-col items-stretch">
                      <AssignForm
                        id={r.id}
                        summary={`${r.company} 견적 요청`}
                        assignee={r.assignee_key}
                        status={r.status}
                        members={manage.members}
                      />
                    </Card.Footer>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
      <Pager basePath={basePath} query={query} page={page} hasNext={hasMore} />
    </section>
  )
}
