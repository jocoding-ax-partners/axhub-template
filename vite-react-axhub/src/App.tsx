import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { axhub, type AxhubMe } from "./lib/axhub";

function App() {
  // 방문자 신원 — axhub 문이 실어 준 헤더를 nginx 가 돌려준 결과예요 (허브 호출 없음).
  const [me, setMe] = useState<AxhubMe | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!axhub.isConfigured) return;
    axhub
      .me()
      .then(setMe)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const title = me?.authenticated ? `환영합니다, ${me.name || me.email}님 👋` : "환영합니다 👋";
  const desc = !axhub.isConfigured
    ? "로컬에서 실행 중이에요. axhub 로 배포하면 로그인한 사용자가 여기 표시돼요."
    : me?.authenticated
      ? `${axhub.name} 이 준비됐어요. 이제 화면만 만들면 돼요.`
      : "오른쪽 위에서 로그인하면 이름이 여기 표시돼요.";

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
            {!axhub.isConfigured && (
              <p className="ax-muted ax-small">로컬에는 문(게이트)이 없어서 값이 비어 있어요. 배포하면 채워져요.</p>
            )}
            {error && <p className="ax-small text-danger">{error}</p>}
            {axhub.isConfigured && !error && !me && <p className="ax-muted ax-small">확인하는 중…</p>}
            {me && (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Row label="상태">
                  <span className="inline-flex items-center gap-2">
                    <span className={me.authenticated ? "ax-dot ax-dot-ok" : "ax-dot ax-dot-idle"} />
                    {me.authenticated ? "로그인함" : "로그인 안 함 (정상)"}
                  </span>
                </Row>
                <Row label="이름">{me.name || "—"}</Row>
                <Row label="이메일">{me.email || "—"}</Row>
                <Row label="워크스페이스">{me.tenant_slug || "—"}</Row>
                <Row label="이 앱에서의 역할">{me.app_role || "—"}</Row>
                <Row label="관리자">{me.is_admin ? "예" : "아니오"}</Row>
              </dl>
            )}
          </div>
        </section>

        <section>
          <h2 className="ax-section-title">시작 안내</h2>

          {/* 정적 SPA 라 자체 저장소가 없어요. 데이터가 필요하면 서버 템플릿으로. */}
          <div className="ax-card">
            <h3 className="ax-card-title">데이터를 저장하려면</h3>
            <p className="ax-card-desc">
              이 템플릿은 브라우저에서만 도는 정적 앱이라 자체 데이터베이스가 없어요. 저장이 필요하면 서버 템플릿으로 시작하세요. 거기선 axhub 가 전용 PostgreSQL 을 발급해 줘요.
            </p>
            <code className="ax-code">{`# Claude Code 에서
/axhub:bootstrap   # nextjs 또는 astro 템플릿 선택`}</code>
            <p className="ax-small ax-muted mt-4 mb-0">
              가벼운 값은 브라우저 저장소에 둘 수 있지만, 사용자끼리 공유되지 않고 기기를 바꾸면 사라져요.
            </p>
          </div>

          <div className="ax-grid mt-4 sm:grid-cols-2">
            <GuideCard
              title="화면 만들기"
              code="src/App.tsx"
              desc="이 페이지를 고치거나 새 화면을 추가하세요. 사이드바 메뉴는 src/config/navigation.ts 에 한 줄 더하면 돼요."
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
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-default pb-2 last:border-0">
      <dt className="ax-caption ax-subtle shrink-0">{label}</dt>
      <dd className="ax-small m-0 text-right">{children}</dd>
    </div>
  );
}

function GuideCard({ title, code, desc }: { title: string; code: string; desc: string }) {
  return (
    <div className="ax-card">
      <h3 className="ax-card-title">{title}</h3>
      <p className="ax-caption ax-subtle mt-1 mb-0 font-mono">{code}</p>
      <p className="ax-small ax-muted mt-3 mb-0">{desc}</p>
    </div>
  );
}

export default App;

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
 *   - 전체 규칙은 src/styles/tokens.css 주석 참고. 그 파일은 자동 생성이라 고치지 않는다.
 *
 * 【레이아웃】 새 화면을 추가할 때
 *   - src/components/AppShell.tsx 는 건드리지 않는다. 내용만 <AppShell> 안에 넣는다.
 *   - 사이드바 메뉴는 src/config/navigation.ts 배열에 한 줄 추가한다.
 *
 * 【백엔드】 정적 SPA — 브라우저에서 호출한다. API 키를 코드에 넣지 않는다.
 *
 * 1) 지금 방문자가 누구인지
 *    const me = await axhub.me();
 *    // { authenticated, user_id, email, name, app_role, is_admin, tenant_slug, surface }
 *    // authenticated=false 는 오류가 아니라 "로그인 안 됨" 정상 상태 — 로그인 버튼을 보여준다.
 *    // 출처는 axhub 문이 요청마다 실어 주는 X-AxHub-* 헤더 (nginx.conf 의 /__axhub/me).
 *    // 허브 /api/v1/me 를 다시 부르지 않는다 — 퍼블릭·커스텀 도메인에선 허브 쿠키가 없어 안 된다.
 *
 * 2) 로그인 / 로그아웃
 *    <a href={axhub.loginUrl()}>로그인</a>          // 시작점에 현재 주소를 넘긴다
 *    const out = axhub.logoutUrl("/");               // 이 앱 주소의 세션만 끊는다
 *    // out 이 null 이면 회사 앱 — 버튼을 숨기고 콘솔 로그아웃을 안내한다.
 *    // "/__axhub/auth/*" 는 플랫폼 예약 경로 — 앱 라우트로 쓰지 않는다.
 *
 * 3) 허브 API 직접 호출 (회사 앱 주소에서만 — 퍼블릭·커스텀 도메인은 401)
 *    const res = await axhub.fetch("/api/v1/apps");
 *
 * 4) 데이터 저장/조회가 필요하면?
 *    이 템플릿은 정적 SPA 라 자체 데이터베이스가 없어요. 서버 템플릿(nextjs/astro)을 쓰세요.
 * ───────────────────────────────────────────────────────────────────────────── */
