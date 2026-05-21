import { axhub } from "@/lib/axhub";

// GET /api/v1/me 응답 (axhub 백엔드). 로그인한 사용자 + 활성 테넌트 멤버십.
type Me = {
  user: { id: string; email: string; name: string; platform_admin: boolean };
  tenants: { tenant_id: string; tenant_slug: string; role: string; is_active: boolean }[];
};

// 서버 컴포넌트에서 직접 호출 — lib/axhub 가 들어온 _hub_access 쿠키를 Bearer 로 포워딩해요.
// per-user 응답이라 cache: "no-store" 로 매 요청 평가.
async function loadMe(): Promise<Me | null> {
  if (!axhub.isConfigured) return null;
  try {
    const res = await axhub.fetch("/api/v1/me", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Me;
  } catch {
    return null;
  }
}

export default async function Home() {
  const me = await loadMe();
  const tenant = me?.tenants?.[0];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 font-sans">
      <h1 className="text-4xl font-bold">axhub × Next.js</h1>

      {/* 환영 — GET /api/v1/me 결과 (서버에서 호출) */}
      <section className="rounded-2xl border border-gray-200 p-6 w-full max-w-xl text-center">
        {me ? (
          <>
            <p className="text-2xl font-semibold">환영합니다, {me.user.name}님 👋</p>
            <p className="mt-1 text-sm text-gray-500">
              {me.user.email}
              {tenant ? ` · ${tenant.tenant_slug} (${tenant.role})` : ""}
            </p>
          </>
        ) : (
          <p className="text-amber-600">
            {axhub.isConfigured
              ? "로그인 정보를 불러오지 못했어요. axhub 로그인 상태를 확인해 주세요."
              : "로컬 실행 중 — axhub 로 배포하면 로그인한 사용자가 여기 표시돼요."}
          </p>
        )}
      </section>

      {/* 백엔드 호출 치트시트 */}
      <section className="rounded-2xl border border-gray-200 p-6 w-full max-w-xl space-y-4">
        <h2 className="text-sm font-semibold">백엔드, 이렇게 호출해요 (서버에서)</h2>

        <div className="space-y-1">
          <p className="text-xs text-gray-500">내 정보 · Hub API — 위 환영 메시지가 이 호출 결과예요</p>
          <pre className="text-sm bg-gray-100 rounded-lg p-3 overflow-x-auto"><code>{`// Server Component / Route Handler / Server Action 안에서
const res = await axhub.fetch("/api/v1/me", { cache: "no-store" });
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
          <code className="bg-gray-100 px-1 rounded">lib/axhub.ts</code> 가 들어온 요청의{" "}
          <code className="bg-gray-100 px-1 rounded">_hub_access</code> 쿠키를{" "}
          <code className="bg-gray-100 px-1 rounded">Authorization: Bearer</code> 로 포워딩해 사용자 자격으로
          호출해요. <strong>서버 전용</strong> — 클라이언트 컴포넌트에서 import 금지 (next/headers). 정적 API 키 안 써요.
        </p>
        <p className="text-[11px] text-gray-400">이 앱 슬러그: <code className="bg-gray-100 px-1 rounded">{axhub.slug || "(로컬 실행)"}</code></p>
      </section>

      <ol className="list-decimal list-inside text-sm text-gray-700 max-w-xl space-y-1">
        <li><code className="bg-gray-100 px-1 rounded">app/page.tsx</code> 를 열어 화면을 바꿔봐요.</li>
        <li>백엔드 호출은 위 <code className="bg-gray-100 px-1 rounded">axhub.fetch</code> / <code className="bg-gray-100 px-1 rounded">axhub.data</code> 패턴 그대로 (서버에서).</li>
        <li>다 만들었으면 Claude Code 에서 <code className="bg-gray-100 px-1 rounded">/axhub:deploy</code> → 배포 끝.</li>
      </ol>

      <footer className="text-xs text-gray-400 mt-4">Next.js · React · Tailwind · TypeScript</footer>
    </main>
  );
}
