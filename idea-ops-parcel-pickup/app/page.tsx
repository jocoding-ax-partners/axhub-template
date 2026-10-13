import { Alert, Card, Chip, EmptyState } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { ParcelAction } from '@/components/ParcelAction'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { KIND_LABEL, daysWaiting, formatDateTime, waitingLabel } from '@/lib/parcel'
import { MY_WAITING_MAX, listMyReceived, listMyWaiting, type Parcel } from '@/lib/parcel-store'

// 로그인한 사람마다 내용이 달라요 — 매 요청 새로 그려요.
export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageOf((await searchParams).page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="택배·우편 수령" desc="axhub 계정으로 로그인하면 나에게 온 택배를 보고 수령 처리할 수 있어요." returnTo="/" />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  // 받는 사람은 이메일로 찾아요. axhub 계정에 이메일이 없으면 나에게 온 택배를 찾을 수 없어요.
  const hasEmail = visitor.email !== ''
  let waiting: Parcel[] = []
  let received: Parcel[] = []
  let hasMore = false
  if (dbReady && hasEmail) {
    let history
    ;[waiting, history] = await Promise.all([listMyWaiting(visitor.email), listMyReceived(visitor.email, page)])
    ;({ rows: received, hasMore } = history)
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="내 택배"
          description={
            waiting.length > 0
              ? `${visitor.name || visitor.email}님에게 온 택배·우편이 ${waiting.length >= MY_WAITING_MAX ? `${MY_WAITING_MAX}건 넘게` : `${waiting.length}건`} 기다리고 있어요.`
              : `${visitor.name || visitor.email}님에게 온 택배와 우편이에요.`
          }
        />

        {!dbReady && <DbNotice />}
        {!hasEmail && (
          <Alert status="warning" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>로그인 계정에 이메일이 없어요</Alert.Title>
              <Alert.Description>택배는 받는 사람 이메일로 찾아요. 이메일이 있는 axhub 계정으로 다시 로그인해 주세요.</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <Card>
          <Card.Header>
            <Card.Title>찾아갈 택배</Card.Title>
            <Card.Description>보관 위치에서 가져간 뒤 수령을 눌러 주세요. 먼저 도착한 것부터 보여요.</Card.Description>
          </Card.Header>
          <Card.Content>
            {waiting.length === 0 ? (
              <EmptyState>지금 찾아갈 택배가 없어요. 택배가 도착하면 여기에 보여요.</EmptyState>
            ) : (
              <ul className="list-none p-0">
                {waiting.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col gap-3 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="t-small flex flex-wrap items-center gap-2 font-semibold">
                        <Chip size="sm">{KIND_LABEL[p.kind]}</Chip>
                        <span className="break-words">{p.sender}</span>
                      </p>
                      <p className="t-small mt-2 break-words">
                        보관 위치 <span className="font-semibold text-primary">{p.location}</span>
                      </p>
                      {p.memo && <p className="t-small mt-1 break-words text-muted">메모: {p.memo}</p>}
                      <p className="t-caption mt-1">
                        {formatDateTime(p.arrived_at)} 도착 · {waitingLabel(daysWaiting(p.arrived_at))}
                      </p>
                    </div>
                    <ParcelAction
                      action="receive"
                      id={p.id}
                      label="수령"
                      primary
                      confirm={{
                        title: `${p.sender} ${KIND_LABEL[p.kind]}을 가져가셨나요?`,
                        description: '수령 처리하면 안내데스크 목록에서 빠지고 되돌릴 수 없어요.',
                        confirmLabel: '수령',
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>받은 기록</Card.Title>
            <Card.Description>최근에 받은 것부터 보여요.</Card.Description>
          </Card.Header>
          <Card.Content>
            {received.length === 0 ? (
              <EmptyState>{page > 1 ? '이 쪽에는 기록이 없어요.' : '아직 받은 택배가 없어요.'}</EmptyState>
            ) : (
              <ul className="list-none p-0">
                {received.map((p) => (
                  <li key={p.id} className="flex flex-col gap-1 border-b border-default py-3 first:pt-0 last:border-0 last:pb-0">
                    <p className="t-small flex flex-wrap items-center gap-2">
                      <Chip size="sm">{KIND_LABEL[p.kind]}</Chip>
                      <span className="break-words">{p.sender}</span>
                    </p>
                    <p className="t-caption">
                      {formatDateTime(p.arrived_at)} 도착 · {p.received_at && formatDateTime(p.received_at)} 수령
                      {p.received_by_key !== visitor.user_id && p.received_by_name && ` (${p.received_by_name}님이 처리)`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Pager basePath="/" params={{}} page={page} hasNext={hasMore} />
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
