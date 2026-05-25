import { AxHubError } from '@ax-hub/sdk'
import {
  APP_SLUG,
  isAxhubConfigured,
  makeAxhub,
} from '@/lib/axhub-server'
import type { MeResponse } from '@ax-hub/sdk'

// 서버 컴포넌트에서 직접 호출 — makeAxhub() 가 들어온 _hub_access 쿠키를 JWT 로 SDK 에 박아요.
// per-user 응답이라 cache: 'no-store' 로 매 요청 평가 (SDK 가 받는 RequestOptions 로 전달).
async function loadMe(): Promise<MeResponse | null> {
  if (!isAxhubConfigured()) return null
  try {
    const sdk = await makeAxhub()
    return await sdk.identity.me()
  } catch (err) {
    // AxHubError 면 .code 로 분기 가능 (Korean message 매칭 금지).
    if (err instanceof AxHubError) {
      console.error('[axhub] /me failed', { code: err.code, category: err.category, requestId: err.requestId })
    }
    return null
  }
}

export default async function Home() {
  const me = await loadMe()
  const tenant = me?.tenants?.[0]
  const configured = isAxhubConfigured()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 font-sans">
      <h1 className="text-4xl font-bold">axhub × Next.js</h1>

      {/* 환영 — sdk.identity.me 결과 (서버에서 호출) */}
      <section className="rounded-2xl border border-gray-200 p-6 w-full max-w-xl text-center">
        {me ? (
          <>
            <p className="text-2xl font-semibold">환영합니다, {me.name ?? me.email}님 👋</p>
            <p className="mt-1 text-sm text-gray-500">
              {me.email}
              {tenant ? ` · ${tenant.tenantSlug} (${tenant.role})` : ''}
            </p>
          </>
        ) : (
          <p className="text-amber-600">
            {configured
              ? '로그인 정보를 불러오지 못했어요. axhub 로그인 상태를 확인해 주세요.'
              : '로컬 실행 중 — axhub 로 배포하면 로그인한 사용자가 여기 표시돼요.'}
          </p>
        )}
      </section>

      {/* 백엔드 호출 치트시트 — SDK 패턴만 */}
      <section className="rounded-2xl border border-gray-200 p-6 w-full max-w-xl space-y-4">
        <h2 className="text-sm font-semibold">백엔드, 이렇게 호출해요 (서버에서, SDK)</h2>

        <div className="space-y-1">
          <p className="text-xs text-gray-500">내 정보 · sdk.identity.me — 위 환영 메시지가 이 호출 결과예요</p>
          <pre className="text-sm bg-gray-100 rounded-lg p-3 overflow-x-auto"><code>{`// Server Component / Route Handler / Server Action 안에서
import { makeAxhub } from "@/lib/axhub-server";
const sdk = await makeAxhub();
const me = await sdk.identity.me();
// me.email, me.name, me.tenants[]`}</code></pre>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-500">앱 데이터 — sdk.data.discover (스키마 자동 추론)</p>
          <pre className="text-sm bg-gray-100 rounded-lg p-3 overflow-x-auto"><code>{`import { makeApp } from "@/lib/axhub-server";
const app = await makeApp(); // sdk.tenant(TENANT).app(APP_SLUG)
const todos = await app.data.discover<{ id: string; title: string; done: boolean }>("todos");
const page = await todos.list({ limit: 20 });
await todos.insert({ title: "할 일", done: false });`}</code></pre>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-500">Gateway — 외부 DB/SaaS 조회 (connector 이름으로, parameterized SQL, audit log)</p>
          <pre className="text-sm bg-gray-100 rounded-lg p-3 overflow-x-auto"><code>{`import { queryConnector } from "@/lib/axhub-server";
// connector 이름만 — UUID·tenant 스코프는 helper 가 자동 처리 (connectors.list() 로 resolve)
const res = await queryConnector<{ id: number; name: string }>({
  connector: "my-db",           // connector 이름 (UUID 아님)
  path: "public/employees",     // connector 안 리소스 경로
  sql: "SELECT id, name FROM employees WHERE active = ? LIMIT ?",
  params: [true, 10],           // ✅ 항상 parameterized
});
// res.rows (컬럼 매핑된 객체) / res.rowCount / res.allowed (false 면 정책 deny)`}</code></pre>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-500">Query DSL — where / and / or (raw SQL 금지)</p>
          <pre className="text-sm bg-gray-100 rounded-lg p-3 overflow-x-auto"><code>{`import { where, and, or, defineSchema } from "@ax-hub/sdk";
const Orders = defineSchema({ table: "orders", columns: { status: "string", total: "number" }});
const filter = and(where(Orders.cols.status).eq("paid"), or(where("total").gt(100), where("priority").eq("high")));
const page = await app.data.table(Orders).list({ where: filter, select: ["status","total"] as const, limit: 50 });`}</code></pre>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-500">에러 처리 — error.code 분기 (Korean message 매칭 금지)</p>
          <pre className="text-sm bg-gray-100 rounded-lg p-3 overflow-x-auto"><code>{`import { AxHubError, ConflictError } from "@ax-hub/sdk";
try {
  await app.data.discover("todos").then(t => t.insert({ id: "t1" }));
} catch (e) {
  if (e instanceof ConflictError) {/* 중복 키 처리 */}
  else if (e instanceof AxHubError) console.error(e.code, e.category, e.requestId);
}`}</code></pre>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          <code className="bg-gray-100 px-1 rounded">lib/axhub-server.ts</code> 가 들어온 요청의{' '}
          <code className="bg-gray-100 px-1 rounded">_hub_access</code> 쿠키를 JWT 로 꺼내{' '}
          <code className="bg-gray-100 px-1 rounded">AxHubClient</code> 에 박아요. <strong>서버 전용</strong> — 클라이언트 컴포넌트에서 import 금지 (next/headers). 모듈 레벨 클라이언트 캐시 금지 (사용자 자격 혼선).
        </p>
        <p className="text-[11px] text-gray-400">이 앱 슬러그: <code className="bg-gray-100 px-1 rounded">{configured ? APP_SLUG : '(로컬 실행)'}</code></p>
      </section>

      <ol className="list-decimal list-inside text-sm text-gray-700 max-w-xl space-y-1">
        <li><code className="bg-gray-100 px-1 rounded">app/page.tsx</code> 를 열어 화면을 바꿔봐요.</li>
        <li>백엔드 호출은 위 <code className="bg-gray-100 px-1 rounded">makeAxhub</code> / <code className="bg-gray-100 px-1 rounded">makeApp</code> 패턴 그대로 (서버에서).</li>
        <li>다 만들었으면 Claude Code 에서 <code className="bg-gray-100 px-1 rounded">/axhub:deploy</code> → 배포 끝.</li>
      </ol>

      <footer className="text-xs text-gray-400 mt-4">Next.js · React · Tailwind · TypeScript · @ax-hub/sdk</footer>
    </main>
  )
}
