import Link from 'next/link'
import { Button, Card, EmptyState, FieldError, Input, Label, ListBox, Select, TextField, buttonVariants } from '@heroui/react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { Notice } from '@/components/Notice'
import { SubmitButton } from '@/components/SubmitButton'
import { Timetable, type Booking, type Room } from '@/components/Timetable'
import { loginUrl, me } from '@/lib/axhub-server'
import { db, ensureSchema, isDbConfigured } from '@/lib/db'
import { DAY_END, SLOT, SLOTS, addDays, fmt, fmtDay, isDay, isPast, toMin, todayKst } from '@/lib/booking'
import { createBooking } from './actions'

type Search = { date?: string; room?: string; start?: string; end?: string; title?: string; ok?: string; error?: string }

/** 예약하기 — 날짜별 회의실 시간표(30분 칸)를 보고 빈 칸을 골라 예약해요. */
export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const today = todayKst()
  const day = sp.date && isDay(sp.date) ? sp.date : today
  const visitor = await me()

  if (!isDbConfigured()) {
    return (
      <AppShell>
        <Card>
          <EmptyState>예약을 저장할 곳이 아직 준비되지 않았어요. 배포가 끝난 뒤 다시 열어 주세요.</EmptyState>
        </Card>
      </AppShell>
    )
  }

  await ensureSchema()
  const rooms = await db()<Room[]>`SELECT id::text, name, capacity FROM rooms ORDER BY name`
  const bookings = await db()<Booking[]>`
    SELECT id::text, room_id::text, title, user_key, user_name, start_min, end_min
    FROM bookings WHERE day = ${day} ORDER BY start_min`

  const selRoom = rooms.find((r) => r.id === sp.room)
  const selStart = toMin(sp.start ?? '')
  const selEnd = toMin(sp.end ?? '')
  const picking = Boolean(selRoom) && SLOTS.includes(selStart) && !isPast(day, selStart)
  const login = visitor.authenticated ? '' : await loginUrl(`/?date=${day}`)
  const navBtn = buttonVariants({ variant: 'ghost', size: 'sm' })

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="회의실 예약" description="날짜를 고르고 시간표의 빈 칸을 눌러 예약하세요. 30분 단위예요." />

        <Notice ok={sp.ok} error={sp.error} />

        {/* 날짜 고르기 — 이전/다음 날, 오늘, 직접 고르기 (주소의 ?date= 만 바꿔요) */}
        <Card>
          <Card.Content className="flex-row flex-wrap items-center gap-3">
            <p className="t-card-title grow">{fmtDay(day)}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Link className={navBtn} href={`/?date=${addDays(day, -1)}`} aria-label="이전 날">
                <CaretLeft weight="fill" size={16} />
                이전
              </Link>
              {day !== today && (
                <Link className={navBtn} href="/">
                  오늘
                </Link>
              )}
              <Link className={navBtn} href={`/?date=${addDays(day, 1)}`} aria-label="다음 날">
                다음
                <CaretRight weight="fill" size={16} />
              </Link>
              <form method="get" className="flex items-center gap-2">
                <Input className="w-40" type="date" name="date" defaultValue={day} aria-label="날짜 고르기" required />
                <Button type="submit" variant="outline" size="sm">
                  보기
                </Button>
              </form>
            </div>
          </Card.Content>
        </Card>

        {picking && selRoom && (
          <Card id="book">
            <Card.Header>
              <Card.Title>새 예약</Card.Title>
              <Card.Description>
                {selRoom.name} ({selRoom.capacity}명) · {fmtDay(day)}
              </Card.Description>
            </Card.Header>
            <Card.Content>
              {!visitor.authenticated ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="t-small">예약하려면 먼저 로그인해 주세요.</p>
                  <a className={buttonVariants({ variant: 'primary', size: 'sm' })} href={login}>
                    axhub 로 로그인
                  </a>
                </div>
              ) : (
                <form action={createBooking} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <input type="hidden" name="day" value={day} />
                  <input type="hidden" name="room" value={selRoom.id} />
                  <TextField name="title" isRequired maxLength={100} defaultValue={sp.title ?? ''} className="col-span-2">
                    <Label>제목</Label>
                    <Input placeholder="예: 주간 회의" />
                    <FieldError />
                  </TextField>
                  <TimeSelect name="start" label="시작" times={SLOTS} defaultValue={fmt(selStart)} />
                  <TimeSelect
                    name="end"
                    label="종료"
                    times={SLOTS.map((m) => m + SLOT)}
                    defaultValue={fmt(selEnd > selStart ? selEnd : Math.min(selStart + SLOT, DAY_END))}
                  />
                  <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-4">
                    <SubmitButton>예약하기</SubmitButton>
                    <Link className={buttonVariants({ variant: 'ghost' })} href={`/?date=${day}`}>
                      닫기
                    </Link>
                  </div>
                </form>
              )}
            </Card.Content>
          </Card>
        )}

        <Card>
          <Card.Header>
            <Card.Title>시간표</Card.Title>
            {rooms.length > 0 && (
              <Card.Description>
                {visitor.authenticated ? '칸을 누르면 그 시각부터 예약할 수 있어요.' : '예약하려면 오른쪽 위에서 로그인해 주세요.'}
              </Card.Description>
            )}
          </Card.Header>
          <Card.Content>
            {rooms.length === 0 ? (
              <EmptyState className="flex flex-col items-center gap-3">
                <p>등록된 회의실이 없어요.</p>
                {visitor.is_admin ? (
                  <Link className={buttonVariants({ variant: 'primary', size: 'sm' })} href="/rooms">
                    회의실 등록하기
                  </Link>
                ) : (
                  <p>관리자에게 회의실 등록을 요청해 주세요.</p>
                )}
              </EmptyState>
            ) : (
              <Timetable
                rooms={rooms}
                bookings={bookings}
                day={day}
                userId={visitor.authenticated ? visitor.user_id : undefined}
                picked={selRoom ? { roomId: selRoom.id, start: selStart } : undefined}
              />
            )}
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}

/** 시작·종료 시각 고르기 (30분 단위). 폼에는 "09:30" 같은 값으로 실려 가요. */
function TimeSelect({ name, label, times, defaultValue }: { name: string; label: string; times: number[]; defaultValue: string }) {
  return (
    <Select name={name} defaultSelectedKey={defaultValue} isRequired>
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {times.map((m) => (
            <ListBox.Item key={m} id={fmt(m)} textValue={fmt(m)}>
              {fmt(m)}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 🤖 Claude Code / AI 에이전트 — 이 앱 만드는 법 (지우지 말 것)
 *
 * 【디자인】 axhub 콘솔과 같은 스택 — 자세한 규칙·예시는 AGENTS.md 「디자인」.
 *   - 컴포넌트는 @heroui/react (v3) 에서: Card · Button · TextField · Select · Checkbox · Modal · Table · Chip · toast.
 *     v2 문법(<Card><CardBody>, color="primary", onClick) 은 틀린다 — v3 는 Card.Header/Card.Content, onPress.
 *   - 콘솔 공용 조각(PageHeader · StatusDot · CodeBlock · useConfirm …)은 '@/components/ax' 에서.
 *   - 버튼 모양의 링크는 <Link className={buttonVariants({ variant: 'primary' })}>.
 *   - 아이콘은 @phosphor-icons/react ('use client' 파일) / @phosphor-icons/react/ssr (서버 파일).
 *   - 색은 의미 클래스(bg-content, text-muted, border-default, text-danger), 글자는 t-* (t-small, t-caption).
 *     #hex · text-[15px] · text-gray-500 · bg-white 금지. 다른 UI 라이브러리 설치 금지.
 *   - 페이지 = <div className="flex flex-col gap-10"> 안에 <PageHeader> + <Card> 들.
 *   - 바깥 여백·최대 폭은 셸(PageContainer)이 이미 잡았다. 페이지가 또 붙이지 않는다.
 *
 * 【레이아웃】 새 화면을 추가할 때
 *   - components/AppShell.tsx · Shell.tsx 는 건드리지 않는다. 내용만 <AppShell> 안에 넣는다.
 *   - 사이드바 메뉴는 config/navigation.ts 배열에 한 줄 추가한다.
 *
 * 【백엔드】 전부 서버에서 (Server Component / Route Handler / Server Action).
 *
 * 1) 지금 방문자가 누구인지
 *    import { me, loginUrl, logoutUrl } from "@/lib/axhub-server";
 *    const visitor = await me();
 *    // { authenticated, user_id, email, name, app_role, is_admin, tenant_slug, surface }
 *    // authenticated=false 는 오류가 아니라 "로그인 안 됨" 정상 상태 — 로그인 버튼을 보여준다.
 *    // 출처는 axhub 문이 요청마다 실어 주는 X-AxHub-* 헤더 (허브 API 를 다시 부르지 않는다 —
 *    // 퍼블릭·커스텀 도메인에선 허브 쿠키가 없어 sdk.identity.me 는 401 이다).
 *    // "/__axhub/auth/*" 는 플랫폼 예약 경로 — 앱 라우트로 쓰지 않는다.
 *
 * 2) 데이터 저장·조회 · 표준 PostgreSQL
 *    ⚠️ 기본으로는 DB 가 없다. axhub.yaml 의 `database: { engine: postgres }` 주석을 풀고
 *    다시 배포해야 발급된다. 로컬은 `npm run db:up`.
 *    import { db, ensureSchema } from "@/lib/db";
 *    await ensureSchema();                       // 첫 read/write 전에 한 번
 *    // 값은 tagged-template 으로 — 자동 바인딩되어 SQL 인젝션 안전. 문자열 이어붙이기 금지.
 *    await db()`INSERT INTO todos (user_key, title) VALUES (${userKey}, ${title})`;
 *    const rows = await db()<{ id: string; title: string }[]>`
 *      SELECT id::text, title FROM todos WHERE user_key = ${userKey} ORDER BY id DESC LIMIT 50`;
 *    // 새 테이블이 필요하면 lib/db.ts 의 ensureSchema() 에 CREATE TABLE IF NOT EXISTS 를 추가.
 *    // 사용자별로 가르려면 visitor.email(또는 user_id)을 user_key 컬럼으로 쓰고 늘 필터한다.
 *
 * 3) Gateway · 외부 DB/SaaS 조회  (connector 이름으로, parameterized SQL, audit log)
 *    ⚠️ 사용자 쿠키가 필요해 **회사 앱 주소에서만** 동작 — 퍼블릭·커스텀 도메인 앱은 미지원.
 *    import { queryConnector } from "@/lib/axhub-server";
 *    const res = await queryConnector<{ id: number; name: string }>({
 *      connector: "my-db",
 *      sql: "SELECT id, name FROM public.employees WHERE active = $1 LIMIT $2",
 *      params: [true, 10],
 *    });
 *
 * 4) 에러 처리
 *    - DB(lib/db.ts) 호출은 표준 postgres 에러를 던져요 — try/catch 로 감싸요.
 *    - SDK(gateway) 호출은 AxHubError — e.code / e.category / e.requestId 로 분기.
 * ───────────────────────────────────────────────────────────────────────────── */
