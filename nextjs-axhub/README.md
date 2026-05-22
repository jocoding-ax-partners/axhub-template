# nextjs-axhub

axhub 위에서 바로 굴러가는 **Next.js 16 + React 19 + Tailwind 3** 템플릿이에요.
**Claude Code** 로 바이브코딩하면서 axhub 에 한 줄 명령으로 배포할 수 있게 미리 세팅돼 있어요.

## 0. 누가 쓰면 좋아요

비전공자, 비개발자, 기획자, 사무직, 디자이너 — 코드를 직접 한 줄도 안 짜더라도 AI 한테
"이런 화면 만들어줘" 만 부탁하면 알아서 굴러가도록 디자인됐어요.

## 1. 5분 안에 시작

```bash
# 1) 이 템플릿만 내 컴퓨터로 가져오기 (npm 깔려 있어야 함, Node 20+ 권장)
npx degit jocoding-ax-partners/axhub-template/nextjs-axhub my-app
cd my-app

# 2) 의존성 설치
npm install

# 3) (로컬 테스트용) 환경변수 채우기
cp .env.example .env.local
# .env.local 을 열어서 APPHUB_* 값을 채워요. axhub 로 배포하면 자동 주입돼요.

# 4) 로컬 서버 띄우기
npm run dev
# http://localhost:3000 에 접속
```

## 2. 바이브코딩 흐름

1. Claude Code 를 열어요.
2. "메인 페이지에 입력 폼이랑 결과 카드 넣어줘" 같은 자연어 요청을 던져요.
3. AI 가 `app/page.tsx` 같은 파일을 고쳐요.
4. 저장하면 브라우저가 자동 새로고침 — 결과 확인.
5. 마음에 들면 다음 기능, 안 들면 다시 부탁.

## 3. axhub Hub API 쓰기 (`@ax-hub/sdk`)

백엔드 호출은 **항상 `@ax-hub/sdk`** 경유. `lib/axhub-server.ts` 의 factory 헬퍼가
들어온 요청의 axhub 로그인 세션 쿠키(`_hub_access`)를 SDK 의 JWT 로 박아 *그 사용자 자격*으로 호출해요.

```ts
// 예: app/api/me/route.ts
import { makeAxhub } from "@/lib/axhub-server";

export async function GET() {
  const sdk = await makeAxhub();
  const me = await sdk.identity.me(); // 타입 안전: me.email / me.name / me.tenants[]
  return Response.json(me);
}
```

```ts
// 예: 앱 데이터 CRUD — sdk.tenant().app().data 까지 helper 한 줄로
import { makeApp } from "@/lib/axhub-server";

const app = await makeApp();
const todos = await app.data.discover<{ id: string; title: string; done: boolean }>("todos");
const page = await todos.list({ limit: 20 });
await todos.insert({ title: "할 일", done: false });
```

> ⚠️ `lib/axhub-server.ts` 는 **Server-side 전용**이에요 (`next/headers` 사용). `"use client"` 컴포넌트에서
> import 하면 빌드가 깨져요. axhub 호출은 항상 Server Component / Route Handler / Server Action 에서.
> 모듈 레벨에 `AxHubClient` 캐싱 금지 — 요청별로 `makeAxhub()` / `makeApp()` 새로 호출해야 사용자 자격이 안 섞여요.

### 3-A. Gateway query — 외부 DB / SaaS 조회 (핵심 기능)

axhub Gateway 는 자체 PostgreSQL / MySQL / SaaS connector 를 안전하게 조회시켜 줘요. 모든 호출이 audit log 에
기록되고, connector 권한 정책으로 게이트돼요. **직접 DB 접속 금지** — 항상 SDK 의 `gateway.query` 만.

```ts
// 예: app/api/employees/route.ts
import { makeTenant } from "@/lib/axhub-server";

export async function GET() {
  const t = await makeTenant(); // gateway 는 tenant 스코프
  const res = await t.gateway.query.run<{ id: number; name: string }>({
    connectorId: "a2763ffa-bd26-4d6d-933c-f5dc54722a27", // gateway.connectors.list() 로 확인
    path: "employees",
    sql: "SELECT id, name FROM employees WHERE active = $1 LIMIT $2",
    params: [true, 10],          // ✅ 항상 parameterized SQL (injection 방지)
    rowLimit: 10,
  });
  return Response.json({ rows: res.rows, auditEventId: res.auditEventId });
}
```

- `connectorId` / `path` 는 admin 이 발급한 ID — 사용자 입력으로 바꾸지 마요 (권한 우회 위험).
- 큰 결과는 `t.gateway.query.stream(...)` SSE 로.
- `PoolStaleError` (401, 자격 만료) / `PermissionDeniedError` (정책 거부) 분기 처리.

### 3-B. Query DSL — 데이터 API filter

`app.data.table(...).list({ where })` 에는 `where()` / `and()` / `or()` / `not()` 헬퍼 조합만 넣어요.
LIKE 패턴은 `%` / `_` 자동 escape + ReDoS 가드 내장이라 사용자 입력 그대로 넣어도 안전.

```ts
import { where, and, or, not, defineSchema } from "@ax-hub/sdk";
import { makeApp } from "@/lib/axhub-server";

const Orders = defineSchema({
  table: "orders",
  columns: {
    id: "uuid",
    status: { type: "enum", values: ["paid", "pending"] as const },
    total: "number",
  },
});

const app = await makeApp();
const filter = and(
  where(Orders.cols.status).eq("paid"),
  or(where(Orders.cols.total).gt(100), where("priority").eq("high")),
  not(where("archived").eq(true)),
);
const page = await app.data.table(Orders).list({
  where: filter,
  select: ["id", "total"] as const,   // projection — 필요한 컬럼만
  orderBy: [{ field: "id", dir: "asc" }],
  limit: 50,
});
```

## 4. axhub 에 배포

### A. Claude Code 사용자

```
/axhub:deploy
```

배포 미리보기 카드 → 동의 → 끝. 빌드 진행 상황 자동으로 한국어로 안내해줘요.

### B. CLI 직접

```bash
# 한 번만: axhub 콘솔에서 앱 등록 후 슬러그 복사
axhub apps          # 내 앱 목록 확인
axhub deploy create --app my-app-slug --branch main
axhub deploy status dep_xxxxx --watch
```

빌드는 repo 의 `Dockerfile`(`output:"standalone"` → `node server.js`)로 떠요.

## 5. 환경변수 / 설정

| 변수 | 용도 |
|------|------|
| `APPHUB_API_URL` | Hub API origin (`{{API_BASE}}`) |
| `APPHUB_APP_SLUG` | 내 앱 슬러그 (`{{APP_SLUG}}`) |
| `APPHUB_TENANT` | 내 테넌트 슬러그 (`{{TENANT}}`) |

axhub 로 배포하면 위 값들은 소스의 `{{...}}` placeholder 치환으로 **자동 주입**돼요. `.env.local` 은 로컬 테스트용 override. **API key 는 없어요** — 인증은 들어온 요청의 세션 쿠키 포워딩으로. data API 주소는 `API_URL` + 테넌트/슬러그로 자동 조합돼요.

## 6. 자주 막히는 곳

| 증상 | 해결 |
|------|------|
| `npm install` 실패 | Node 버전 20+ 인지 `node -v` 확인 |
| `axhub deploy` 가 "앱을 못 찾아요" | `axhub apps` 로 슬러그 다시 확인 |
| 빌드 통과한 것 같은데 페이지가 빈 화면 | Server Component 에서 `axhub.isConfigured` 출력해서 설정 확인 |
| `next/headers` import 에러 | `"use client"` 컴포넌트에서 `lib/axhub-server` 를 import 했는지 확인 — server 전용 |
| `TenantSlugRequiredError` 떨어짐 | `sdk.apps.*` 처럼 flat 호출 말고 `makeApp()` / `makeTenant()` 거치세요 — tenant 슬러그 자동 주입 |
| `AxHubClient requires tokenType` 에러 | 직접 `new AxHubClient({ token })` 만들 때 발생. 그냥 `makeAxhub()` 쓰세요 — tokenType 자동 |
| Tailwind class 가 안 먹음 | `tailwind.config.ts` 의 `content` 경로에 새 폴더 추가 |

## 7. 관련 자료

- [axhub 가이드](https://github.com/jocoding-ax-partners/axhub)
- [Next.js 16 docs](https://nextjs.org/docs)
- [Tailwind 3 docs](https://v3.tailwindcss.com)

## axhub-server.ts 신뢰 모델 (이 템플릿)

이 (Next.js) 템플릿은 **server-side**. axhub 호출은 `@ax-hub/sdk` 의 `AxHubClient` 한 종류만 — helper 는
`makeAxhub` / `makeApp` / `makeTenant` + `APP_SLUG` / `TENANT` / `isAxhubConfigured()` 를 노출해요.
인증은 axhub 로그인 세션 쿠키(`_hub_access`) 로:
이 템플릿은 들어온 요청의 쿠키(`next/headers` 의 `cookies()`) 를 JWT 로 꺼내 SDK 에 박고, SDK 가
`Authorization: Bearer` 로 자동 처리해요. 정적 API key 안 써요. 모듈-레벨 client 캐시 금지 — 매 요청마다 factory.
풀 비교 표는 [axhub-template README](../README.md#axhubts-신뢰-모델-3종-공통) 참고.

## 8. 라이선스

MIT — 마음껏 쓰세요.
