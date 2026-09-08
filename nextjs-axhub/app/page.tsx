import { revalidatePath } from 'next/cache'
import {
  APP_SLUG,
  isAxhubConfigured,
  loginUrl,
  logoutUrl,
  me,
  type AxhubMe,
} from '@/lib/axhub-server'
import { db, ensureSchema, isDbConfigured } from '@/lib/db'

// 방문자 신원 — axhub 문이 요청마다 실어 주는 X-AxHub-* 헤더를 me() 가 읽어요 (허브 호출 없음).
// 로컬(미설정)이면 문이 없으니 항상 익명이에요.
async function loadMe(): Promise<AxhubMe> {
  return await me()
}

// 데이터를 가를 사용자 키. 로그인 사용자는 email, 로그인 안 한 방문자는 'anonymous', 로컬 단독 실행 땐 'local-dev'.
// 자기 데이터만 보이게 하려면 모든 쿼리를 이 값으로 필터하면 돼요 (아래 todo 예시 참고).
async function currentUserKey(): Promise<string> {
  if (!isAxhubConfigured()) return 'local-dev'
  const m = await loadMe()
  return m.authenticated ? m.email : 'anonymous'
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
  const visitor = await loadMe()
  const configured = isAxhubConfigured()
  const dbReady = isDbConfigured()
  const userKey = await currentUserKey()
  const todos = dbReady ? await listTodos(userKey).catch(() => [] as Todo[]) : []
  // 회사 앱은 앱 세션이 따로 없어 logoutUrl 이 null — 그땐 콘솔 로그아웃을 안내해요.
  const loginHref = configured ? await loginUrl('/') : ''
  const logoutHref = configured ? await logoutUrl('/') : null

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[var(--bg-surface)] text-[var(--fg-default)]">
      {/* 은은한 블루 글로우 (axhub primary-soft) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 -z-10 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[var(--primary-soft)] opacity-70 blur-3xl"
      />

      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-7 px-6 py-20">
        {/* 히어로 */}
        <header className="flex flex-col items-center text-center">
          {/* 앱 아이콘 타일 (콘솔의 .app-ico 무드) */}
          <div className="relative mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-[14px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-lg font-bold text-white shadow-lg">
            <span className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
            <span className="relative">ax</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
            vibe-coding starter
          </span>
          <h1 className="mt-4 text-[2.75rem] font-extrabold leading-tight tracking-[-0.03em]">
            axhub <span className="text-[var(--primary)]">×</span> Next.js
          </h1>
          <p className="mt-2.5 max-w-sm text-[15px] leading-relaxed text-[var(--fg-muted)]">
            백엔드 · 인증 · 데이터베이스 · 배포가 이미 연결된 스타터예요. 화면만 만들면 돼요.
          </p>
        </header>

        {/* 환영 카드 — me() 결과 (문이 넘긴 X-AxHub-* 헤더, 서버에서 읽음) */}
        <section className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-content)] p-7 text-center shadow-sm">
          {visitor.authenticated ? (
            <>
              <span className="relative mx-auto mb-3 flex h-2.5 w-2.5 items-center justify-center">
                <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-[var(--success)] opacity-60" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
              </span>
              <p className="text-xl font-bold tracking-[-0.01em]">환영합니다, {visitor.name || visitor.email}님 👋</p>
              <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
                {visitor.email}
                {visitor.tenant_slug ? ` · ${visitor.tenant_slug} (${visitor.app_role})` : ''}
              </p>
              {logoutHref ? (
                <a
                  href={logoutHref}
                  className="mt-4 inline-block rounded-lg border border-[var(--border-default)] px-3.5 py-1.5 text-sm font-semibold transition hover:border-[var(--primary)]"
                >
                  로그아웃
                </a>
              ) : (
                <p className="mt-3 text-xs text-[var(--fg-subtle)]">회사 앱은 axhub 콘솔에서 로그아웃하면 돼요.</p>
              )}
            </>
          ) : configured ? (
            <>
              {/* 익명은 오류가 아니라 정상 상태 — "들어올 때 로그인 요구" 가 꺼진 앱에선 누구나 여기까지 와요. */}
              <span className="mx-auto mb-3 block h-2.5 w-2.5 rounded-full bg-[var(--fg-subtle)]" />
              <p className="text-[15px] font-semibold text-[var(--fg-default)]">로그인하지 않았어요</p>
              <p className="mt-1.5 text-sm text-[var(--fg-muted)]">axhub 계정으로 로그인하면 여기 이름이 표시돼요.</p>
              <a
                href={loginHref}
                className="mt-4 inline-block rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]"
              >
                axhub 로 로그인
              </a>
            </>
          ) : (
            <>
              <span className="mx-auto mb-3 block h-2.5 w-2.5 rounded-full bg-[var(--warning)]" />
              <p className="text-[15px] font-semibold text-[var(--fg-default)]">로컬 실행 중</p>
              <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
                axhub 로 배포하면 로그인한 사용자가 여기 표시돼요.
              </p>
            </>
          )}
        </section>

        {/* 데이터 데모 — 표준 Postgres(lib/db.ts) 로 저장하는 사용자별 할 일 */}
        <section className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-content)] p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">내 할 일</p>
            <code className="rounded bg-[var(--primary-soft)] px-1.5 py-0.5 text-[11px] text-[var(--primary)]">PostgreSQL · lib/db.ts</code>
          </div>

          {dbReady ? (
            <>
              <form action={addTodo} className="flex gap-2">
                <input
                  name="title"
                  placeholder="할 일을 입력하고 Enter"
                  className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[var(--primary)] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]"
                >
                  추가
                </button>
              </form>

              <ul className="mt-3 flex flex-col gap-1.5">
                {todos.length === 0 ? (
                  <li className="py-2 text-center text-sm text-[var(--fg-subtle)]">아직 없어요 — 위에서 하나 추가해 보세요.</li>
                ) : (
                  todos.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 py-2"
                    >
                      <form action={toggleTodo}>
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          aria-label="완료 토글"
                          className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] text-white ${
                            t.done
                              ? 'border-[var(--success)] bg-[var(--success)]'
                              : 'border-[var(--border-default)] bg-transparent'
                          }`}
                        >
                          {t.done ? '✓' : ''}
                        </button>
                      </form>
                      <span className={`text-sm ${t.done ? 'text-[var(--fg-subtle)] line-through' : ''}`}>{t.title}</span>
                    </li>
                  ))
                )}
              </ul>
            </>
          ) : (
            <p className="text-sm text-[var(--fg-muted)]">
              로컬 DB 가 아직 없어요. <code className="rounded bg-[var(--primary-soft)] px-1 text-[var(--primary)]">docker compose up -d</code> 로 Postgres 를 띄우고{' '}
              <code className="rounded bg-[var(--primary-soft)] px-1 text-[var(--primary)]">.env.local</code> 에 DATABASE_URL 을 채워 주세요.
            </p>
          )}
        </section>

        {/* 다음 단계 */}
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          <Step n="1" title="화면 만들기" code="app/page.tsx" />
          <Step n="2" title="데이터 저장" code="lib/db.ts (Postgres)" />
          <Step n="3" title="배포" code="/axhub:deploy" />
        </div>

        <footer className="flex flex-col items-center gap-1 pt-1 text-center">
          <p className="text-xs text-[var(--fg-subtle)]">
            Next.js · React · Tailwind · TypeScript · PostgreSQL · @ax-hub/sdk
          </p>
          <p className="text-[11px] text-[var(--fg-subtle)]">
            이 앱 슬러그:{' '}
            <code className="rounded bg-[var(--primary-soft)] px-1 text-[var(--primary)]">
              {configured ? APP_SLUG : '(로컬 실행)'}
            </code>
          </p>
        </footer>
      </div>
    </main>
  )
}

function Step({ n, title, code }: { n: string; title: string; code: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-content)] p-4 transition hover:border-[var(--primary)] hover:shadow-sm">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]">
        {n}
      </div>
      <p className="mt-2.5 text-sm font-semibold">{title}</p>
      <code className="mt-1 block truncate text-[11px] text-[var(--fg-subtle)]">{code}</code>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 🤖 Claude Code / AI 에이전트 — 백엔드 호출 치트시트 (지우지 말 것)
 *
 * 화면을 깔끔히 하려고 아래 패턴들을 주석으로 내렸을 뿐, 이 앱에서 쓰는 정식 패턴이다.
 * 전부 서버에서 (Server Component / Route Handler / Server Action).
 *
 * 1) 데이터 저장·조회 · 표준 PostgreSQL  (이 앱의 데이터는 전부 여기로)
 *    import { db, ensureSchema } from "@/lib/db";
 *    await ensureSchema();                       // 첫 read/write 전에 한 번 (테이블 정의는 lib/db.ts 에)
 *    // 값은 tagged-template 으로 — 자동 바인딩되어 SQL 인젝션 안전. 문자열 이어붙이기 금지.
 *    await db()`INSERT INTO todos (user_key, title) VALUES (${userKey}, ${title})`;
 *    const rows = await db()<{ id: string; title: string }[]>`
 *      SELECT id::text, title FROM todos WHERE user_key = ${userKey} ORDER BY id DESC LIMIT 50`;
 *    // 새 테이블이 필요하면 lib/db.ts 의 ensureSchema() 에 CREATE TABLE IF NOT EXISTS 를 추가.
 *    // 로컬은 `docker compose up -d` 로 Postgres 를 띄우면 돼요.
 *
 * 2) 사용자별 데이터 · 지금 방문자가 누구인지  (자기 데이터만 보이게)
 *    import { me, loginUrl, logoutUrl } from "@/lib/axhub-server";
 *    const visitor = await me();
 *    // { authenticated, user_id, email, name, app_role, is_admin, tenant_slug, surface }
 *    // authenticated=false 는 오류가 아니라 "로그인 안 됨" 정상 상태 — 로그인 버튼(await loginUrl('/'))을 보여준다.
 *    // 출처는 axhub 문이 요청마다 실어 주는 X-AxHub-* 헤더 (허브 API 를 다시 부르지 않는다 —
 *    // 퍼블릭(axhub.app)·커스텀 도메인에선 허브 쿠키가 없어 sdk.identity.me 는 401 이다).
 *    // visitor.email(또는 user_id)을 테이블의 user_key 컬럼으로 쓰고,
 *    // 모든 쿼리를 WHERE user_key = ${visitor.email} 로 필터하면 사용자별 격리가 돼요.
 *    // 로그아웃: await logoutUrl('/') — 이 앱 주소의 세션만 끊는다. null 이면 회사 앱(콘솔 로그아웃 안내).
 *    // "/__axhub/auth/*" 는 플랫폼 예약 경로 — 앱 라우트로 쓰지 않는다.
 *
 * 3) Gateway · 외부 DB/SaaS 조회  (connector 이름으로, parameterized SQL, audit log)
 *    ⚠️ 사용자 쿠키가 필요해 **회사 앱 주소에서만** 동작 — 퍼블릭·커스텀 도메인 앱은 미지원.
 *    import { queryConnector } from "@/lib/axhub-server";
 *    // connector 이름만 — UUID·tenant 스코프는 helper 가 자동 처리 (connectors.list() 로 resolve)
 *    const res = await queryConnector<{ id: number; name: string }>({
 *      connector: "my-db",           // connector 이름 (UUID 아님)
 *      path: "public/employees",     // connector 안 리소스 경로
 *      sql: "SELECT id, name FROM public.employees WHERE active = ? LIMIT ?",
 *      params: [true, 10],           // ✅ 항상 parameterized
 *    });
 *    // res.rows (컬럼 매핑된 객체) / res.rowCount / res.allowed (false 면 정책 deny)
 *
 * 4) 에러 처리
 *    - DB(lib/db.ts) 호출은 표준 postgres 에러를 던져요 — try/catch 로 감싸요.
 *    - SDK(gateway) 호출은 AxHubError — e.code / e.category / e.requestId 로 분기 (메시지 매칭 금지).
 *      import { AxHubError } from "@ax-hub/sdk";
 * ───────────────────────────────────────────────────────────────────────────── */
