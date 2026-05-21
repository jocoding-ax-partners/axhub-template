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
    <main className="min-h-screen w-full flex flex-col items-center justify-center gap-6 p-8 font-sans bg-white text-gray-900">
      <h1 className="text-4xl font-bold">axhub × Vite + React</h1>

      {/* 환영 — GET /api/v1/me 결과 */}
      <section className="rounded-2xl border border-gray-200 p-6 w-full max-w-xl text-center">
        {phase === "loading" && <p className="text-gray-500">로그인 정보를 불러오는 중…</p>}
        {phase === "ready" && me && (
          <>
            <p className="text-2xl font-semibold">환영합니다, {me.user.name}님 👋</p>
            <p className="mt-1 text-sm text-gray-500">
              {me.user.email}
              {tenant && ` · ${tenant.tenant_slug} (${tenant.role})`}
            </p>
          </>
        )}
        {phase === "error" && (
          <p className="text-amber-600">
            {axhub.isConfigured
              ? "로그인 정보를 불러오지 못했어요. axhub 로그인 상태를 확인해 주세요."
              : "로컬 실행 중 — axhub 로 배포하면 로그인한 사용자가 여기 표시돼요."}
          </p>
        )}
      </section>

      {/* 백엔드 호출 치트시트 */}
      <section className="rounded-2xl border border-gray-200 p-6 w-full max-w-xl space-y-4">
        <h2 className="text-sm font-semibold">백엔드, 이렇게 호출해요</h2>

        <div className="space-y-1">
          <p className="text-xs text-gray-500">내 정보 · Hub API — 위 환영 메시지가 이 호출 결과예요</p>
          <pre className="text-sm bg-gray-100 rounded-lg p-3 overflow-x-auto"><code>{`const res = await axhub.fetch("/api/v1/me");
const me = await res.json(); // { user, tenants }`}</code></pre>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-500">앱 데이터 — 동적 테이블 CRUD</p>
          <pre className="text-sm bg-gray-100 rounded-lg p-3 overflow-x-auto"><code>{`// GET  {API_BASE}/data/{tenant}/{app}/todos
const list = await (await axhub.data("todos")).json();
// POST 새 행 추가
await axhub.data("todos", { method: "POST", body: JSON.stringify({ title: "할 일" }) });`}</code></pre>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          인증은 <code className="bg-gray-100 px-1 rounded">credentials:"include"</code> 로 axhub 세션
          쿠키(<code className="bg-gray-100 px-1 rounded">_hub_access</code>)가 자동 전송되고, 401 이면 헬퍼가
          silent SSO 로 재인증해요. <strong>API 키를 코드에 넣지 않아요.</strong> 설정은{" "}
          <code className="bg-gray-100 px-1 rounded">src/lib/axhub.ts</code> 가 배포 시 자동 주입.
        </p>
        <p className="text-[11px] text-gray-400">이 앱 슬러그: <code className="bg-gray-100 px-1 rounded">{axhub.slug || "(로컬 실행)"}</code></p>
      </section>

      <ol className="list-decimal list-inside text-sm text-gray-700 max-w-xl space-y-1">
        <li><code className="bg-gray-100 px-1 rounded">src/App.tsx</code> 를 열어 화면을 바꿔봐요 (저장 시 HMR 즉시 반영).</li>
        <li>백엔드 호출은 위 <code className="bg-gray-100 px-1 rounded">axhub.fetch</code> / <code className="bg-gray-100 px-1 rounded">axhub.data</code> 패턴 그대로.</li>
        <li>다 만들었으면 Claude Code 에서 <code className="bg-gray-100 px-1 rounded">/axhub:deploy</code> → 배포 끝.</li>
      </ol>

      <footer className="text-xs text-gray-400 mt-4">Vite · React · Tailwind · TypeScript</footer>
    </main>
  );
}

export default App;
