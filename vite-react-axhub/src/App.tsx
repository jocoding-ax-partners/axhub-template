import { useEffect, useState } from "react";
import { axhub, type AxhubMe } from "./lib/axhub";

function App() {
  // 방문자 신원 — axhub 문이 실어 준 X-AxHub-* 헤더를 nginx(/__axhub/me)가 되돌려 준 결과.
  // 로컬(미설정)이면 nginx 가 없으니 호출하지 않고 안내만.
  const [me, setMe] = useState<AxhubMe | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">(
    axhub.isConfigured ? "loading" : "error",
  );
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (!axhub.isConfigured) return;
    axhub
      .me()
      .then((m) => {
        setMe(m);
        setPhase("ready");
      })
      .catch((err: unknown) => {
        setErrorText(err instanceof Error ? err.message : String(err));
        setPhase("error");
      });
  }, []);

  // 회사 앱은 앱 세션이 따로 없어 logoutUrl 이 null — 그땐 콘솔 로그아웃을 안내해요.
  const logoutHref = axhub.isConfigured ? axhub.logoutUrl("/") : null;

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
          <div className="relative mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-[14px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-lg font-bold text-white shadow-lg">
            <span className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
            <span className="relative">ax</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
            vibe-coding starter
          </span>
          <h1 className="mt-4 text-[2.75rem] font-extrabold leading-tight tracking-[-0.03em]">
            axhub <span className="text-[var(--primary)]">×</span> Vite
          </h1>
          <p className="mt-2.5 max-w-sm text-[15px] leading-relaxed text-[var(--fg-muted)]">
            백엔드 · 인증 · 배포가 이미 연결된 스타터예요. 화면만 만들면 돼요.
          </p>
        </header>

        {/* 환영 카드 — axhub.me() 결과 (문이 넘긴 X-AxHub-* 헤더) */}
        <section className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-content)] p-7 text-center shadow-sm">
          {phase === "loading" && (
            <>
              <span className="mx-auto mb-3 block h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--primary)]" />
              <p className="text-sm text-[var(--fg-muted)]">로그인 정보를 확인하는 중…</p>
            </>
          )}
          {phase === "ready" && me?.authenticated && (
            <>
              <span className="relative mx-auto mb-3 flex h-2.5 w-2.5 items-center justify-center">
                <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-[var(--success)] opacity-60" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
              </span>
              <p className="text-xl font-bold tracking-[-0.01em]">환영합니다, {me.name || me.email}님 👋</p>
              <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
                {me.email}
                {me.tenant_slug && ` · ${me.tenant_slug} (${me.app_role})`}
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
          )}
          {phase === "ready" && me && !me.authenticated && (
            <>
              {/* 익명은 오류가 아니라 정상 상태 — "들어올 때 로그인 요구" 가 꺼진 앱에선 누구나 여기까지 와요. */}
              <span className="mx-auto mb-3 block h-2.5 w-2.5 rounded-full bg-[var(--fg-subtle)]" />
              <p className="text-[15px] font-semibold text-[var(--fg-default)]">로그인하지 않았어요</p>
              <p className="mt-1.5 text-sm text-[var(--fg-muted)]">axhub 계정으로 로그인하면 여기 이름이 표시돼요.</p>
              <a
                href={axhub.loginUrl()}
                className="mt-4 inline-block rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]"
              >
                axhub 로 로그인
              </a>
            </>
          )}
          {phase === "error" && (
            <>
              <span className="mx-auto mb-3 block h-2.5 w-2.5 rounded-full bg-[var(--warning)]" />
              <p className="text-[15px] font-semibold text-[var(--fg-default)]">
                {axhub.isConfigured ? "로그인 정보를 확인하지 못했어요" : "로컬 실행 중"}
              </p>
              <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
                {axhub.isConfigured ? errorText : "axhub 로 배포하면 로그인한 사용자가 여기 표시돼요."}
              </p>
            </>
          )}
        </section>

        {/* 다음 단계 */}
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          <Step n="1" title="화면 만들기" code="src/App.tsx" />
          <Step n="2" title="로그인 사용자" code="axhub.me()" />
          <Step n="3" title="배포" code="/axhub:deploy" />
        </div>

        <footer className="flex flex-col items-center gap-1 pt-1 text-center">
          <p className="text-xs text-[var(--fg-subtle)]">Vite · React · Tailwind · TypeScript</p>
          <p className="text-[11px] text-[var(--fg-subtle)]">
            이 앱 슬러그:{" "}
            <code className="rounded bg-[var(--primary-soft)] px-1 text-[var(--primary)]">
              {axhub.slug || "(로컬 실행)"}
            </code>
          </p>
        </footer>
      </div>
    </main>
  );
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
  );
}

export default App;

/* ─────────────────────────────────────────────────────────────────────────────
 * 🤖 Claude Code / AI 에이전트 — 백엔드 호출 치트시트 (지우지 말 것)
 *
 * 화면을 깔끔히 하려고 아래 패턴들을 주석으로 내렸을 뿐, 이 앱에서 axhub 를 쓸 때
 * 그대로 쓰는 정식 패턴이다. 정적 SPA — 브라우저에서 호출한다. API 키를 코드에 넣지 않는다.
 * 설정(API_BASE·slug)은 배포 시 src/lib/axhub.ts 에 자동 주입된다.
 *
 * 1) 지금 방문자가 누구인지  (위 환영 카드가 이 결과)
 *    const me = await axhub.me();
 *    // { authenticated, user_id, email, name, app_role, is_admin, tenant_slug, surface }
 *    // authenticated=false 는 오류가 아니라 "로그인 안 됨" 정상 상태 — 로그인 버튼을 보여준다.
 *    // 출처는 axhub 문이 요청마다 실어 주는 X-AxHub-* 헤더 (nginx.conf 의 /__axhub/me 가 JSON 으로 되돌려 줌).
 *    // 허브 /api/v1/me 를 다시 부르지 않는다 — 퍼블릭(axhub.app)·커스텀 도메인에선 허브 쿠키가 없어 안 된다.
 *
 * 2) 로그인 / 로그아웃 버튼
 *    <a href={axhub.loginUrl()}>로그인</a>           // 시작점에 현재 주소 전체를 넘긴다 — 로그인 뒤 그 자리로 복귀
 *    const out = axhub.logoutUrl("/");                // 이 앱 주소의 세션만 끊는다 (콘솔 로그인 유지)
 *    // out 이 null 이면 회사 앱 — 끊을 앱 세션이 없으니 버튼을 숨기고 콘솔 로그아웃을 안내한다.
 *    // "/__axhub/auth/*" 는 플랫폼 예약 경로 — 앱 라우트로 쓰지 않는다. "/__axhub/me" 는 이 앱의 nginx 가 소유한다.
 *
 * 3) 허브 API 직접 호출 (회사 앱 주소에서만 — 퍼블릭·커스텀 도메인은 401)
 *    const res = await axhub.fetch("/api/v1/apps");
 *
 * 4) 데이터 저장/조회가 필요하면?
 *    이 템플릿은 정적 SPA 라 자체 데이터베이스가 없어요. 데이터 저장/조회가 필요하면
 *    서버 템플릿(nextjs-axhub / astro-axhub)을 쓰세요 — 거기선 표준 Postgres 를 써요.
 * ───────────────────────────────────────────────────────────────────────────── */
