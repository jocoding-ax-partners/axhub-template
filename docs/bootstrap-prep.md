# bootstrap 준비 — Dockerfile + axhub.yaml 정리 + lib/axhub 설정 주입 + ADR 현행화

> **상태:** Historical draft — 설계 결정 6/6 확정 뒤 템플릿 구현 완료. 2026-06-08 기준 server 템플릿은 `@ax-hub/sdk 2.x`, Vite 는 브라우저 전용 세션 fetch 헬퍼로 정렬됨. 작성: 2026-05-20, ksro0128 (초안: Claude).
> **목적:** ax-hub-backend 의 spec 299 (app-bootstrap) 백엔드는 머지됐는데, 이 repo 3종에 **Dockerfile 이 없어** bootstrap 을 실제로 돌리면 배포 resolve 단계에서 깨진다. 이 문서는 그 후속 — 이 repo 를 bootstrap end-to-end 동작하도록 준비.
> **scope:** **이 repo (`axhub-template`) 전용.** ax-hub-backend 코드는 한 줄도 안 건드린다 (백엔드 contract 는 검증만 — §4).
> **관련:** ax-hub-backend `docs/spec/299-feat-app-bootstrap/`, 이 repo `docs/adr/0001-version-floors.md`.

---

## 1. 왜 지금 (blocker)

spec 299 의 5 PR 이 머지되어 백엔드의 bootstrap saga·GitHub write·probe·return_origin 은 준비됐다. 하지만 saga 의 마지막 `stageDeploy` → orchestrator (`resolve → ci → build → apply → healthcheck`) 의 **resolve** 가 repo 루트에서 `Dockerfile` 을 요구한다:

```
# ax-hub-backend / deploy/outbound/specresolver/resolver.go
if !have["Dockerfile"] { return errMissingDockerfile }   // compose 모드 아닐 때
```

이 repo 3종 (`vite-react-axhub`, `nextjs-axhub`, `astro-axhub`) 에 **Dockerfile 이 없다** (§2.1). 즉 지금 bootstrap 을 돌리면 repo 생성·push 까지는 되지만 배포가 resolve 에서 fail 한다. **이 작업이 끝나야 spec 299 의 가치(한 클릭 → 동작하는 앱 URL)가 실현**된다.

---

## 2. 현재 상태 (검증된 사실, 2026-05-20)

### 2.1 3종 구조

| 폴더 | 분류 | 빌드 산출 | 시작 | 포트 | Dockerfile |
|---|---|---|---|---|---|
| `vite-react-axhub/` | **Browser SPA** (정적) | `tsc -b && vite build` → `dist/` | nginx 정적 서빙 | 80 | ❌ 없음 |
| `nextjs-axhub/` | **Server** (Node SSR) | `next build` (`output:"standalone"`) | `node server.js` | 3000 | ❌ 없음 |
| `astro-axhub/` | **Server** (Node SSR) | `astro build` (`@astrojs/node` standalone) | `node ./dist/server/entry.mjs` | 3000 | ❌ 없음 |

> ⚠️ nextjs 는 `next.config.ts` 가 **`output:"standalone"`** 이다. standalone 은 `.next/standalone`(자체 `server.js`) + `.next/static` + `public` 만 복사해 `node server.js` 로 띄운다 — `npm start`(=`next start`) 아님. Dockerfile 이 그에 맞아야 함 (§3.1.2).

### 2.2 lib/axhub 인증 모델 — **server : browser 가 갈린다**

| 템플릿 | transport | 환경변수 | 401/silent SSO |
|---|---|---|---|
| `vite-react` | `credentials:"include"` (cookie) + 브라우저 전용 세션 fetch 헬퍼 | `import.meta.env.VITE_APPHUB_*` | **있음** (401 → silent SSO) |
| `nextjs` | `@ax-hub/sdk 2.x` request-scoped `AxHubClient` (`_hub_access` → SDK JWT) | `process.env.APPHUB_*` + placeholder fallback | 없음 (server) |
| `astro` | `@ax-hub/sdk 2.x` request-scoped `AxHubClient` (`Astro.request` cookie ctx → SDK JWT) | `import.meta.env.APPHUB_*` / `process.env.APPHUB_*` + placeholder fallback | 없음 (server) |

ADR-0001 의 **P5 carve-out** 그대로 — 자격은 `_hub_access` 사용자 세션 JWT 로 통일하지만 전송은 구조적 차이. 즉 **silent SSO(브라우저 redirect)는 vite-react 에만** 의미가 있고, server 템플릿은 SDK 2.x factory 가 들어온 쿠키를 JWT 로 포워딩한다.

또 3종 전부 **`{{...}}` placeholder 를 0개 사용** (build-time env-var 방식). 백엔드 saga 의 치환 모델(§4)과 안 맞음 → §3.3.

### 2.3 axhub.yaml — dead 필드 + 오해 소지 주석

백엔드 resolver 가 *실제로 읽는* 필드: `runtime.port`, `runtime.health_path`(probe 가 사용), `build.{deploy_method, dockerfile, compose_file, framework(라벨)}`, `ci.commands`.

현재 axhub.yaml 의 **dead 필드** (resolver 가 안 읽음): `name`, `build.install`, `build.build`, `build.start`.

> ⚠️ 현재 axhub.yaml 주석이 *"backend 가 vite.config/next.config 를 자동 감지해서 preset 으로 배포"* 라는데 **사실 아님**. resolver 에 framework preset / Dockerfile 자동생성 로직은 없다 — `framework` 는 라벨일 뿐, **Dockerfile 은 반드시 존재해야** 한다. 주석 정정 (§3.2).

### 2.4 ADR-0001 이 stale

현재 ADR 은 **6개 템플릿 + Remix(H2)** 기준(`examples/` 시절). 실제 이 repo 는 **3종, Remix 없음**. H2·재평가 일정·P5 carve-out 의 "5 server : 1 browser" 가 어긋남 → §3.4.

---

## 3. 변경사항 (이 repo)

### 3.1 Dockerfile 3장

백엔드 resolver 는 `EXPOSE` 첫 포트를 containerPort 로 추론(`runtime.port` override 가능) → **EXPOSE 와 axhub.yaml `runtime.port` 일치**.

**vite-react (browser → nginx):**
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build              # → /app/dist

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf   # SPA fallback (§3.1.4)
EXPOSE 80
```

**nextjs (standalone — `server.js`):**
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build              # output:"standalone"

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

**astro (@astrojs/node standalone):**
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build              # → dist/server/entry.mjs

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
EXPOSE 3000
CMD ["node", "./dist/server/entry.mjs"]
```

**vite-react/nginx.conf (SPA fallback):**
```nginx
server {
  listen 80;
  location / {
    root   /usr/share/nginx/html;
    index  index.html;
    try_files $uri $uri/ /index.html;
  }
}
```

### 3.2 axhub.yaml 정리 (3종)

- dead 필드 제거: `name`, `build.install`, `build.build`, `build.start`.
- 오해 소지 주석 교체: "자동 감지 preset" → "Dockerfile 로 빌드. axhub.yaml 은 port/health_path override 만".
- 유지: `runtime.port`, `runtime.health_path`.

```yaml
# After (nextjs/astro 예시)
runtime:
  port: 3000
  health_path: /
```
vite-react 는 `port: 80`.

### 3.3 lib/axhub — 설정 주입을 saga placeholder 로 통일

**문제:** 현재 lib/axhub 는 build-time env-var (`VITE_APPHUB_API_URL` 등) 를 읽는데, saga 는 파일을 **string 치환** (`{{API_BASE}}` 등) 한다. 배포 빌드에 VITE_ env 주입 경로가 없으므로(BuildArgs 비어있음) 현재 방식은 안 돈다.

**제안 (→ Q2):** env-var → saga 가 채우는 `{{...}}` placeholder 로 교체. 사용 가능: `{{APP_SLUG}}` `{{APP_SUBDOMAIN}}` `{{APP_NAME}}` `{{TENANT}}` `{{API_BASE}}` `{{APP_ORIGIN}}`. (`DATA_BASE` 없음 → `{{API_BASE}}`+path 조합 — Q4)

**vite-react (browser) — silent SSO 포함:**
```ts
const API_BASE   = "{{API_BASE}}";
const APP_ORIGIN = "{{APP_ORIGIN}}";  // https://{subdomain}.{tenant}.{base}
const APP_SLUG   = "{{APP_SLUG}}";
const TENANT     = "{{TENANT}}";

export async function axhubFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
  if (r.status === 401) {
    window.location.href =
      `${API_BASE}/auth/silent/start?return_origin=${encodeURIComponent(APP_ORIGIN)}`;
  }
  return r;
}
// data: `${API_BASE}/data/${TENANT}/${APP_SLUG}/<table>`   (경로 확정 → Q4)
```
> silent SSO endpoint `/auth/silent/start?return_origin=` 는 실재 확인됨 (`identity/inbound/http`), `_hub_hint` 쿠키가 prompt=none 재인증을 구동. spec 299 PR #76 이 return_origin 매처를 DynamicAllowList 로 통일 → user-app host 매칭 통과.

**nextjs/astro (server) — 구현 완료(Q1): 사용자 세션 JWT 포워딩, 정적 API key 폐기, `@ax-hub/sdk 2.x` 사용.**
백엔드 인증 체인은 `JWT(Bearer 또는 _hub_access 쿠키) → PAT → RequireAuth` 이고, `_hub_access` 는 apex 도메인(`AXHUB_COOKIE_DOMAIN=axhub.ai`)에 발급돼 모든 서브도메인(user app 포함)에 공유된다 (검증: `httpx/middleware.go`, `auth_handlers.go`). 따라서 server 템플릿도 정적 `APPHUB_API_KEY` 가 아니라 **사용자 세션 자격**을 쓴다:

- **사용자 식별**: L2 게이트가 진입 시 주입한 `X-AxHub-*` 헤더를 incoming request 에서 읽음 (backend `/me` 호출 0 — spec 298).
- **data 호출**: incoming request 의 `_hub_access` 를 꺼내 backend 에 `Authorization: Bearer <jwt>` 로 **포워딩** (Cookie 헤더로 보내도 됨). server-to-server 라 CORS 무관.
- **401 처리 (드묾 — 게이트가 진입 시 이미 인증)**: `window` 가 없으니 server-side redirect Response 로 `/auth/silent/start?return_origin=...`.
- lib/axhub server 변형은 framework 관용(Next `cookies()`/`headers()`, Astro `Astro.request`)으로 incoming request 를 받는다 — ADR P5 carve-out 의 "transport 차이"는 유지(브라우저 자동전송 vs SSR 수동 포워딩)하되 **자격(사용자 JWT)은 3종 통일**.

### 3.4 ADR-0001 재작성 (in-place, 별 작업)

- **H2 (Remix) 삭제** (repo 에 remix 없음).
- "6개 템플릿" → "3종" 카운트/문구 정정.
- **P5 carve-out 재산정**: server:browser = **2:1** (nextjs/astro : vite-react).
- 새 결정 기록: 설정 주입을 env-var → bootstrap placeholder 치환으로 전환한 이유 + silent SSO 가 browser 한정인 근거.
- H1 (TW3), H3 (Vite) 유지.

---

## 4. 백엔드 contract (검증 결과 — 변경 없음)

| 항목 | 동작 |
|---|---|
| Dockerfile 필수 | 루트 `Dockerfile` 없으면 `errMissingDockerfile` (resolve fail) |
| 포트 추론 | Dockerfile 첫 `EXPOSE` → containerPort, `runtime.port` override |
| placeholder 치환 | 6종, **fetch 된 전 파일에 적용** (`bootstrap/service.go`) |
| `{{APP_ORIGIN}}` | `https://{subdomain}.{tenant}.{base_domain}` |
| probe | liveness/readiness 가 `runtime.health_path` 사용 (PR #75) |

→ 이 작업은 contract 의 **소비측만** 맞춘다. 백엔드 수정 불필요.

---

## 5. 작업 순서 / PR 분리 (Q 결정 후 확정)

```
[axhub.yaml 정리] [Dockerfile 3장] [nginx.conf] ──> [docker build smoke 3종] ──> [1종 e2e bootstrap]
[lib/axhub 치환 (Q1/Q2/Q3 결정 후)] ───────────────────────────────────────────┘
                                                                                ──> [ADR 재작성(마지막)]
```

- PR 1: Dockerfile 3장 + nginx.conf + axhub.yaml 정리 → `docker build` 3종 통과 (critical path).
- PR 2: lib/axhub placeholder 치환 + silent SSO (Q1/Q2/Q3 의존).
- PR 3: ADR-0001 재작성.

검증: 3종 `docker build` smoke / vite-react 1종 e2e bootstrap → live URL 200 / 미로그인 접근 → 401 → silent SSO → 복귀.

---

## 결정 사항 (Open Questions → 6/6 Decided)

| # | 결정사항 | 상태 / 결정 | 비고 |
|---|---|---|---|
| **Q1** ⭐ | server 템플릿(nextjs/astro)의 인증·silent SSO | **Decided ✓ — 사용자 세션 JWT(`_hub_access`) 로 3종 통일, 정적 `APPHUB_API_KEY` 폐기** | §3.3.2. browser 자동전송 / SSR forward-cookie. backend 인증 체인·apex 쿠키 도메인 검증 완료 |
| Q3 | silent SSO endpoint 실제 계약 | **Decided ✓ — `/auth/silent/start?return_origin=` 실재 확인** | `_hub_hint` 쿠키가 prompt=none 구동 |
| Q5 | nextjs Dockerfile | **Decided ✓ — standalone(`server.js`)** | next.config 가 이미 `output:"standalone"` |
| Q6 | vite-react SPA fallback | **Decided ✓ — 별 nginx.conf** | `try_files … /index.html` |
| Q2 | 설정 주입 모델 | **Decided ✓ — placeholder 치환 (env-var 방식 아님)** | deploy 의 env 주입(Cloud Build build args + K8s 런타임 EnvFrom)은 *앱에 등록된 env var* 만 대상. 그런데 ⑴ bootstrap `stageApp` 은 env 를 안 만들고(`{Name,Slug,Subdomain,Tier}` 만) ⑵ 시스템 컨텍스트(API base/slug 등) 자동주입 없음 ⑶ vite-react 는 정적 SPA 라 런타임 env 가 브라우저에 안 닿음. → placeholder 가 현재 wired 된 유일 경로. (사용자 *본인* env(시크릿/플래그)는 기존 env-var 기능으로 별도 추가 가능 — 그건 build args+런타임으로 정상 주입됨) |
| Q4 | data API base 구성 | **Decided ✓ — `${API_BASE}/data/{tenantSlug}/{appSlug}/{table}`** | `dataapi/routes.go:50` 라우트 확인 |

> **6/6 결정 완료.** §3.3 / §5 그대로 구현 가능 — 구현 PR 만 남음.
