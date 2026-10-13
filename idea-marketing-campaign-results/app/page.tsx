import Link from 'next/link'
import { Button, Card, EmptyState, Input, Table, TextField, buttonVariants } from '@heroui/react'
import { Plus } from '@phosphor-icons/react/ssr'
import { AppShell } from '@/components/AppShell'
import { PageHeader, StatCard } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { Pager, pageOf } from '@/components/Pager'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { SORT_LABEL, cpa, ctr, formatInt, formatPct, formatPeriod, formatWon, sortOf, type CampaignSort } from '@/lib/campaign'
import { listCampaigns, summarize, type CampaignRow, type Totals } from '@/lib/campaign-store'

// 로그인한 사람마다 권한이 달라요 — 매 요청 새로 그려요.
export const dynamic = 'force-dynamic'

/** 검색어·정렬·쪽을 유지한 주소. */
function hrefOf(q: string, sort: CampaignSort) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (sort !== 'recent') params.set('sort', sort)
  const qs = params.toString()
  return qs ? `/?${qs}` : '/'
}

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string; page?: string }> }) {
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 50)
  const sort = sortOf(params.sort)
  const page = pageOf(params.page)
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="캠페인 성과" desc="axhub 계정으로 로그인하면 캠페인을 등록하고 성과를 비교할 수 있어요." returnTo="/" />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  let rows: CampaignRow[] = []
  let hasMore = false
  let sum: Totals & { count: number } = { count: 0, cost: 0, impressions: 0, clicks: 0, conversions: 0 }
  if (dbReady) {
    let found
    ;[found, sum] = await Promise.all([listCampaigns(q, sort, page), summarize(q)])
    ;({ rows, hasMore } = found)
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="캠페인 성과"
          description="캠페인마다 날짜별 노출·클릭·전환을 모아 클릭률과 전환당 비용을 비교해요."
          actions={
            <Link className={buttonVariants({ variant: 'primary' })} href="/campaigns/new">
              <Plus size={16} weight="fill" />새 캠페인
            </Link>
          }
        />

        {!dbReady && <DbNotice />}

        <section aria-label={q ? `"${q}" 검색 결과 합계` : '전체 합계'} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={q ? '찾은 캠페인' : '캠페인'} value={`${formatInt(sum.count)}개`} sub={`총 비용 ${formatWon(sum.cost)}`} />
          <StatCard label="전환" value={formatInt(sum.conversions)} sub={`클릭 ${formatInt(sum.clicks)}`} />
          <StatCard label="전체 클릭률" value={formatPct(ctr(sum))} sub={`노출 ${formatInt(sum.impressions)}`} />
          <StatCard label="전체 전환당 비용" value={formatWon(cpa(sum))} sub="총 비용 ÷ 총 전환" />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="t-section-title">캠페인 비교</h2>
          <form method="get" action="/" role="search" className="flex gap-2">
            {sort !== 'recent' && <input type="hidden" name="sort" value={sort} />}
            <TextField name="q" type="search" defaultValue={q} maxLength={50} aria-label="캠페인 이름 · 채널 검색" className="flex-1">
              <Input placeholder="캠페인 이름 · 채널로 찾기" />
            </TextField>
            <Button type="submit" variant="outline">
              찾기
            </Button>
          </form>
          <nav aria-label="정렬" className="flex flex-wrap gap-2">
            {(Object.keys(SORT_LABEL) as CampaignSort[]).map((s) => (
              <Link
                key={s}
                href={hrefOf(q, s)}
                aria-current={s === sort ? 'page' : undefined}
                className={buttonVariants({ variant: s === sort ? 'secondary' : 'ghost', size: 'sm' })}
              >
                {SORT_LABEL[s]}
              </Link>
            ))}
          </nav>

          {rows.length === 0 ? (
            <Card>
              <Card.Content>
                <EmptyState>
                  {q
                    ? `"${q}" 에 맞는 캠페인이 없어요.`
                    : page > 1
                      ? '이 쪽에는 캠페인이 없어요.'
                      : '아직 캠페인이 없어요. 오른쪽 위 "새 캠페인" 으로 첫 캠페인을 등록해 보세요.'}
                </EmptyState>
              </Card.Content>
            </Card>
          ) : (
            <Card>
              <Card.Content>
                {/* 넓은 화면 — 한 줄에 한 캠페인을 놓고 숫자를 나란히 비교해요. */}
                <div className="hidden lg:block">
                  <Table>
                    <Table.ScrollContainer>
                      <Table.Content aria-label="캠페인 비교표">
                        <Table.Header>
                          <Table.Column isRowHeader>캠페인</Table.Column>
                          <Table.Column className="text-right">비용</Table.Column>
                          <Table.Column className="text-right">노출</Table.Column>
                          <Table.Column className="text-right">클릭</Table.Column>
                          <Table.Column className="text-right">전환</Table.Column>
                          <Table.Column className="text-right">클릭률</Table.Column>
                          <Table.Column className="text-right">전환당 비용</Table.Column>
                        </Table.Header>
                        <Table.Body>
                          {rows.map((c) => (
                            <Table.Row key={c.id} id={c.id}>
                              <Table.Cell>
                                <Link href={`/campaigns/${c.id}`} className="block font-semibold text-primary hover:underline">
                                  {c.name}
                                </Link>
                                <span className="t-caption block">
                                  {c.channel} · {formatPeriod(c.start_date, c.end_date)}
                                </span>
                              </Table.Cell>
                              <Table.Cell className="text-right tabular-nums">{formatWon(c.cost)}</Table.Cell>
                              <Table.Cell className="text-right tabular-nums">{formatInt(c.impressions)}</Table.Cell>
                              <Table.Cell className="text-right tabular-nums">{formatInt(c.clicks)}</Table.Cell>
                              <Table.Cell className="text-right tabular-nums">{formatInt(c.conversions)}</Table.Cell>
                              <Table.Cell className="text-right tabular-nums">{formatPct(ctr(c))}</Table.Cell>
                              <Table.Cell className="text-right font-semibold tabular-nums">{formatWon(cpa(c))}</Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Content>
                    </Table.ScrollContainer>
                  </Table>
                </div>

                {/* 좁은 화면 — 캠페인마다 숫자를 두 줄로 접어요 (가로 스크롤 없이). */}
                <ul className="list-none p-0 lg:hidden">
                  {rows.map((c) => (
                    <li key={c.id} className="flex flex-col gap-2 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <Link href={`/campaigns/${c.id}`} className="t-small block font-semibold break-words text-primary hover:underline">
                          {c.name}
                        </Link>
                        <p className="t-caption">
                          {c.channel} · {formatPeriod(c.start_date, c.end_date)}
                        </p>
                      </div>
                      <dl className="t-small m-0 grid grid-cols-3 gap-x-3 gap-y-2 tabular-nums">
                        {(
                          [
                            ['비용', formatWon(c.cost)],
                            ['클릭률', formatPct(ctr(c))],
                            ['전환당 비용', formatWon(cpa(c))],
                            ['노출', formatInt(c.impressions)],
                            ['클릭', formatInt(c.clicks)],
                            ['전환', formatInt(c.conversions)],
                          ] as const
                        ).map(([k, v]) => (
                          <div key={k} className="min-w-0">
                            <dt className="t-caption">{k}</dt>
                            <dd className="m-0 break-words">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  ))}
                </ul>
                <Pager basePath="/" q={q} extra={sort !== 'recent' ? { sort } : undefined} page={page} hasNext={hasMore} />
              </Card.Content>
            </Card>
          )}
          <p className="t-caption">클릭률 = 클릭 ÷ 노출 · 전환당 비용 = 비용 ÷ 전환. 노출이나 전환이 0 이면 계산할 수 없어 – 로 보여요.</p>
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
 *    const rows = await db()<{ id: string; name: string }[]>`
 *      SELECT id::text, name FROM campaigns WHERE owner_key = ${userKey} ORDER BY id DESC LIMIT 50`;
 *    // 새 테이블이 필요하면 lib/db.ts 의 ensureSchema() 에 CREATE TABLE IF NOT EXISTS 를 추가.
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
