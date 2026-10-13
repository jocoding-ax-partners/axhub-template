import Link from 'next/link'
import { Button, Card, EmptyState, Input, TextField, buttonVariants } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard } from '@/components/ax'
import { ConfirmAction } from '@/components/ConfirmAction'
import { EquipmentItem } from '@/components/EquipmentItem'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { RentForm } from '@/components/RentForm'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { DUE_MAX_DAYS, FILTER_LABEL, addDays, canReturn, filterOf, isAdmin, kstToday, type Filter } from '@/lib/rental'
import { getSummary, listEquipment, type EquipmentRow, type Summary } from '@/lib/rental-store'

// 로그인한 사람마다 버튼이 달라요 — 매 요청 새로 그려요.
export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; page?: string }> }) {
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 50)
  const filter = filterOf(params.f)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="장비 대여" desc="axhub 계정으로 로그인하면 장비를 빌리고 반납할 수 있어요." returnTo="/" />
      </AppShell>
    )
  }

  const today = kstToday()
  const admin = isAdmin(visitor)
  const dbReady = isDbConfigured()
  let summary: Summary = { total: 0, rented: 0, overdue: 0 }
  let rows: EquipmentRow[] = []
  let hasMore = false
  let total = 0
  if (dbReady) {
    let found
    ;[summary, found] = await Promise.all([getSummary(today), listEquipment(q, filter, page, today)])
    ;({ rows, hasMore, total } = found)
  }

  const filterHref = (f: Filter) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (f !== 'all') sp.set('f', f)
    const qs = sp.toString()
    return qs ? `/?${qs}` : '/'
  }
  const narrowed = q || filter !== 'all'

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="장비 목록" description="빌릴 장비를 골라 반납 예정일을 넣고 대여해요. 다 쓰면 반납을 눌러요." />

        {!dbReady && <DbNotice />}

        <section aria-label="장비 현황" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="전체 장비" value={`${summary.total}대`} sub={`대여 가능 ${summary.total - summary.rented}대`} />
          <StatCard label="대여 중" value={`${summary.rented}대`} sub="반납 지연 포함" />
          <StatCard
            label="반납 지연"
            value={<span className={summary.overdue > 0 ? 'text-danger' : undefined}>{summary.overdue}대</span>}
            sub="반납 예정일이 지난 대여"
          />
        </section>

        <Card>
          <Card.Header>
            <Card.Title>장비</Card.Title>
            <Card.Description>
              {narrowed ? `조건에 맞는 장비가 ${total}대예요.` : '종류 · 이름 순서로 보여요. 반납 예정일이 지난 대여는 빨간색이에요.'}
            </Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <nav aria-label="보기" className="flex flex-wrap gap-2">
              {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
                <Link
                  key={f}
                  href={filterHref(f)}
                  aria-current={f === filter ? 'page' : undefined}
                  className={buttonVariants({ variant: f === filter ? 'primary' : 'outline', size: 'sm' })}
                >
                  {FILTER_LABEL[f]}
                </Link>
              ))}
            </nav>
            <form method="get" action="/" role="search" className="flex gap-2">
              {filter !== 'all' && <input type="hidden" name="f" value={filter} />}
              <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="장비 검색" className="flex-1">
                <Input placeholder="이름 · 종류 · 자산 번호 · 빌린 사람으로 찾기" />
              </TextField>
              <Button type="submit" variant="outline">
                찾기
              </Button>
            </form>

            {rows.length === 0 ? (
              <EmptyState>
                {narrowed
                  ? '조건에 맞는 장비가 없어요.'
                  : page > 1
                    ? '이 쪽에는 장비가 없어요.'
                    : admin
                      ? '아직 등록된 장비가 없어요. 장비 관리에서 첫 장비를 등록해 보세요.'
                      : '아직 등록된 장비가 없어요. 관리자가 장비를 등록하면 여기에 보여요.'}
              </EmptyState>
            ) : (
              <ul className="list-none p-0">
                {rows.map((item) => (
                  <EquipmentItem
                    key={item.id}
                    item={item}
                    today={today}
                    actions={
                      !item.rental_id ? (
                        <RentForm id={item.id} name={item.name} min={today} max={addDays(today, DUE_MAX_DAYS)} />
                      ) : item.borrower_key && canReturn(visitor, item.borrower_key) ? (
                        <ConfirmAction
                          action="return"
                          id={item.rental_id}
                          label={item.borrower_key === visitor.user_id ? '반납' : '대신 반납'}
                          confirm={
                            item.borrower_key === visitor.user_id
                              ? { title: `${item.name}을(를) 반납할까요?`, description: '반납하면 다른 사람이 바로 빌릴 수 있어요.', confirmLabel: '반납' }
                              : {
                                  title: `${item.borrower_name || item.borrower_email}님이 빌린 ${item.name}을(를) 반납 처리할까요?`,
                                  description: '장비를 돌려받은 게 맞는지 확인해 주세요. 관리자 이름으로 반납 처리돼요.',
                                  confirmLabel: '반납 처리',
                                }
                          }
                        />
                      ) : undefined
                    }
                  />
                ))}
              </ul>
            )}
            <Pager basePath="/" params={{ q, f: filter === 'all' ? '' : filter }} page={page} hasNext={hasMore} />
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
