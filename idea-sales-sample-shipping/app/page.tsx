import Link from 'next/link'
import { Card, EmptyState, buttonVariants } from '@heroui/react'
import { Plus } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { ScopeTabs, ShipmentList } from '@/components/ShipmentList'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { kstToday } from '@/lib/shipment'
import { getSummary, listDue, listRecent, type Shipment, type Summary } from '@/lib/shipment-store'

// 로그인한 사람마다 내용이 달라요 — 매 요청 새로 그려요.
export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams: Promise<{ mine?: string; page?: string }> }) {
  const params = await searchParams
  const page = pageOf(params.page)
  const mine = params.mine === '1'
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="샘플·자료 발송 기록" desc="axhub 계정으로 로그인하면 보낸 샘플·자료를 기록하고 후속 연락일을 챙길 수 있어요." returnTo="/" />
      </AppShell>
    )
  }

  const today = kstToday()
  const owner = mine ? visitor.user_id : null
  const dbReady = isDbConfigured()
  let summary: Summary = { due: 0, upcoming: 0, sentThisMonth: 0 }
  let due: Shipment[] = []
  let hasMore = false
  let recent: Shipment[] = []
  if (dbReady) {
    let found
    ;[summary, found, recent] = await Promise.all([getSummary(today, owner), listDue(today, owner, page), listRecent(owner, 5)])
    ;({ rows: due, hasMore } = found)
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="오늘 할 연락"
          description="후속 연락 예정일이 오늘이거나 지난 발송 건이에요. 연락했으면 완료를 눌러 주세요."
          actions={
            <Link className={buttonVariants({ variant: 'primary' })} href="/shipments/new">
              <Plus size={16} weight="fill" />
              발송 기록하기
            </Link>
          }
        />

        {!dbReady && <DbNotice />}

        <ScopeTabs basePath="/" mine={mine} />

        <section aria-label="요약" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="연락할 때가 된 건"
            value={<span className={summary.due > 0 ? 'text-danger' : undefined}>{summary.due}건</span>}
            sub="예정일이 오늘이거나 지났어요"
          />
          <StatCard label="앞으로 연락할 건" value={`${summary.upcoming}건`} sub="예정일이 내일 이후예요" />
          <StatCard label="이번 달 보낸 건" value={`${summary.sentThisMonth}건`} sub={`${Number(today.slice(5, 7))}월 1일부터`} />
        </section>

        <Card>
          <Card.Header>
            <Card.Title>연락할 때가 된 건</Card.Title>
            <Card.Description>예정일이 오래 지난 것부터 보여요.</Card.Description>
          </Card.Header>
          <Card.Content>
            {due.length === 0 ? (
              <EmptyState>
                {page > 1 ? '이 쪽에는 연락할 건이 없어요.' : '지금 연락할 건이 없어요. 후속 연락 예정일이 되면 여기에 보여요.'}
              </EmptyState>
            ) : (
              <ShipmentList rows={due} today={today} visitor={visitor} />
            )}
            <Pager basePath="/" params={{ mine: mine ? '1' : '' }} page={page} hasNext={hasMore} />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Card.Title>최근 발송</Card.Title>
              {recent.length > 0 && (
                <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} href={mine ? '/shipments?mine=1' : '/shipments'}>
                  전체 보기
                </Link>
              )}
            </div>
          </Card.Header>
          <Card.Content>
            {recent.length === 0 ? (
              <EmptyState className="flex flex-col items-center gap-3">
                <span>아직 기록한 발송이 없어요.</span>
                <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href="/shipments/new">
                  첫 발송 기록하기
                </Link>
              </EmptyState>
            ) : (
              <ShipmentList rows={recent} today={today} visitor={visitor} />
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
