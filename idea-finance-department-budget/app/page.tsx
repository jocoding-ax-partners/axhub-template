import Link from 'next/link'
import { Card, EmptyState, buttonVariants } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { SearchForm } from '@/components/SearchForm'
import { StatusTable } from '@/components/StatusTable'
import { YearNav } from '@/components/YearNav'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { WARN_RATE, formatRate, formatWon, isBudgetAdmin, kstToday, parseYear, usageRate } from '@/lib/budget'
import { getTotals, listStatus, type DeptStatus, type Totals } from '@/lib/budget-store'

// 로그인한 사람마다 내용이 달라요 — 매 요청 새로 그려요.
export const dynamic = 'force-dynamic'

type Params = { year?: string; q?: string; page?: string }

export default async function Home({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const year = parseYear(params.year, Number(kstToday().slice(0, 4)))
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="부서 예산 현황" desc="axhub 계정으로 로그인하면 부서별 예산과 집행액을 볼 수 있어요." returnTo="/" />
      </AppShell>
    )
  }

  const admin = isBudgetAdmin(visitor)
  const dbReady = isDbConfigured()
  let totals: Totals = { budget: 0, spent: 0, departments: 0, warn: 0 }
  let rows: DeptStatus[] = []
  let hasMore = false
  if (dbReady) {
    let found
    ;[totals, found] = await Promise.all([getTotals(year), listStatus(year, q, page)])
    ;({ rows, hasMore } = found)
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <PageHeader
            title="부서 예산 현황"
            description={`부서마다 예산 대비 집행액과 남은 예산이에요. 집행률 ${WARN_RATE}% 이상인 부서는 빨갛게 표시돼요.`}
          />
          <YearNav basePath="/" year={year} />
        </div>

        {!dbReady && <DbNotice />}

        <section aria-label={`${year}년 합계`} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={`${year}년 총 예산`} value={formatWon(totals.budget)} sub={`예산을 등록한 부서 ${totals.departments}곳`} />
          <StatCard label="집행액" value={formatWon(totals.spent)} sub={`${year}년 집행 건을 모두 더한 값`} />
          <StatCard
            label="남은 예산"
            value={<span className={totals.spent > totals.budget ? 'text-danger' : 'text-primary'}>{formatWon(totals.budget - totals.spent)}</span>}
            sub="총 예산 − 집행액"
          />
          <StatCard
            label="전체 집행률"
            value={formatRate(usageRate(totals.budget, totals.spent))}
            sub={totals.warn > 0 ? <span className="text-danger">{`${WARN_RATE}% 넘은 부서 ${totals.warn}곳`}</span> : `${WARN_RATE}% 넘은 부서 없음`}
          />
        </section>

        <Card>
          <Card.Header>
            <Card.Title>{year}년 부서별 현황</Card.Title>
            <Card.Description>집행액은 집행 날짜가 {year}년인 건만 더해요.</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <SearchForm action="/" year={year} q={q} placeholder="부서 이름으로 찾기" />
            {rows.length === 0 ? (
              <EmptyState className="flex flex-col items-center gap-3">
                {q ? (
                  `'${q}' 가 들어간 부서가 없어요.`
                ) : page > 1 ? (
                  '이 쪽에는 부서가 없어요.'
                ) : admin ? (
                  <>
                    <span>아직 부서가 없어요. 부서를 만들고 연간 예산을 등록해 주세요.</span>
                    <Link className={buttonVariants({ variant: 'primary', size: 'sm' })} href={`/admin?year=${year}`}>
                      부서 · 예산 관리로 가기
                    </Link>
                  </>
                ) : (
                  '아직 등록된 부서가 없어요. 관리자가 부서 예산을 등록하면 여기에 보여요.'
                )}
              </EmptyState>
            ) : (
              <StatusTable rows={rows} />
            )}
            <Pager basePath="/" query={{ year: String(year), q }} page={page} hasNext={hasMore} />
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
