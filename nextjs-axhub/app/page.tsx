import { revalidatePath } from 'next/cache'
import { AppShell } from '@/components/AppShell'
import { isAxhubConfigured, me } from '@/lib/axhub-server'
import { db, ensureSchema, isDbConfigured } from '@/lib/db'

// 데이터를 가를 사용자 키. 로그인 사용자는 email, 익명 방문자는 'anonymous', 로컬은 'local-dev'.
// 자기 데이터만 보이게 하려면 모든 쿼리를 이 값으로 필터하면 돼요.
async function currentUserKey(): Promise<string> {
  if (!isAxhubConfigured()) return 'local-dev'
  const visitor = await me()
  return visitor.authenticated ? visitor.email : 'anonymous'
}

type Todo = { id: string; title: string; done: boolean }

async function listTodos(userKey: string): Promise<Todo[]> {
  await ensureSchema()
  return await db()<Todo[]>`
    SELECT id::text, title, done
    FROM todos
    WHERE user_key = ${userKey}
    ORDER BY id DESC
    LIMIT 50
  `
}

// 서버 액션 — 할 일 추가 (표준 Postgres INSERT, 값은 자동 바인딩 → 인젝션 안전)
async function addTodo(formData: FormData) {
  'use server'
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return
  await ensureSchema()
  const userKey = await currentUserKey()
  await db()`INSERT INTO todos (user_key, title) VALUES (${userKey}, ${title})`
  revalidatePath('/')
}

// 서버 액션 — 완료 토글 (자기 행만 — user_key 로 한 번 더 가드)
async function toggleTodo(formData: FormData) {
  'use server'
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await ensureSchema()
  const userKey = await currentUserKey()
  await db()`UPDATE todos SET done = NOT done WHERE id = ${id}::bigint AND user_key = ${userKey}`
  revalidatePath('/')
}

export default async function Home() {
  const visitor = await me()
  const configured = isAxhubConfigured()
  const dbReady = isDbConfigured()
  const userKey = await currentUserKey()
  const todos = dbReady ? await listTodos(userKey).catch(() => [] as Todo[]) : []

  return (
    <AppShell>
      {/* 페이지 내용은 .ax-stack 으로 세로로 쌓아요. 바깥 여백은 셸이 이미 잡아 놨어요. */}
      <div className="ax-stack">
        <div className="ax-page-header">
          <div>
            <h1 className="ax-page-title">시작하기</h1>
            <p className="ax-page-desc">
              백엔드 · 인증 · 데이터베이스 · 배포가 이미 연결된 스타터예요. 화면만 만들면 돼요.
            </p>
          </div>
          <a className="ax-btn ax-btn-ghost" href="https://docs.axhub.ai/ko/docs" target="_blank" rel="noreferrer">
            가이드 보기
          </a>
        </div>

        {/* 방문자 신원 데모 — 실제 앱에선 지우고 원하는 내용을 넣으세요. */}
        <section className="ax-card">
          <h2 className="ax-card-title">지금 이 앱을 보고 있는 사람</h2>
          <p className="ax-card-desc">
            axhub 문이 요청마다 실어 주는 <code className="ax-tag">X-AxHub-*</code> 헤더를 읽은 결과예요. 허브에 다시 묻지 않아요.
          </p>

          <div className="mt-5">
            {!configured ? (
              <p className="ax-muted ax-small">
                로컬 실행 중이라 아직 아무도 없어요. axhub 로 배포하면 로그인한 사용자가 여기 표시돼요.
              </p>
            ) : (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Row label="상태">
                  <span className="inline-flex items-center gap-2">
                    <span className={visitor.authenticated ? 'ax-dot ax-dot-ok' : 'ax-dot ax-dot-idle'} />
                    {visitor.authenticated ? '로그인함' : '로그인 안 함 (정상)'}
                  </span>
                </Row>
                <Row label="이름">{visitor.name || '—'}</Row>
                <Row label="이메일">{visitor.email || '—'}</Row>
                <Row label="워크스페이스">{visitor.tenant_slug || '—'}</Row>
                <Row label="이 앱에서의 역할">{visitor.app_role || '—'}</Row>
                <Row label="관리자">{visitor.is_admin ? '예' : '아니오'}</Row>
              </dl>
            )}
          </div>
        </section>

        {/* 데이터 데모 — 표준 Postgres(lib/db.ts) 로 저장하는 사용자별 할 일 */}
        <section className="ax-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="ax-card-title">내 할 일</h2>
              <p className="ax-card-desc">사용자별로 갈린 표준 PostgreSQL 데이터예요.</p>
            </div>
            <code className="ax-tag">lib/db.ts</code>
          </div>

          <div className="mt-5">
            {dbReady ? (
              <>
                <form action={addTodo} className="flex gap-2">
                  <input name="title" placeholder="할 일을 입력하고 Enter" className="ax-input" autoComplete="off" />
                  <button type="submit" className="ax-btn ax-btn-primary shrink-0">
                    추가
                  </button>
                </form>

                <ul className="mt-4 flex list-none flex-col gap-1.5 p-0">
                  {todos.length === 0 ? (
                    <li className="ax-empty">아직 없어요. 위에서 하나 추가해 보세요.</li>
                  ) : (
                    todos.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center gap-3 rounded-control border border-default px-3 py-2"
                      >
                        <form action={toggleTodo} className="flex">
                          <input type="hidden" name="id" value={t.id} />
                          <button type="submit" aria-label="완료 토글" className="ax-check" data-done={t.done}>
                            {t.done ? '✓' : ''}
                          </button>
                        </form>
                        <span className={t.done ? 'ax-small ax-done' : 'ax-small'}>{t.title}</span>
                      </li>
                    ))
                  )}
                </ul>
              </>
            ) : (
              <p className="ax-muted ax-small">
                로컬 DB 가 아직 없어요. <code className="ax-tag">npm run db:up</code> 으로 Postgres 를 띄우고{' '}
                <code className="ax-tag">.env.local</code> 에 DATABASE_URL 을 채워 주세요.
              </p>
            )}
          </div>
        </section>

        <section>
          <h2 className="ax-section-title">다음 단계</h2>
          <div className="ax-grid ax-grid-3">
            <StepCard n="1" title="화면 만들기" code="app/page.tsx" desc="이 페이지 내용을 바꾸면 돼요." />
            <StepCard n="2" title="데이터 저장" code="lib/db.ts" desc="평범한 SQL 을 쓰면 돼요." />
            <StepCard n="3" title="배포" code="/axhub:deploy" desc="Claude Code 에서 한 줄로 배포해요." />
          </div>
        </section>
      </div>
    </AppShell>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-default pb-2 last:border-0">
      <dt className="ax-caption ax-subtle shrink-0">{label}</dt>
      <dd className="ax-small m-0 text-right">{children}</dd>
    </div>
  )
}

function StepCard({ n, title, code, desc }: { n: string; title: string; code: string; desc: string }) {
  return (
    <div className="ax-card">
      <span className="ax-tag">{n}</span>
      <p className="mt-3 mb-0 font-semibold">{title}</p>
      <p className="ax-caption ax-subtle mt-1 mb-0 font-mono">{code}</p>
      <p className="ax-small ax-muted mt-2 mb-0">{desc}</p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 🤖 Claude Code / AI 에이전트 — 이 앱 만드는 법 (지우지 말 것)
 *
 * 【디자인】 색·크기는 항상 토큰으로. #hex 나 text-[15px], text-gray-500 금지.
 *   - 배경은 회색(surface), 내용은 흰 카드(.ax-card) 안에. 이게 axhub 의 기본 모양이다.
 *   - 페이지 = <div className="ax-stack"> 안에 .ax-page-header + 섹션들.
 *   - 바깥 여백·최대 폭은 셸(.ax-container)이 이미 잡았다. 페이지가 또 붙이지 않는다.
 *   - 쓸 수 있는 조각: .ax-card .ax-card-title .ax-section-title .ax-btn(.ax-btn-primary/.ax-btn-ghost)
 *     .ax-input .ax-tag .ax-dot .ax-check .ax-empty .ax-muted .ax-small .ax-caption
 *   - Tailwind 는 배치(flex/grid/gap/mt)에 쓰고, 색은 토큰 클래스(text-muted, bg-content,
 *     border-default, rounded-card)를 쓴다.
 *   - 전체 규칙은 app/tokens.css 주석 참고. 그 파일은 자동 생성이라 고치지 않는다.
 *
 * 【레이아웃】 새 화면을 추가할 때
 *   - components/AppShell.tsx 는 건드리지 않는다. 내용만 <AppShell> 안에 넣는다.
 *   - 사이드바 메뉴는 config/navigation.ts 배열에 한 줄 추가한다.
 *
 * 【백엔드】 전부 서버에서 (Server Component / Route Handler / Server Action).
 *
 * 1) 데이터 저장·조회 · 표준 PostgreSQL  (이 앱의 데이터는 전부 여기로)
 *    import { db, ensureSchema } from "@/lib/db";
 *    await ensureSchema();                       // 첫 read/write 전에 한 번
 *    // 값은 tagged-template 으로 — 자동 바인딩되어 SQL 인젝션 안전. 문자열 이어붙이기 금지.
 *    await db()`INSERT INTO todos (user_key, title) VALUES (${userKey}, ${title})`;
 *    // 새 테이블이 필요하면 lib/db.ts 의 ensureSchema() 에 CREATE TABLE IF NOT EXISTS 를 추가.
 *    // 로컬은 `npm run db:up` 으로 Postgres 를 띄우면 돼요.
 *
 * 2) 사용자별 데이터 · 지금 방문자가 누구인지
 *    import { me, loginUrl, logoutUrl } from "@/lib/axhub-server";
 *    const visitor = await me();
 *    // { authenticated, user_id, email, name, app_role, is_admin, tenant_slug, surface }
 *    // authenticated=false 는 오류가 아니라 "로그인 안 됨" 정상 상태 — 로그인 버튼을 보여준다.
 *    // 출처는 axhub 문이 요청마다 실어 주는 X-AxHub-* 헤더 (허브 API 를 다시 부르지 않는다 —
 *    // 퍼블릭·커스텀 도메인에선 허브 쿠키가 없어 sdk.identity.me 는 401 이다).
 *    // "/__axhub/auth/*" 는 플랫폼 예약 경로 — 앱 라우트로 쓰지 않는다.
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
