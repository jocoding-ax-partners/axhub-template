import { Button, Card, EmptyState, Input, TextField } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard } from '@/components/ax'
import { RequestForm } from '@/components/forms'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { SupplyItem } from '@/components/SupplyItem'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { isAdmin } from '@/lib/supply'
import { getSummary, listSupplies, type Summary, type SupplyRow } from '@/lib/supply-store'

// 로그인한 사람마다 내용이 달라요 — 매 요청 새로 그려요.
export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="비품 신청" desc="axhub 계정으로 로그인하면 비품 재고를 보고 필요한 비품을 신청할 수 있어요." returnTo="/" />
      </AppShell>
    )
  }

  const admin = isAdmin(visitor)
  const dbReady = isDbConfigured()
  let summary: Summary = { supplies: 0, short: 0, pending: 0 }
  let rows: SupplyRow[] = []
  let hasMore = false
  let total = 0
  if (dbReady) {
    let found
    ;[summary, found] = await Promise.all([getSummary(), listSupplies(q, page)])
    ;({ rows, hasMore, total } = found)
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="비품" description="필요한 비품의 수량을 적어 신청해요. 관리자가 지급하면 재고에서 빠져요." />

        {!dbReady && <DbNotice />}

        <section aria-label="재고 현황" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="등록된 비품" value={`${summary.supplies}종`} />
          <StatCard
            label="재고 부족"
            value={<span className={summary.short > 0 ? 'text-danger' : undefined}>{summary.short}종</span>}
            sub="최소 재고 아래로 내려간 비품"
          />
          <StatCard label="지급 대기 신청" value={`${summary.pending}건`} sub="모든 직원의 신청" />
        </section>

        <Card>
          <Card.Header>
            <Card.Title>재고 목록</Card.Title>
            <Card.Description>{q ? `"${q}" 로 찾은 비품이 ${total}종이에요.` : '재고가 부족한 비품이 맨 위, 그다음 이름 순서예요.'}</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <form method="get" action="/" role="search" className="flex gap-2">
              <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="비품 이름 검색" className="flex-1">
                <Input placeholder="비품 이름으로 찾기" />
              </TextField>
              <Button type="submit" variant="outline">
                찾기
              </Button>
            </form>

            {rows.length === 0 ? (
              <EmptyState>
                {q
                  ? '찾는 비품이 없어요.'
                  : page > 1
                    ? '이 쪽에는 비품이 없어요.'
                    : admin
                      ? '아직 등록된 비품이 없어요. 비품 관리에서 첫 비품을 등록해 보세요.'
                      : '아직 등록된 비품이 없어요. 관리자가 비품을 등록하면 여기에 보여요.'}
              </EmptyState>
            ) : (
              <ul className="list-none p-0">
                {rows.map((item) => (
                  <SupplyItem key={item.id} item={item} actions={<RequestForm id={item.id} name={item.name} stock={item.stock} />} />
                ))}
              </ul>
            )}
            <Pager basePath="/" q={q} page={page} hasNext={hasMore} />
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
