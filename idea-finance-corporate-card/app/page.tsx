import Link from 'next/link'
import { Alert, Card, buttonVariants } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { ExpenseForm } from '@/components/ExpenseForm'
import { ExpenseList, MonthNav, SearchForm } from '@/components/ExpenseList'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, hrefWith, pageOf } from '@/components/Pager'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatMonth, formatWon, kstToday, parseMonth } from '@/lib/card'
import { countMyMissing, departmentHints, listMine, type ExpenseRow } from '@/lib/card-store'

// 로그인한 사람마다 내용이 달라요 — 매 요청 새로 그려요.
export const dynamic = 'force-dynamic'

type Search = { month?: string; q?: string; missing?: string; page?: string }

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams
  const today = kstToday()
  const thisMonth = today.slice(0, 7)
  const missingOnly = params.missing === '1'
  // "용도 미기재 모아 보기" 는 달을 가리지 않아요.
  const month = missingOnly ? null : (parseMonth(params.month) ?? thisMonth)
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)

  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="법인카드 사용 내역" desc="axhub 계정으로 로그인하면 카드 사용 건을 입력하고 내 내역을 볼 수 있어요." returnTo="/" />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let rows: ExpenseRow[] = []
  let hasMore = false
  let total = 0
  let sum = 0
  let missing = 0
  let hints = { departments: [] as string[], mine: '' }
  if (dbReady) {
    let found
    ;[found, missing, hints] = await Promise.all([
      listMine(visitor.user_id, { month, q, missingOnly, page }),
      countMyMissing(visitor.user_id),
      departmentHints(visitor.user_id),
    ])
    ;({ rows, hasMore, total, sum } = found)
  }

  const keep = { month: month && month !== thisMonth ? month : undefined, missing: missingOnly ? '1' : undefined }
  const listTitle = missingOnly ? '용도를 안 적은 내 사용 건' : `${month ? formatMonth(month) : ''} 내 사용 건`

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="내 사용 내역" description={`${visitor.name || visitor.email}님이 입력한 법인카드 사용 건이에요.`} />

        {!dbReady && <DbNotice />}

        {missing > 0 && !missingOnly && (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>용도를 안 적은 사용 건이 {missing}건 있어요</Alert.Title>
              <Alert.Description>모아 보고 한 번에 채워 주세요.</Alert.Description>
            </Alert.Content>
            <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href="/?missing=1">
              모아 보기
            </Link>
          </Alert>
        )}

        <Card>
          <Card.Header>
            <Card.Title>사용 건 입력</Card.Title>
            <Card.Description>카드를 쓴 날, 가맹점, 금액, 부서를 적어요. 용도는 나중에 채워도 돼요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <ExpenseForm today={today} departments={hints.departments} myDepartment={hints.mine} />
          </Card.Content>
        </Card>

        <section className="flex flex-col gap-4" aria-label={listTitle}>
          {missingOnly ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="t-section-title">{listTitle}</h2>
              <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href="/">
                월별 보기로
              </Link>
            </div>
          ) : (
            <MonthNav basePath="/" month={month ?? thisMonth} thisMonth={thisMonth} />
          )}
          <SearchForm basePath="/" q={q} keep={keep} placeholder="가맹점 · 부서 · 용도로 찾기" />
          <Card>
            <Card.Header>
              <Card.Title>{listTitle}</Card.Title>
              <Card.Description>
                {q ? `"${q}" 로 찾은 ` : ''}
                {total}건 · 합계 {formatWon(sum)}
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <ExpenseList
                rows={rows}
                viewerKey={visitor.user_id}
                showOwner={false}
                empty={
                  q
                    ? '찾는 사용 건이 없어요.'
                    : page > 1
                      ? '이 쪽에는 사용 건이 없어요.'
                      : missingOnly
                        ? '용도를 안 적은 사용 건이 없어요.'
                        : '이 달에 입력한 사용 건이 없어요. 위에서 첫 사용 건을 입력해 보세요.'
                }
              />
              <Pager basePath="/" params={{ ...keep, q: q || undefined }} page={page} hasNext={hasMore} />
            </Card.Content>
          </Card>
          {q && (
            <Link className={`${buttonVariants({ variant: 'ghost', size: 'sm' })} self-start`} href={hrefWith('/', keep)}>
              검색 지우기
            </Link>
          )}
        </section>
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
 *    import { db, ensureSchema } from "@/lib/db";
 *    await ensureSchema();                       // 첫 read/write 전에 한 번
 *    // 값은 tagged-template 으로 — 자동 바인딩되어 SQL 인젝션 안전. 문자열 이어붙이기 금지.
 *    const rows = await db()<{ id: string; merchant: string }[]>`
 *      SELECT id::text, merchant FROM card_expenses WHERE user_key = ${userKey} ORDER BY id DESC LIMIT 50`;
 *    // 새 테이블이 필요하면 lib/db.ts 의 ensureSchema() 에 CREATE TABLE IF NOT EXISTS 를 추가.
 *    // 이 앱의 읽기·쓰기는 lib/card-store.ts 에 모여 있다 — 화면에서 SQL 을 직접 쓰지 않는다.
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
