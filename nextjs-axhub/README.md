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

# 3) 로컬 DB 띄우기 + 환경변수
docker compose up -d          # 로컬 Postgres (localhost:5432). Docker 필요.
cp .env.example .env.local
# .env.local 의 DATABASE_URL 은 그대로 두면 위 Postgres 에 붙어요.
# APPHUB_* (로그인/gateway) 는 값을 채워요. axhub 로 배포하면 둘 다 자동 주입돼요.

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

## 3. 데이터 저장 (표준 PostgreSQL)

이 앱의 데이터는 **이 앱 전용 PostgreSQL** 에 저장해요. `lib/db.ts` 가 단일 진입점이고, 평범한 SQL 을 쓰면 돼요.
로컬은 `docker compose up -d`, 배포 땐 axhub 가 전용 DB 를 발급해 `DATABASE_URL` 을 자동 주입해요 (`axhub.yaml` 의 `database: { engine: postgres }`).

```ts
// 예: Server Action / Route Handler 안에서
import { db, ensureSchema } from "@/lib/db";

await ensureSchema();                                  // 테이블 정의는 lib/db.ts 에 (CREATE TABLE IF NOT EXISTS)
// 값은 tagged-template 으로 — 자동 바인딩되어 SQL injection 안전.
await db()`INSERT INTO todos (user_key, title) VALUES (${userKey}, ${title})`;
const rows = await db()<{ id: string; title: string }[]>`
  SELECT id::text, title FROM todos WHERE user_key = ${userKey} ORDER BY id DESC LIMIT 50`;
```

사용자별로 데이터를 가르려면 테이블에 `user_key` 컬럼을 두고 로그인 사용자로 필터해요 (아래 §3-A).

> ⚠️ `lib/db.ts` · `lib/axhub-server.ts` 는 **Server-side 전용**이에요. `"use client"` 컴포넌트에서 import 하면 빌드가 깨져요.

### 3-A. 로그인 사용자 · 인증 (`@ax-hub/sdk 3.x`)

`lib/axhub-server.ts` 의 factory 가 들어온 요청의 axhub 세션 쿠키(`_hub_access`)를 SDK 의 JWT 로 박아 *그 사용자 자격*으로 호출해요.

```ts
// 예: app/api/me/route.ts
import { makeAxhub } from "@/lib/axhub-server";

export async function GET() {
  const sdk = await makeAxhub();
  const me = await sdk.identity.me(); // 타입 안전: me.email / me.name / me.tenants[]
  return Response.json(me);
}
```

> 모듈 레벨에 `AxHubClient` 캐싱 금지 — 요청별로 `makeAxhub()` 새로 호출해야 사용자 자격이 안 섞여요.
> `me.email` 을 데이터 테이블의 `user_key` 로 쓰면 사용자별 격리가 돼요.

### 3-B. Gateway query — 외부 DB / SaaS 조회 (핵심 기능)

axhub Gateway 는 자체 PostgreSQL / MySQL / SaaS connector 를 안전하게 조회시켜 줘요. 모든 호출이 audit log 에
기록되고, connector 권한 정책으로 게이트돼요. **직접 DB 접속 금지** — 항상 SDK 의 `gateway.query` 만.

```ts
// 예: app/api/employees/route.ts
import { queryConnector } from "@/lib/axhub-server";

export async function GET() {
  // connector "이름" 으로 호출 — grant·session·UUID 스코프는 queryConnector 가 알아서 처리해요.
  const res = await queryConnector<{ id: number; name: string }>({
    connector: "my-db",          // connector 이름 (gateway.me.connectors() 의 .name) — 활성 grant 필요
    sql: "SELECT id, name FROM employees WHERE active = $1 LIMIT $2",  // postgres 네이티브 $n placeholder — '?' 는 백엔드에서 500(internal_error)
    params: [true, 10],          // ✅ 항상 parameterized · $1,$2 순서대로 (injection 방지)
  });
  return Response.json({ rows: res.rows, rowCount: res.rowCount });
}
```

- `connector` 는 connector "이름" — `queryConnector` 가 `gateway.me.connectors()` 로 UUID 를 resolve 해요 (활성 grant 가 있는 connector 만 보여요). ⚠️ gateway 는 tenant 경로에 UUID 가 필요해 slug 기반 `makeTenant()` 로는 안 돼요 (helper 가 `me()` 로 tenant UUID 를 잡아줘요).
- `connector` / `sql` 은 코드 상수 — 사용자 입력은 반드시 `params` 로 분리 (권한 우회·injection 방지). 결과 cap 은 SQL `LIMIT`.
- **정책 deny 는 throw** — `try/catch` 로 `PermissionDeniedError` (정책 거부) / `UnauthenticatedError` (session 만료) / `NotFoundError` (grant 없음) 분기. in-band `res.allowed` 플래그는 더 이상 없어요. (SDK 3.x: grant 기반 session 모델.)

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

`axhub.yaml` 을 새로 쓰거나 고칠 때는 `axhub.yaml.example` 에 axhub.yaml 에서 쓸 수 있는 필드와 제약을 모두 적어뒀으니 먼저 참고하세요.

빌드는 repo 의 `Dockerfile`(`output:"standalone"` → `node server.js`)로 떠요.

## 5. 환경변수 / 설정

| 변수 | 용도 |
|------|------|
| `DATABASE_URL` | 앱 데이터 PostgreSQL (런타임). 로컬은 docker compose, 배포는 axhub 주입 |
| `DIRECT_DATABASE_URL` | 스키마 초기화/마이그레이션용 (직결). 로컬은 비우면 `DATABASE_URL` 로 폴백 |
| `APPHUB_API_URL` | Hub API origin (`{{API_BASE}}`) — 로그인/gateway |
| `APPHUB_APP_SLUG` | 내 앱 슬러그 (`{{APP_SLUG}}`) |
| `APPHUB_TENANT` | 내 테넌트 슬러그 (`{{TENANT}}`) |

axhub 로 배포하면 `DATABASE_URL`/`DIRECT_DATABASE_URL`(전용 DB 발급) 과 `APPHUB_*`(로그인/gateway) 가 **자동 주입**돼요. `.env.local` 은 로컬 테스트용 override. **API key 는 없어요** — 인증은 들어온 요청의 세션 쿠키 포워딩으로.

## 6. 자주 막히는 곳

| 증상 | 해결 |
|------|------|
| `npm install` 실패 | Node 버전 20+ 인지 `node -v` 확인 |
| `axhub deploy` 가 "앱을 못 찾아요" | `axhub apps` 로 슬러그 다시 확인 |
| 빌드 통과한 것 같은데 페이지가 빈 화면 | Server Component 에서 `isAxhubConfigured()` 출력해서 설정 확인 |
| `next/headers` import 에러 | `"use client"` 컴포넌트에서 `lib/axhub-server` 를 import 했는지 확인 — server 전용 |
| `TenantSlugRequiredError` 떨어짐 | `sdk.apps.*` 처럼 flat 호출 말고 `makeTenant()` 거치세요 — tenant 슬러그 자동 주입 |
| `AxHubClient requires tokenType` 에러 | 직접 `new AxHubClient({ token })` 만들 때 발생. 그냥 `makeAxhub()` 쓰세요 — tokenType 자동 |
| Tailwind class 가 안 먹음 | `tailwind.config.ts` 의 `content` 경로에 새 폴더 추가 |

## 7. 관련 자료

- [axhub 가이드](https://github.com/jocoding-ax-partners/axhub)
- [Next.js 16 docs](https://nextjs.org/docs)
- [Tailwind 3 docs](https://v3.tailwindcss.com)

## 신뢰 모델 (이 템플릿)

이 (Next.js) 템플릿은 **server-side**.

- **데이터**: `lib/db.ts` 의 `db()` / `ensureSchema()` 가 표준 PostgreSQL 에 붙어요. `DATABASE_URL`(런타임, `prepare:false`) ·
  `DIRECT_DATABASE_URL`(마이그레이션). 로컬은 docker compose, 배포는 axhub 가 전용 DB 발급 + 주입.
- **인증/식별 · gateway**: `lib/axhub-server.ts` 의 `@ax-hub/sdk 3.x` — helper `makeAxhub` / `makeTenant` / `makeGateway` /
  `queryConnector` + `APP_SLUG` / `TENANT` / `isAxhubConfigured()`. 들어온 요청의 쿠키(`next/headers` 의 `cookies()` 로 읽은
  `_hub_access`)를 JWT 로 꺼내 SDK 에 박고 SDK 가 `Authorization: Bearer` 자동 처리. 정적 API key 안 써요.
  모듈-레벨 client 캐시 금지 — 매 요청마다 factory.

## 8. 라이선스

MIT — 마음껏 쓰세요.
