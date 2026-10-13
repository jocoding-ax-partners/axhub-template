import type { ReactNode } from 'react'
import Link from 'next/link'
import { Button, Card, Checkbox, Input, Label, TextField, buttonVariants } from '@heroui/react'
import { Plus } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatusDot } from '@/components/ax'
import { LoginRequired, DbMissing } from '@/components/Notices'
import { db, ensureSchema, isDbConfigured } from '@/lib/db'
import { formatDate, relativeDay, todayKst } from '@/lib/dates'
import { currentUser } from '@/lib/user'

// 홈 = 고객사 목록.
//   1) 연락할 때가 된 고객사 — 다음 연락일이 오늘이거나 지난 곳 (오래 밀린 곳부터)
//   2) 나머지 고객사 — 다음 연락일이 가까운 순, 연락일이 없으면 이름순 · 페이지로 나눠 보여요
// 다음 연락일 = 그 고객사의 가장 최근 미팅 기록에 적은 "다음 연락일".

const PAGE_SIZE = 30
const DUE_MAX = 100

type CompanyRow = {
  id: string
  name: string
  contact_name: string
  owner_key: string
  owner_name: string
  last_met: string | null
  next_contact: string | null
  next_action: string | null
}

type SearchParams = { q?: string; mine?: string; page?: string }

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 100)
  const mine = sp.mine === '1'
  const page = Math.max(1, Math.min(1000, Number.parseInt(sp.page ?? '1', 10) || 1))

  const user = await currentUser()
  if (!user) return <LoginRequired returnTo="/" />
  if (!isDbConfigured()) return <DbMissing />

  await ensureSchema()
  const today = todayKst()
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`

  // due=true: 다음 연락일 ≤ 오늘(KST) / due=false: 그 밖의 고객사
  const list = (due: boolean, limit: number, offset: number) => db()<CompanyRow[]>`
    SELECT * FROM (
      SELECT c.id::text, c.name, c.contact_name, c.owner_key, c.owner_name,
             m.met_on::text AS last_met, m.next_contact_on::text AS next_contact, m.next_action
      FROM companies c
      LEFT JOIN LATERAL (
        SELECT met_on, next_contact_on, next_action FROM meetings
        WHERE company_id = c.id ORDER BY met_on DESC, id DESC LIMIT 1
      ) m ON true
      WHERE c.name ILIKE ${like}
        AND (${!mine} OR c.owner_key = ${user.key})
    ) x
    WHERE COALESCE(x.next_contact::date <= ${today}::date, false) = ${due}
    ORDER BY x.next_contact ASC NULLS LAST, x.name, x.id::bigint
    LIMIT ${limit} OFFSET ${offset}`

  const [due, restPlusOne] = await Promise.all([
    list(true, DUE_MAX + 1, 0),
    list(false, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE),
  ])
  const dueMore = due.length > DUE_MAX
  const hasNext = restPlusOne.length > PAGE_SIZE
  const rest = restPlusOne.slice(0, PAGE_SIZE)
  const filtered = q !== '' || mine
  const empty = !filtered && due.length === 0 && rest.length === 0 && page === 1

  const pageHref = (p: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (mine) params.set('mine', '1')
    if (p > 1) params.set('page', String(p))
    const s = params.toString()
    return s ? `/?${s}` : '/'
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="고객사"
          description="연락할 때가 된 고객사를 맨 위에 보여 드려요."
          actions={
            <Link className={buttonVariants()} href="/companies/new">
              <Plus size={16} weight="bold" aria-hidden />
              고객사 등록
            </Link>
          }
        />

        {empty ? (
          <Card className="items-center py-10 text-center">
            <Card.Header className="items-center">
              <Card.Title>아직 등록한 고객사가 없어요</Card.Title>
              <Card.Description>고객사를 등록하고 미팅 기록을 남기면, 다음 연락일에 맞춰 여기에 먼저 보여 드려요.</Card.Description>
            </Card.Header>
            <Card.Footer>
              <Link className={buttonVariants()} href="/companies/new">
                첫 고객사 등록하기
              </Link>
            </Card.Footer>
          </Card>
        ) : (
          <>
            <Card>
              {/* 주소(?q=&mine=1)로 거르는 평범한 GET 폼이라 브라우저 쪽 코드가 필요 없어요. */}
              <form className="flex flex-wrap items-center gap-3" action="/" role="search">
                <TextField className="min-w-0 flex-1 basis-56" name="q" type="search" defaultValue={q} maxLength={100} aria-label="고객사 이름으로 찾기">
                  <Input placeholder="고객사 이름으로 찾기" />
                </TextField>
                <Checkbox name="mine" value="1" defaultSelected={mine}>
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Label>내 담당만</Label>
                  </Checkbox.Content>
                </Checkbox>
                <div className="flex gap-2">
                  <Button type="submit">찾기</Button>
                  {filtered && (
                    <Link className={buttonVariants({ variant: 'ghost' })} href="/">
                      전체 보기
                    </Link>
                  )}
                </div>
              </form>
            </Card>

            {page === 1 && (
              <section className="flex flex-col gap-4">
                <h2 className="t-section-title">
                  연락할 때가 된 고객사 {due.length > 0 && <span className="text-muted">{Math.min(due.length, DUE_MAX)}</span>}
                </h2>
                {due.length === 0 ? (
                  <EmptyCard>오늘 연락할 고객사가 없어요.</EmptyCard>
                ) : (
                  <>
                    <CompanyList rows={due.slice(0, DUE_MAX)} today={today} userKey={user.key} due />
                    {dueMore && <p className="t-caption">밀린 순서로 {DUE_MAX}곳까지만 보여요. 검색으로 좁혀 보세요.</p>}
                  </>
                )}
              </section>
            )}

            <section className="flex flex-col gap-4">
              <h2 className="t-section-title">{filtered ? '찾은 고객사' : '나머지 고객사'}</h2>
              {rest.length === 0 ? (
                <EmptyCard>
                  {filtered ? '조건에 맞는 고객사가 없어요.' : page > 1 ? '이 페이지에는 고객사가 없어요.' : '연락일이 남은 고객사가 없어요.'}
                </EmptyCard>
              ) : (
                <CompanyList rows={rest} today={today} userKey={user.key} />
              )}
              {(page > 1 || hasNext) && (
                <nav className="flex items-center justify-between gap-3" aria-label="페이지">
                  {page > 1 ? (
                    <Link className={buttonVariants({ variant: 'outline' })} href={pageHref(page - 1)}>
                      이전
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="t-caption">{page}쪽</span>
                  {hasNext ? (
                    <Link className={buttonVariants({ variant: 'outline' })} href={pageHref(page + 1)}>
                      다음
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  )
}

function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <Card className="items-center py-8 text-center">
      <p className="t-small text-muted">{children}</p>
    </Card>
  )
}

function CompanyList({ rows, today, userKey, due }: { rows: CompanyRow[]; today: string; userKey: string; due?: boolean }) {
  return (
    <ul className="grid list-none grid-cols-1 gap-3 p-0">
      {rows.map((r) => (
        <li key={r.id}>
          {/* 카드 전체가 고객사 화면으로 가는 링크예요. */}
          <Link
            href={`/companies/${r.id}`}
            className="group block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Card className="gap-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <Card.Title className="min-w-0 break-words group-hover:text-primary">{r.name}</Card.Title>
                <StatusDot tone={due ? 'warning' : r.next_contact ? 'active' : 'muted'}>
                  {r.next_contact ? (
                    <>
                      다음 연락 {formatDate(r.next_contact, today)}{' '}
                      <span className={due ? 'font-semibold' : 'text-muted'}>· {relativeDay(r.next_contact, today)}</span>
                    </>
                  ) : (
                    <span className="text-muted">다음 연락일 없음</span>
                  )}
                </StatusDot>
              </div>
              {r.next_action && <p className="t-small break-words">다음 할 일: {r.next_action}</p>}
              <p className="t-caption flex flex-wrap gap-x-2">
                {r.contact_name && <span>{r.contact_name}</span>}
                <span>최근 미팅 {r.last_met ? formatDate(r.last_met, today) : '없음'}</span>
                <span>담당 {r.owner_key === userKey ? '나' : r.owner_name || '알 수 없음'}</span>
              </p>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
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
