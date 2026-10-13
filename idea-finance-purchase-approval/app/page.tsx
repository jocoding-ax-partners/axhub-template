import { Card, EmptyState } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard, TabNav } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { PurchaseForm } from '@/components/PurchaseForm'
import { PurchaseItem, SearchForm } from '@/components/PurchaseItem'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { STATUS_LABEL, isStatus, won } from '@/lib/purchase'
import { getMySummary, listMyRequests, type MySummary, type Page, type Purchase } from '@/lib/purchase-store'

// 로그인한 사람마다 내용이 달라요 — 매 요청 새로 그려요.
export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const params = await searchParams
  const status = params.status && isStatus(params.status) ? params.status : null
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="구매 요청" desc="axhub 계정으로 로그인하면 구매 요청을 올리고 결재 상태를 볼 수 있어요." returnTo="/" />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let summary: MySummary = { pending: 0, approved: 0, rejected: 0, approvedTotal: 0 }
  let list: Page<Purchase> = { rows: [], hasMore: false, total: 0 }
  if (dbReady) {
    ;[summary, list] = await Promise.all([getMySummary(visitor.user_id), listMyRequests(visitor.user_id, status, q, page)])
  }
  const all = summary.pending + summary.approved + summary.rejected

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="내 구매 요청" description={`${visitor.name || visitor.email}님의 구매 요청과 결재 상태예요.`} />

        {!dbReady && <DbNotice />}

        <section aria-label="내 요청 요약" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="결재 대기" value={<span className="text-primary">{summary.pending}건</span>} sub="관리자가 처리하면 상태가 바뀌어요" />
          <StatCard label="승인" value={`${summary.approved}건`} sub={`승인된 금액 ${won(summary.approvedTotal)}`} />
          <StatCard label="반려" value={`${summary.rejected}건`} sub="반려 사유는 목록에서 볼 수 있어요" />
        </section>

        <Card>
          <Card.Header>
            <Card.Title>새 구매 요청</Card.Title>
            <Card.Description>품목 · 수량 · 단가를 적으면 총액이 자동으로 계산돼요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <PurchaseForm />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="gap-3">
            <Card.Title>내 요청 목록</Card.Title>
            <TabNav
              activeKey={status ?? 'all'}
              tabs={[
                { key: 'all', to: '/', label: '전체', badge: all },
                ...(['pending', 'approved', 'rejected'] as const).map((s) => ({
                  key: s,
                  to: `/?status=${s}`,
                  label: STATUS_LABEL[s],
                  badge: summary[s],
                })),
              ]}
            />
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <SearchForm action="/" q={q} label="품목으로 찾기" hidden={{ status: status ?? '' }} />
            {list.rows.length === 0 ? (
              <EmptyState>
                {q
                  ? '찾는 품목의 요청이 없어요.'
                  : page > 1
                    ? '이 쪽에는 요청이 없어요.'
                    : status
                      ? `${STATUS_LABEL[status]} 상태인 요청이 없어요.`
                      : '아직 올린 요청이 없어요. 위에서 첫 구매 요청을 올려 보세요.'}
              </EmptyState>
            ) : (
              <ul className="list-none p-0">
                {list.rows.map((r) => (
                  <PurchaseItem key={r.id} row={r} />
                ))}
              </ul>
            )}
            <Pager basePath="/" params={{ status: status ?? '', q }} page={page} hasNext={list.hasMore} />
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
