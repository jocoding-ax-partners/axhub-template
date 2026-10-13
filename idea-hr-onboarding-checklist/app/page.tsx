import Link from 'next/link'
import { Button, Card, EmptyState, Input, TextField } from '@heroui/react'
import { CaretRight } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { FlashToast, HireForm } from '@/components/OnboardingForms'
import { Pager, pageOf } from '@/components/Pager'
import { Progress } from '@/components/Progress'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatDate, kstToday, startLabel } from '@/lib/onboarding'
import { getSummary, listHires, type HireRow, type Summary } from '@/lib/onboarding-store'

// 로그인한 사람마다 내용이 달라요 — 매 요청 새로 그려요.
export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; deleted?: string }> }) {
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 50)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="온보딩 체크리스트" desc="axhub 계정으로 로그인하면 신규 입사자를 등록하고 체크리스트 진행률을 볼 수 있어요." returnTo="/" />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let summary: Summary = { total: 0, inProgress: 0, completed: 0 }
  let rows: HireRow[] = []
  let hasMore = false
  let total = 0
  if (dbReady) {
    let found
    ;[summary, found] = await Promise.all([getSummary(), listHires(q, page)])
    ;({ rows, hasMore, total } = found)
  }
  const today = kstToday()

  return (
    <AppShell>
      {params.deleted === '1' && <FlashToast message="입사자를 지웠어요." />}
      <div className="flex flex-col gap-10">
        <PageHeader title="입사자 목록" description="입사자를 등록하면 기본 체크리스트가 자동으로 붙어요. 누르면 항목을 체크할 수 있어요." />

        {!dbReady && <DbNotice />}

        <section aria-label="온보딩 현황" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="전체 입사자" value={`${summary.total}명`} sub="등록된 모든 입사자" />
          <StatCard label="진행 중" value={<span className="text-primary">{summary.inProgress}명</span>} sub="아직 남은 항목이 있어요" />
          <StatCard label="모두 완료" value={`${summary.completed}명`} sub="체크리스트를 다 끝냈어요" />
        </section>

        <Card>
          <Card.Header>
            <Card.Title>입사자 등록</Card.Title>
            <Card.Description>등록하면 지금의 기본 체크리스트가 복사돼 붙어요. 항목은 「기본 체크리스트」 메뉴에서 관리자가 바꿔요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <HireForm />
          </Card.Content>
        </Card>

        <section className="flex flex-col gap-4">
          <h2 className="t-section-title">입사자 {q ? `· "${q}" 검색 결과 ${total}명` : total > 0 ? `· ${total}명` : ''}</h2>
          <form method="get" action="/" role="search" className="flex gap-2">
            <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="이름 · 부서 검색" className="flex-1">
              <Input placeholder="이름 · 부서로 찾기" />
            </TextField>
            <Button type="submit" variant="outline">
              찾기
            </Button>
          </form>
          <Card>
            <Card.Content>
              {rows.length === 0 ? (
                <EmptyState>
                  {q ? '찾는 입사자가 없어요.' : page > 1 ? '이 쪽에는 입사자가 없어요.' : '아직 등록한 입사자가 없어요. 위에서 첫 입사자를 등록해 보세요.'}
                </EmptyState>
              ) : (
                <ul className="list-none p-0">
                  {rows.map((h) => (
                    <li key={h.id} className="border-b border-default last:border-0">
                      <Link href={`/hires/${h.id}`} className="flex items-center gap-3 py-3 text-default">
                        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
                          <div className="min-w-0 sm:w-1/2">
                            <p className="t-small truncate font-semibold">{h.name}</p>
                            <p className="t-caption truncate">
                              {h.department} · {formatDate(h.start_date)} · {startLabel(h.start_date, today)}
                            </p>
                          </div>
                          <Progress done={h.done} total={h.total} label={h.name} className="sm:flex-1" />
                        </div>
                        <CaretRight size={16} weight="fill" className="shrink-0 text-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Pager basePath="/" q={q} page={page} hasNext={hasMore} />
            </Card.Content>
          </Card>
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
