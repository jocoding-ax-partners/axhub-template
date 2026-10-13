import Link from 'next/link'
import { Card, buttonVariants } from '@heroui/react'
import { Plus } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { hrefWith } from '@/components/Pager'
import { PaymentList } from '@/components/PaymentList'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatDate, formatWon, kstToday, weekRange } from '@/lib/payment'
import { getHomeSummary, listOverdue, listThisWeek, type HomeSummary, type Page, type PaymentRow } from '@/lib/payment-store'

// 오늘 날짜와 방문자에 따라 내용이 달라요 — 매 요청 새로 그려요.
export const dynamic = 'force-dynamic'

const EMPTY_PAGE: Page<PaymentRow> = { rows: [], hasMore: false }

export default async function Home() {
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="거래처 지급 일정" desc="axhub 계정으로 로그인하면 이번 주 지급할 건과 밀린 지급을 볼 수 있어요." returnTo="/" />
      </AppShell>
    )
  }

  const today = kstToday()
  const { monday, sunday } = weekRange(today)
  const dbReady = isDbConfigured()
  let summary: HomeSummary = { week_count: 0, week_total: 0, overdue_count: 0, overdue_total: 0, paid_count: 0, paid_total: 0 }
  let week = EMPTY_PAGE
  let late = EMPTY_PAGE
  if (dbReady) [summary, week, late] = await Promise.all([getHomeSummary(today), listThisWeek(today), listOverdue(today)])

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="이번 주 지급"
          description={`${formatDate(monday, today)} ~ ${formatDate(sunday, today)} · 오늘은 ${formatDate(today, today)}이에요.`}
          actions={
            <Link className={buttonVariants({ variant: 'primary' })} href="/payments#new">
              <Plus size={16} weight="fill" />
              지급 건 등록
            </Link>
          }
        />

        {!dbReady && <DbNotice />}

        <section aria-label="이번 주 요약" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="이번 주 지급 예정"
            value={<span className="text-primary tabular-nums">{formatWon(summary.week_total)}</span>}
            sub={`${summary.week_count}건 · 오늘부터 일요일까지`}
          />
          <StatCard
            label="지급 지연"
            value={<span className={`tabular-nums ${summary.overdue_count > 0 ? 'text-danger' : ''}`}>{formatWon(summary.overdue_total)}</span>}
            sub={summary.overdue_count > 0 ? `${summary.overdue_count}건 · 예정일이 지났어요` : '밀린 지급이 없어요'}
          />
          <StatCard label="이번 주 지급 완료" value={<span className="tabular-nums">{formatWon(summary.paid_total)}</span>} sub={`${summary.paid_count}건 · 월요일부터 오늘까지`} />
        </section>

        <Card>
          <Card.Header>
            <Card.Title>이번 주 지급 예정</Card.Title>
            <Card.Description>오늘부터 이번 주 일요일까지 지급할 건이에요. 예정일이 빠른 순서예요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <PaymentList rows={week.rows} today={today} viewer={visitor} empty="이번 주에 남은 지급이 없어요." />
            {week.hasMore && <MoreLink href={hrefWith('/payments', { filter: 'unpaid' })} label="미지급 건 전체 보기" />}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>지급 지연</Card.Title>
            <Card.Description>예정일이 지났는데 아직 지급 완료로 바꾸지 않은 건이에요. 오래 밀린 순서예요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <PaymentList rows={late.rows} today={today} viewer={visitor} empty="밀린 지급이 없어요." />
            {late.hasMore && <MoreLink href={hrefWith('/payments', { filter: 'overdue' })} label={`지연 ${summary.overdue_count}건 전체 보기`} />}
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}

function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="mt-4 flex justify-center">
      <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={href}>
        {label}
      </Link>
    </div>
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
