import Link from 'next/link'
import { Alert, Card, EmptyState, buttonVariants } from '@heroui/react'
import { CaretRight } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard, StatusDot } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatDateTime, formatScore, isRecruiter, normalizeEmail } from '@/lib/interview'
import { listMyInterviews, type MyInterview } from '@/lib/interview-store'

// 로그인한 사람마다 내용이 달라요 — 매 요청 새로 그려요.
export const dynamic = 'force-dynamic'

function Status({ row }: { row: MyInterview }) {
  if (row.result) return <StatusDot tone="muted">평가 마감</StatusDot>
  if (row.my_overall !== null) return <StatusDot tone="active">제출함 · 종합 {formatScore(row.my_overall)}</StatusDot>
  return <StatusDot tone="warning">평가 전</StatusDot>
}

export default async function MyInterviews({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageOf((await searchParams).page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="면접 일정·평가표" desc="axhub 계정으로 로그인하면 내가 맡은 면접을 보고 평가를 남길 수 있어요." returnTo="/" />
      </AppShell>
    )
  }

  const email = normalizeEmail(visitor.email)
  const dbReady = isDbConfigured()
  const found = dbReady && email ? await listMyInterviews(email, page) : { rows: [], hasMore: false, todo: 0, done: 0 }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="내 면접" description={`${visitor.name || visitor.email}님이 면접관으로 배정된 지원자예요. 면접이 끝나면 평가를 남겨 주세요.`} />

        {!dbReady && <DbNotice />}
        {!email && (
          <Alert status="warning" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>axhub 계정에 이메일이 없어요</Alert.Title>
              <Alert.Description>면접관은 로그인 이메일로 배정돼요. 이메일이 있는 계정으로 로그인해 주세요.</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <section aria-label="내 평가 현황" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard label="평가할 면접" value={<span className="text-primary">{found.todo}건</span>} sub="아직 평가를 내지 않은 지원자" />
          <StatCard label="제출한 평가" value={`${found.done}건`} sub="결과가 기록되기 전까지 고칠 수 있어요" />
        </section>

        <Card>
          <Card.Header>
            <Card.Title>배정된 면접</Card.Title>
            <Card.Description>평가할 면접이 먼저, 그 안에서는 면접 일시 순서로 보여요. 시각은 한국 시간이에요.</Card.Description>
          </Card.Header>
          <Card.Content>
            {found.rows.length === 0 ? (
              <EmptyState className="flex flex-col items-center gap-3">
                {page > 1 ? (
                  '이 쪽에는 면접이 없어요.'
                ) : (
                  <>
                    <span>아직 배정된 면접이 없어요. 채용 담당자가 지원자를 등록하면서 내 이메일을 면접관으로 적으면 여기에 보여요.</span>
                    {isRecruiter(visitor) && (
                      <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href="/candidates">
                        지원자 등록하러 가기
                      </Link>
                    )}
                  </>
                )}
              </EmptyState>
            ) : (
              <ul className="list-none p-0">
                {found.rows.map((r) => (
                  <li key={r.id} className="border-b border-default last:border-0">
                    <Link
                      href={`/interviews/${r.id}`}
                      className="flex items-center justify-between gap-3 py-4 hover:bg-muted sm:px-2"
                    >
                      <div className="min-w-0">
                        <p className="t-small font-semibold break-words">
                          {r.name} <span className="font-normal text-muted">· {r.position}</span>
                        </p>
                        <p className="t-caption mt-1">{formatDateTime(r.interview_at)}</p>
                        <div className="t-small mt-2">
                          <Status row={r} />
                        </div>
                      </div>
                      <CaretRight size={16} weight="fill" className="shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Pager basePath="/" page={page} hasNext={found.hasMore} />
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
