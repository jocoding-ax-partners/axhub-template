import { Card, EmptyState, FieldError, Input, Label, TextField } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { Notice } from '@/components/Notice'
import { SubmitButton } from '@/components/SubmitButton'
import { me } from '@/lib/axhub-server'
import { db, ensureSchema, isDbConfigured } from '@/lib/db'
import { createRoom } from '../actions'

type Room = { id: string; name: string; capacity: number }

/** 회의실 관리 — 목록은 누구나 보고, 등록은 관리자만 해요 (등록 동작도 서버에서 한 번 더 확인해요). */
export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams
  const visitor = await me()
  const dbReady = isDbConfigured()

  let rooms: Room[] = []
  if (dbReady) {
    await ensureSchema()
    rooms = await db()<Room[]>`SELECT id::text, name, capacity FROM rooms ORDER BY name`
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="회의실 관리" description="예약할 수 있는 회의실 목록이에요. 회의실 등록은 관리자만 할 수 있어요." />

        <Notice ok={sp.ok} error={sp.error} />

        {dbReady && visitor.is_admin && (
          <Card>
            <Card.Header>
              <Card.Title>회의실 등록</Card.Title>
            </Card.Header>
            <Card.Content>
              <form action={createRoom} className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
                <TextField name="name" isRequired maxLength={50}>
                  <Label>이름</Label>
                  <Input placeholder="예: 3층 대회의실" />
                  <FieldError />
                </TextField>
                <TextField name="capacity" type="number" isRequired defaultValue="6">
                  <Label>수용 인원(명)</Label>
                  <Input inputMode="numeric" min={1} max={1000} step={1} />
                  <FieldError />
                </TextField>
                <SubmitButton>등록하기</SubmitButton>
              </form>
            </Card.Content>
          </Card>
        )}

        <Card>
          <Card.Header>
            <Card.Title>등록된 회의실</Card.Title>
            {rooms.length > 0 && <Card.Description>{rooms.length}개</Card.Description>}
          </Card.Header>
          <Card.Content>
            {!dbReady ? (
              <EmptyState>회의실을 저장할 곳이 아직 준비되지 않았어요. 배포가 끝난 뒤 다시 열어 주세요.</EmptyState>
            ) : rooms.length === 0 ? (
              <EmptyState>
                {visitor.is_admin ? '아직 회의실이 없어요. 위에서 첫 회의실을 등록해 주세요.' : '아직 회의실이 없어요. 관리자에게 등록을 요청해 주세요.'}
              </EmptyState>
            ) : (
              <ul className="list-none p-0">
                {rooms.map((r) => (
                  <li key={r.id} className="t-small flex justify-between gap-4 border-b border-default py-3 last:border-0">
                    <span className="min-w-0 break-all">{r.name}</span>
                    <span className="shrink-0 text-muted">{r.capacity}명</span>
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
