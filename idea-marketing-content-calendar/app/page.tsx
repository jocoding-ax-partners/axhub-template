import Link from 'next/link'
import { Card, buttonVariants } from '@heroui/react'
import { CaretLeft, CaretRight, Plus } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { ChannelLabel, StatusLabel } from '@/components/ContentBadges'
import { DbNotice, LoginCard } from '@/components/Notices'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { CHANNELS, WEEKDAY, formatDate, formatMonth, kstToday, monthGrid, parseMonth, shiftMonth, type Channel } from '@/lib/content'
import { MONTH_MAX, listMonth, type CalendarItem } from '@/lib/content-store'

// 로그인한 사람마다 내용이 달라요 — 매 요청 새로 그려요.
export const dynamic = 'force-dynamic'

/** 넓은 화면에서 한 칸에 보여 줄 콘텐츠 수. 넘치면 "+N" 이 그날 목록으로 이어져요. */
const CELL_MAX = 3

// 월간 달력. ?m=YYYY-MM 으로 달을 고르고, 발행 예정일 칸에 채널 색으로 콘텐츠를 보여줘요.
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const today = kstToday()
  const month = parseMonth((await searchParams).m) ?? today.slice(0, 7)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="콘텐츠 발행 캘린더" desc="axhub 계정으로 로그인하면 팀의 콘텐츠 발행 일정을 보고 등록할 수 있어요." returnTo="/" />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  const { rows, truncated } = dbReady ? await listMonth(month) : { rows: [], truncated: false }
  const byDay = new Map<string, CalendarItem[]>()
  for (const c of rows) byDay.set(c.publish_date, [...(byDay.get(c.publish_date) ?? []), c])
  const days = [...byDay.keys()]

  const nav = buttonVariants({ variant: 'outline', size: 'sm' })
  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <PageHeader
            title={`${formatMonth(month)} 발행 캘린더`}
            description={rows.length > 0 ? `이 달에 발행할 콘텐츠가 ${rows.length}건이에요. 누르면 상세가 열려요.` : '이 달에는 아직 발행 일정이 없어요.'}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Link className={nav} href={`/?m=${shiftMonth(month, -1)}`} aria-label="이전 달">
              <CaretLeft size={16} weight="fill" />
            </Link>
            <Link className={nav} href="/">
              이번 달
            </Link>
            <Link className={nav} href={`/?m=${shiftMonth(month, 1)}`} aria-label="다음 달">
              <CaretRight size={16} weight="fill" />
            </Link>
            <Link className={buttonVariants({ variant: 'primary', size: 'sm' })} href="/new">
              <Plus size={16} weight="fill" />
              콘텐츠 등록
            </Link>
          </div>
        </div>

        {!dbReady && <DbNotice />}

        <Card>
          <Card.Content className="flex flex-col gap-4">
            <ul className="flex list-none flex-wrap gap-x-4 gap-y-1 p-0" aria-label="채널 색">
              {(Object.keys(CHANNELS) as Channel[]).map((ch) => (
                <li key={ch} className="t-small">
                  <ChannelLabel channel={ch} />
                </li>
              ))}
            </ul>
            {truncated && <p className="t-small text-muted">이 달은 콘텐츠가 많아 앞의 {MONTH_MAX}건만 그렸어요. 나머지는 목록에서 날짜로 찾아 주세요.</p>}

            <div className="grid grid-cols-7 overflow-hidden rounded-card border border-default [&>*:nth-child(7n)]:border-r-0 [&>*:nth-last-child(-n+7)]:border-b-0">
              {WEEKDAY.map((w, i) => (
                <div key={w} className={`t-caption border-b border-r border-default bg-muted py-1.5 text-center ${i === 0 ? 'text-danger' : ''}`}>
                  {w}
                </div>
              ))}
              {monthGrid(month)
                .flat()
                .map((day, i) => {
                  if (!day) return <div key={`blank-${i}`} className="min-h-14 border-b border-r border-default bg-muted sm:min-h-28" />
                  const items = byDay.get(day) ?? []
                  const isToday = day === today
                  return (
                    <div key={day} className="flex min-h-14 min-w-0 flex-col gap-1 border-b border-r border-default p-1 sm:min-h-28">
                      <span
                        className={`t-caption grid size-6 place-items-center rounded-full ${isToday ? 'bg-primary font-semibold text-on-primary' : i % 7 === 0 ? 'text-danger' : ''}`}
                        aria-current={isToday ? 'date' : undefined}
                      >
                        {Number(day.slice(8))}
                      </span>

                      {/* 좁은 화면 — 색 점만 그리고, 누르면 아래 "이 달 일정" 의 그날로 내려가요. */}
                      {items.length > 0 && (
                        <a href={`#d-${day}`} className="flex flex-wrap gap-1 px-1 sm:hidden" aria-label={`${formatDate(day)} 콘텐츠 ${items.length}건`}>
                          {items.slice(0, 4).map((c) => (
                            <span key={c.id} aria-hidden className={`size-2 rounded-full ${CHANNELS[c.channel].dot}`} />
                          ))}
                          {items.length > 4 && <span className="t-caption leading-none">+{items.length - 4}</span>}
                        </a>
                      )}

                      {/* 넓은 화면 — 채널 색 막대에 제목. */}
                      <ul className="hidden list-none flex-col gap-1 p-0 sm:flex">
                        {items.slice(0, CELL_MAX).map((c) => (
                          <li key={c.id} className="min-w-0">
                            <Link
                              href={`/c/${c.id}`}
                              title={`${c.title} · ${CHANNELS[c.channel].label} · ${c.owner}`}
                              className={`t-caption block truncate rounded-md px-1.5 py-0.5 hover:opacity-80 ${CHANNELS[c.channel].chip} ${c.status === 'published' ? 'line-through decoration-1 opacity-70' : ''}`}
                            >
                              {c.title}
                            </Link>
                          </li>
                        ))}
                        {items.length > CELL_MAX && (
                          <li>
                            <Link href={`/list?date=${day}`} className="t-caption px-1.5 text-muted hover:text-default">
                              +{items.length - CELL_MAX}건 더
                            </Link>
                          </li>
                        )}
                      </ul>
                    </div>
                  )
                })}
            </div>
            <p className="t-caption">발행을 마친 콘텐츠는 줄을 그어 보여요. 날짜는 한국 시간이에요.</p>
          </Card.Content>
        </Card>

        {/* 좁은 화면 전용 — 달력 칸이 작아 제목을 다 못 보여 줘서 날짜별로 한 번 더 펼쳐요. */}
        <Card className="sm:hidden">
          <Card.Header>
            <Card.Title>이 달 일정</Card.Title>
          </Card.Header>
          <Card.Content>
            {days.length === 0 ? (
              <p className="t-small text-muted">이 달에는 아직 발행 일정이 없어요. 위의 콘텐츠 등록으로 첫 일정을 넣어 보세요.</p>
            ) : (
              <ul className="list-none p-0">
                {days.map((day) => (
                  <li key={day} id={`d-${day}`} className="scroll-mt-20 border-b border-default py-3 first:pt-0 last:border-0 last:pb-0">
                    <p className="t-small font-semibold">{formatDate(day)}</p>
                    <ul className="mt-2 flex list-none flex-col gap-2 p-0">
                      {byDay.get(day)!.map((c) => (
                        <li key={c.id}>
                          <Link href={`/c/${c.id}`} className="flex flex-col gap-1 rounded-md p-2 hover:bg-muted">
                            <span className="t-small break-words font-medium">{c.title}</span>
                            <span className="t-caption flex flex-wrap items-center gap-x-3 gap-y-1">
                              <ChannelLabel channel={c.channel} />
                              <span>{c.owner}</span>
                              <StatusLabel status={c.status} />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
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
