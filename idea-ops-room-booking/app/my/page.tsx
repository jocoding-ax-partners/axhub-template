import Link from 'next/link'
import { Card, EmptyState, buttonVariants } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { Notice } from '@/components/Notice'
import { SubmitButton } from '@/components/SubmitButton'
import { loginUrl, me } from '@/lib/axhub-server'
import { db, ensureSchema, isDbConfigured } from '@/lib/db'
import { fmt, fmtDay, todayKst } from '@/lib/booking'
import { cancelBooking } from '../actions'

type Row = { id: string; title: string; room: string; day: string; start_min: number; end_min: number }

/** 내 예약 — 오늘 이후 내가 잡은 예약을 보고 취소해요. */
export default async function MyBookings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams
  const visitor = await me()
  const login = visitor.authenticated ? '' : await loginUrl('/my')
  const dbReady = isDbConfigured()

  let rows: Row[] = []
  if (visitor.authenticated && dbReady) {
    await ensureSchema()
    rows = await db()<Row[]>`
      SELECT b.id::text, b.title, r.name AS room, b.day::text AS day, b.start_min, b.end_min
      FROM bookings b JOIN rooms r ON r.id = b.room_id
      WHERE b.user_key = ${visitor.user_id} AND b.day >= ${todayKst()}
      ORDER BY b.day, b.start_min`
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="내 예약" description="오늘부터 잡혀 있는 내 예약이에요. 필요 없어진 예약은 취소해 주세요." />

        <Notice ok={sp.ok} error={sp.error} />

        <Card>
          <Card.Content>
            {!dbReady ? (
              <EmptyState>예약을 저장할 곳이 아직 준비되지 않았어요. 배포가 끝난 뒤 다시 열어 주세요.</EmptyState>
            ) : !visitor.authenticated ? (
              <EmptyState className="flex flex-col items-center gap-3">
                <p>로그인하면 내 예약이 보여요.</p>
                <a className={buttonVariants({ variant: 'primary', size: 'sm' })} href={login}>
                  axhub 로 로그인
                </a>
              </EmptyState>
            ) : rows.length === 0 ? (
              <EmptyState className="flex flex-col items-center gap-3">
                <p>예정된 예약이 없어요.</p>
                <Link className={buttonVariants({ variant: 'primary', size: 'sm' })} href="/">
                  회의실 예약하기
                </Link>
              </EmptyState>
            ) : (
              <ul className="list-none p-0">
                {rows.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-default py-3 last:border-0">
                    <div className="min-w-0">
                      <p className="t-small font-semibold break-all">{b.title}</p>
                      <p className="t-caption mt-1">
                        {fmtDay(b.day)} {fmt(b.start_min)}~{fmt(b.end_min)} · {b.room}
                      </p>
                    </div>
                    <form action={cancelBooking}>
                      <input type="hidden" name="id" value={b.id} />
                      <SubmitButton
                        variant="danger-soft"
                        size="sm"
                        confirm={{
                          title: '예약을 취소할까요?',
                          description: `'${b.title}' 예약(${fmtDay(b.day)} ${fmt(b.start_min)}~${fmt(b.end_min)})을 취소해요. 되돌릴 수 없어요.`,
                          confirmLabel: '예약 취소',
                          cancelLabel: '그대로 두기',
                          variant: 'danger',
                        }}
                      >
                        예약 취소
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
