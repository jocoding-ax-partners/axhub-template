import { AppShell } from '@/components/AppShell'
import { APP_NAME, isAxhubConfigured, me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'

export default async function Home() {
  // 방문자 신원 — axhub 문이 요청마다 실어 주는 헤더를 읽어요 (허브 호출 없음).
  const visitor = await me()
  const configured = isAxhubConfigured()
  const dbReady = isDbConfigured()

  const title = visitor.authenticated ? `환영합니다, ${visitor.name || visitor.email}님 👋` : '환영합니다 👋'
  const desc = !configured
    ? '로컬에서 실행 중이에요. axhub 로 배포하면 로그인한 사용자가 여기 표시돼요.'
    : visitor.authenticated
      ? `${APP_NAME} 이 준비됐어요. 이제 화면만 만들면 돼요.`
      : '오른쪽 위에서 로그인하면 이름이 여기 표시돼요.'

  return (
    <AppShell>
      {/* 페이지 내용은 .ax-stack 으로 세로로 쌓아요. 바깥 여백은 셸이 이미 잡아 놨어요. */}
      <div className="ax-stack">
        <div className="ax-page-header">
          <div>
            <h1 className="ax-page-title">{title}</h1>
            <p className="ax-page-desc">{desc}</p>
          </div>
          <a className="ax-btn ax-btn-ghost" href="https://docs.axhub.ai/ko/docs" target="_blank" rel="noreferrer">
            가이드 보기
          </a>
        </div>

        {/* 신원 데모 — 실제 앱에선 지우고 원하는 내용을 넣으세요. */}
        <section className="ax-card">
          <h2 className="ax-card-title">내 정보</h2>
          <p className="ax-card-desc">
            axhub 문이 요청마다 실어 주는 <code className="ax-tag">X-AxHub-*</code> 헤더를 읽은 결과예요. 허브에 다시 묻지 않아요.
          </p>

          <div className="mt-5">
            {!configured ? (
              <p className="ax-muted ax-small">
                로컬에는 문(게이트)이 없어서 값이 비어 있어요. 배포하면 채워져요.
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

        <section>
          <h2 className="ax-section-title">시작 안내</h2>

          {/* 데이터베이스는 기본으로 붙지 않아요 — 필요할 때 켜는 방식이에요. */}
          <div className="ax-card">
            <h3 className="ax-card-title">데이터베이스 연결하기</h3>
            {dbReady ? (
              <>
                <p className="ax-card-desc">
                  연결돼 있어요. <code className="ax-tag">lib/db.ts</code> 로 바로 쿼리하면 돼요.
                </p>
                <code className="ax-code">{`import { db, ensureSchema } from "@/lib/db";

await ensureSchema();
await db()\`INSERT INTO todos (user_key, title) VALUES (\${userKey}, \${title})\`;`}</code>
              </>
            ) : (
              <>
                <p className="ax-card-desc">
                  이 앱은 아직 데이터베이스가 없어요. 필요하면 <code className="ax-tag">axhub.yaml</code> 에서 아래 두 줄의 주석을 풀고 다시 배포하세요. 전용 PostgreSQL 이 발급되고 접속 정보가 자동으로 들어와요.
                </p>
                <code className="ax-code">{`database:
  engine: postgres`}</code>
                <p className="ax-small ax-muted mt-4 mb-0">
                  로컬에서 먼저 해 보려면 <code className="ax-tag">npm run db:up</code> 으로 Postgres 를 띄우고{' '}
                  <code className="ax-tag">.env.local</code> 에 DATABASE_URL 을 채우세요. 쓰는 법은{' '}
                  <code className="ax-tag">lib/db.ts</code> 에 적혀 있어요.
                </p>
              </>
            )}
          </div>

          <div className="ax-grid mt-4 sm:grid-cols-2">
            <GuideCard
              title="화면 만들기"
              code="app/page.tsx"
              desc="이 페이지를 고치거나 새 화면을 추가하세요. 사이드바 메뉴는 config/navigation.ts 에 한 줄 더하면 돼요."
            />
            <GuideCard
              title="배포하기"
              code="/axhub:deploy"
              desc="Claude Code 에서 한 줄로 배포해요. 배포 전에 디자인 규칙 검사가 자동으로 돌아요."
            />
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

function GuideCard({ title, code, desc }: { title: string; code: string; desc: string }) {
  return (
    <div className="ax-card">
      <h3 className="ax-card-title">{title}</h3>
      <p className="ax-caption ax-subtle mt-1 mb-0 font-mono">{code}</p>
      <p className="ax-small ax-muted mt-3 mb-0">{desc}</p>
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
 *   - 쓸 수 있는 조각: .ax-card .ax-card-title .ax-card-desc .ax-section-title
 *     .ax-btn(.ax-btn-primary/.ax-btn-ghost/.ax-btn-sm) .ax-input .ax-tag .ax-dot .ax-check
 *     .ax-code .ax-empty .ax-grid(.ax-grid-3) .ax-muted .ax-subtle .ax-small .ax-caption .ax-done
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
