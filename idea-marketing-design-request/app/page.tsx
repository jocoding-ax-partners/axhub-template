import Link from 'next/link'
import { Card, buttonVariants } from '@heroui/react'
import { Plus } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { RequestList, SearchForm } from '@/components/RequestList'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { kstToday, type DesignStatus } from '@/lib/design'
import { countByStatus, listMyRequests, type Page, type RequestRow } from '@/lib/design-store'

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
        <LoginCard title="디자인 요청" desc="axhub 계정으로 로그인하면 디자인을 요청하고 진행 단계와 결과물을 볼 수 있어요." returnTo="/" />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let list: Page<RequestRow> = { rows: [], hasMore: false, total: 0 }
  let counts: Record<DesignStatus, number> = { received: 0, in_progress: 0, review: 0, done: 0 }
  if (dbReady) [list, counts] = await Promise.all([listMyRequests(visitor.user_id, q, page), countByStatus(visitor.user_id)])

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="내 디자인 요청"
          description={`${visitor.name || visitor.email}님이 올린 요청의 진행 단계와 결과물이에요.`}
          actions={
            <Link className={buttonVariants({ variant: 'primary' })} href="/new">
              <Plus size={16} weight="fill" />새 요청
            </Link>
          }
        />

        {!dbReady && <DbNotice />}

        <section aria-label="내 요청 요약" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="진행 중"
            value={<span className="text-primary">{counts.received + counts.in_progress}건</span>}
            sub={`접수 ${counts.received} · 작업 중 ${counts.in_progress}`}
          />
          <StatCard label="검토 요청" value={`${counts.review}건`} sub="결과물을 확인해 주세요" />
          <StatCard label="완료" value={`${counts.done}건`} sub="결과물을 내려받을 수 있어요" />
        </section>

        <Card>
          <Card.Header>
            <Card.Title>요청 목록</Card.Title>
            <Card.Description>최근에 올린 요청부터 보여요. 줄을 누르면 결과물과 자세한 내용을 볼 수 있어요.</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <SearchForm action="/" q={q} label="문구 · 크기로 찾기" />
            {q && <p className="t-small text-muted">&quot;{q}&quot; 로 찾은 요청이 {list.total}건이에요.</p>}
            <RequestList
              rows={list.rows}
              today={kstToday()}
              empty={
                q ? '찾는 요청이 없어요.' : page > 1 ? '이 쪽에는 요청이 없어요.' : '아직 올린 요청이 없어요. 「새 요청」 을 눌러 첫 요청을 올려 보세요.'
              }
            />
            <Pager basePath="/" q={q} page={page} hasNext={list.hasMore} />
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
 *    import { db, ensureSchema } from "@/lib/db";
 *    await ensureSchema();                       // 첫 read/write 전에 한 번
 *    // 값은 tagged-template 으로 — 자동 바인딩되어 SQL 인젝션 안전. 문자열 이어붙이기 금지.
 *    const rows = await db()<{ id: string }[]>`SELECT id::text FROM design_requests WHERE requester_key = ${userKey} LIMIT 50`;
 *    // 새 테이블이 필요하면 lib/db.ts 의 ensureSchema() 에 CREATE TABLE IF NOT EXISTS 를 추가.
 *    // 이 앱의 읽기·쓰기는 lib/design-store.ts 에 모여 있어요.
 *
 * 3) 파일 저장 · axhub 파일 저장소 (S3 호환, 비공개 버킷)
 *    import { putFile, signedUrl } from "@/lib/storage";
 *    // 올리기 전에 내용(매직 바이트)으로 형식을 확인하고(lib/design.ts sniffFileType),
 *    // 보여 줄 땐 권한 확인 뒤 5분짜리 임시 주소로만 보낸다 (app/files/[id]/route.ts).
 *
 * 4) Gateway · 외부 DB/SaaS 조회  (connector 이름으로, parameterized SQL, audit log)
 *    ⚠️ 사용자 쿠키가 필요해 **회사 앱 주소에서만** 동작 — 퍼블릭·커스텀 도메인 앱은 미지원.
 *    import { queryConnector } from "@/lib/axhub-server";
 *
 * 5) 에러 처리
 *    - DB(lib/db.ts) 호출은 표준 postgres 에러를 던져요 — try/catch 로 감싸요.
 *    - SDK(gateway) 호출은 AxHubError — e.code / e.category / e.requestId 로 분기.
 * ───────────────────────────────────────────────────────────────────────────── */
