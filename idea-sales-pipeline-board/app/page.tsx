import Link from 'next/link'
import { Button, Input, TextField, buttonVariants } from '@heroui/react'
import { Plus } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard } from '@/components/ax'
import { Board } from '@/components/Board'
import { DbNotice, LoginCard } from '@/components/Notices'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { STAGES, cleanQuery, formatWon, isClosed, kstToday } from '@/lib/pipeline'
import { getBoard, type DealRow, type StageSummary } from '@/lib/pipeline-store'

// 로그인한 사람마다, 매 요청 새로 그려요 (다른 사람이 옮긴 카드도 바로 보이게).
export const dynamic = 'force-dynamic'

const EMPTY_SUMMARY = Object.fromEntries(STAGES.map((s) => [s, { count: 0, total: '0' }])) as StageSummary

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = cleanQuery((await searchParams).q)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="영업 파이프라인" desc="axhub 계정으로 로그인하면 팀의 거래 카드를 보고 단계를 옮길 수 있어요." returnTo="/" />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let cards: DealRow[] = []
  let summary = EMPTY_SUMMARY
  if (dbReady) ({ cards, summary } = await getBoard(q))

  const open = STAGES.filter((s) => !isClosed(s))
  const openCount = open.reduce((n, s) => n + summary[s].count, 0)
  const openTotal = open.reduce((n, s) => n + BigInt(summary[s].total), BigInt(0))
  const nothingYet = dbReady && !q && STAGES.every((s) => summary[s].count === 0)

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="영업 파이프라인"
          description="거래 카드를 다른 열로 끌어다 놓거나, 카드 아래 화살표 · 옮기기 버튼으로 단계를 바꿔요."
          actions={
            <Link href="/deals/new" className={buttonVariants({ variant: 'primary' })}>
              <Plus size={16} weight="fill" />
              새 거래
            </Link>
          }
        />

        {!dbReady && <DbNotice />}

        <section aria-label="파이프라인 요약" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="진행 중인 거래" value={formatWon(openTotal)} sub={`${openCount}건 · 접촉 · 제안 · 협상`} />
          <StatCard label="계약" value={<span className="text-primary">{formatWon(summary.won.total)}</span>} sub={`${summary.won.count}건`} />
          <StatCard label="실패" value={formatWon(summary.lost.total)} sub={`${summary.lost.count}건`} />
        </section>

        <section className="flex flex-col gap-4">
          <form method="get" action="/" role="search" className="flex gap-2">
            <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="고객사 · 담당자 검색" className="flex-1">
              <Input placeholder="고객사 · 담당자로 찾기" />
            </TextField>
            <Button type="submit" variant="outline">
              찾기
            </Button>
            {q && (
              <Link href="/" className={buttonVariants({ variant: 'ghost' })}>
                전체 보기
              </Link>
            )}
          </form>
          {q && <p className="t-small">&quot;{q}&quot; 로 찾은 거래만 보여요. 열 위 건수 · 합계도 찾은 거래 기준이에요.</p>}
          {nothingYet && (
            <p className="t-small">아직 거래가 없어요. 오른쪽 위 「새 거래」 로 첫 카드를 만들어 보세요.</p>
          )}
          <Board key={q} cards={cards} summary={summary} today={kstToday()} q={q} />
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
