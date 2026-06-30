import { useEffect, useState } from "react";
import { axhub } from "./lib/axhub";

// GET /api/v1/me 응답 (axhub 백엔드). 로그인한 사용자 + 활성 테넌트 멤버십.
type Me = {
  user: { id: string; email: string; name: string; platform_admin: boolean };
  tenants: { tenant_id: string; tenant_slug: string; role: string; is_active: boolean }[];
};

function App() {
  const [me, setMe] = useState<Me | null>(null);
  // 로컬(미설정)이면 호출을 건너뛰고 안내만 — 괜한 silent SSO redirect 방지.
  const [phase, setPhase] = useState<"loading" | "ready" | "error">(
    axhub.isConfigured ? "loading" : "error",
  );

  useEffect(() => {
    if (!axhub.isConfigured) return;
    // 이 호출이 곧 "백엔드 호출 예시" 그 자체예요.
    // 브라우저가 axhub 세션 쿠키(_hub_access)를 자동 전송해요 (credentials:"include").
    axhub
      .fetch("/api/v1/me")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setMe((await res.json()) as Me);
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  }, []);

  const tenant = me?.tenants?.[0];

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

        {/* 환영 카드 — GET /api/v1/me 결과 */}
        <section className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-content)] p-7 text-center shadow-sm">
          {phase === "loading" && (
            <>
              <span className="mx-auto mb-3 block h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--primary)]" />
              <p className="text-sm text-[var(--fg-muted)]">로그인 정보를 불러오는 중…</p>
            </>
          )}
          {phase === "ready" && me && (
            <>
              <span className="relative mx-auto mb-3 flex h-2.5 w-2.5 items-center justify-center">
                <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-[var(--success)] opacity-60" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
              </span>
              <p className="text-xl font-bold tracking-[-0.01em]">환영합니다, {me.user.name}님 👋</p>
              <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
                {me.user.email}
                {tenant && ` · ${tenant.tenant_slug} (${tenant.role})`}
              </p>
            </>
          )}
          {phase === "error" && (
            <>
              <span className="mx-auto mb-3 block h-2.5 w-2.5 rounded-full bg-[var(--warning)]" />
              <p className="text-[15px] font-semibold text-[var(--fg-default)]">
                {axhub.isConfigured
                  ? "로그인 정보를 불러오지 못했어요. axhub 로그인 상태를 확인해 주세요."
                  : "로컬 실행 중"}
              </p>
              {!axhub.isConfigured && (
                <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
                  axhub 로 배포하면 로그인한 사용자가 여기 표시돼요.
                </p>
              )}
            </>
          )}
        </section>

        {/* 다음 단계 */}
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          <Step n="1" title="화면 만들기" code="src/App.tsx" />
          <Step n="2" title="백엔드 호출" code="axhub.fetch()" />
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
 * 화면을 깔끔히 하려고 아래 패턴들을 주석으로 내렸을 뿐, 이 앱에서 axhub 백엔드를
 * 쓸 때 그대로 쓰는 정식 패턴이다. 정적 SPA — 브라우저에서 호출한다.
 * 인증은 credentials:"include" 로 axhub 세션 쿠키(_hub_access)가 자동 전송되고,
 * 401 이면 헬퍼가 silent SSO 로 재인증한다. API 키를 코드에 넣지 않는다.
 * 설정(API_BASE·slug)은 배포 시 src/lib/axhub.ts 에 자동 주입된다.
 *
 * 1) 내 정보 · Hub API  (위 환영 메시지가 이 호출 결과)
 *    const res = await axhub.fetch("/api/v1/me");
 *    const me = await res.json(); // { user, tenants }
 *
 * 2) 데이터 저장/조회가 필요하면?
 *    이 템플릿은 정적 SPA 라 자체 데이터베이스가 없어요. 데이터 저장/조회가 필요하면
 *    서버 템플릿(nextjs-axhub / astro-axhub)을 쓰세요 — 거기선 표준 Postgres 를 써요.
 * ───────────────────────────────────────────────────────────────────────────── */
