# ADR-0001: 2026 BP 버전 홀드백 + 명명된 unblock 드라이버

**상태:** Accepted (2026-04-28) · 개정 (2026-05-20 — 템플릿 3종 정리 + 부트스트랩 인증·설정 모델 반영) · 개정 (2026-06-08 — Node SDK 2.x 템플릿 정렬) · 개정 (2026-06-14 — Node SDK 3.0 정렬: gateway grant·session 모델 + 백엔드 15fd5a2 surface)
**의사결정자:** ralplan 합의 (Planner / Architect / Critic, 2 iter) · 개정: ksro0128 (axhub bootstrap 준비, [docs/bootstrap-prep.md](../bootstrap-prep.md))

## 배경

조코딩 AX 파트너스의 vibe-coder 템플릿을 2026년 4월 베스트 프랙티스에 맞춰 audit + 갱신.
일부 의존성을 의도적으로 최신 메이저 버전으로 올리지 **않았어요**. 각 홀드백은 명시된 unblock 드라이버가 있을 때 다시 평가합니다.

**2026-05 개정:** 초기 6종 중 `express` / `hono` / `remix` 템플릿을 제거(commit `11a3a0a`)해 현재 **3종**만 유지 — 모두 프론트엔드:

| 템플릿 | 분류 | 비고 |
|---|---|---|
| `vite-react-axhub` | **Browser SPA** (정적, nginx) | 유일한 브라우저 템플릿 |
| `nextjs-axhub` | **Server** (Node SSR, `output:"standalone"`) | |
| `astro-axhub` | **Server** (Node SSR, `@astrojs/node` standalone) | |

## 5개 운영 원칙

1. **Vibe coder primacy** — TTHW(Time-To-Hello-World) < 5분 절대 사수
2. **2026 BP ≠ bleeding edge** — 최신 STABLE 우선, RC / pre-1.0 회피
3. **Backward-compat default** — major bump 은 명명된 driver 필요
4. **LLM 학습 데이터 밀도 우선** — vibe coder + AI 도구가 익숙한 패턴 매칭
5. **Convergence** — **carve-out: 자격(사용자 세션 JWT)은 3종 통일하되 호출 표면은 runtime 별로 분리. Browser SPA 는 `axhub.fetch/data/slug/isConfigured`, server SSR 은 `@ax-hub/sdk 6.x` factory(`makeAxhub`/`makeApp`/`table`)를 쓴다. 전송 방식(browser 자동 쿠키 vs SSR 쿠키 포워딩)은 구조적 차이라 carve-out** (§부트스트랩 인증·설정).

## 의도적 홀드백

### H1: Tailwind CSS 3.x (TW 4 미적용)

**적용 대상:** `nextjs-axhub`, `vite-react-axhub`
**현재 핀:** `tailwindcss: ^3.4.x`
**미적용 이유:**
- Tailwind 4 는 PostCSS 플러그인을 `@tailwindcss/postcss` 로 교체 + `tailwind.config.ts` 폐기 + 테마를 CSS `@theme` 디렉티브로 이동 → vibe coder TTHW 친화적이지 않음 (P1 위반)
- 2026-01 기준 LLM 학습 코퍼스에서 TW 3 예제가 압도적 다수. AI 가 TW 4 클래스를 제안할 때 환각 빈발 (P4 위반)
- TW 4 는 안정적이지만 vibe coder 가 따라할 튜토리얼 + Stack Overflow 답변이 아직 v3 dominant

**Unblock driver:** TW 4 LLM 학습 데이터 밀도가 v3 와 비슷해질 때 (예상 H2 2026). 또는 axhub 공식 가이드가 TW 4 로 전환 시.

### H2: Vite 8 (`vite-react-axhub`)

**적용 대상:** `vite-react-axhub`
**현재 핀:** `vite: ^7.3.2`, `@vitejs/plugin-react: ^5.2.0`
**미적용 이유:**
- Vite 8 + `@vitejs/plugin-react@6` 는 새 peer dep `@rolldown/plugin-babel` + `babel-plugin-react-compiler` 도입 → 의존성 표면 증가 (P1 위반)
- Rolldown 번들러 + React Compiler 는 GA 후 1년 미만 → 생태계 패턴 / LLM 학습 데이터 미성숙 (P2, P4 위반)
- Vite 7.3 도 동일하게 `Node ^20.19 || >=22.12` 요구 → 이미 modern Node 강제, 추가 가치 적음

**Unblock driver:** Rolldown + react-compiler 생태계 stabilization (예상 ~Q3 2026). Vite 8.x 가 패치 누적 후 framework 들이 peer 범위에 v8 명시 시.

> 개정 전 H2 였던 **Remix 2 홀드백**은 `remix-axhub` 템플릿 제거(2026-05)로 무효화 — 삭제함.

## 부트스트랩 인증·설정 모델 (2026-05-20 추가)

axhub one-click bootstrap(spec 299) 정합 작업에서 결정. 상세·근거는 [docs/bootstrap-prep.md](../bootstrap-prep.md).

### 자격: 사용자 세션 JWT 통일 — 정적 API key 폐기

3종 모두 axhub 세션 JWT(`_hub_access` 쿠키, apex 도메인 발급 → 서브도메인 공유)로 인증한다. 기존의 정적 `APPHUB_API_KEY` Bearer 모델은 **폐기** — per-user 가 아니라 axhub 의 사용자 단위 게이트 모델(spec 297/298)과 안 맞았다.

- **vite-react (browser):** `credentials: "include"` 로 쿠키 자동 전송. 401 → `{{API_BASE}}/auth/silent/start?return_origin=...` silent SSO.
- **nextjs / astro (server):** `@ax-hub/sdk 6.x` 의 request-scoped `AxHubClient` 를 만든다. data/identity/gateway 호출은 들어온 요청의 `_hub_access` 를 SDK JWT 로 전달하고 SDK 가 `Authorization: Bearer` 로 처리한다. (Next: `next/headers` `cookies()`, Astro: 호출 시 `Astro.request` 쿠키 ctx 전달.) 모듈 레벨 client 캐싱 금지.

### 설정 주입: bootstrap placeholder 치환 — env-var 방식 아님

config 는 saga 가 push 시점에 `{{API_BASE}}` / `{{APP_SLUG}}` / `{{TENANT}}` / `{{APP_ORIGIN}}` placeholder 를 실제 값으로 치환해 소스에 박는다. 로컬 템플릿 개발용으로 `import.meta.env`/`process.env` fallback 만 둔다.

이유: ⑴ deploy 의 env 주입은 *앱에 등록된 env var* 만 대상인데 bootstrap 은 env 를 안 만든다 ⑵ 시스템 컨텍스트(API base/slug 등) 자동주입이 없다 ⑶ `vite-react` 는 정적 SPA 라 런타임 env 가 브라우저에 안 닿는다 → 빌드 시점 baking 이 필수다. 사용자 *본인* 시크릿/플래그는 기존 env-var 기능으로 별도 추가 가능(그건 build args + 런타임으로 정상 주입).

## 적용된 변경 (대조)

| 변경 | 위치 | Driver |
|------|------|--------|
| `eslint-config-next` 15.1.4 → ^16.2.4 | `nextjs-axhub` | Next 16 와 버전 매치 (실제 mismatch 였음) |
| `react/-dom` 18 → ^19.2.1 | `vite-react-axhub` | React 19 stable 16개월+ |
| `@vitejs/plugin-react` ^4 → ^5.2.0 | `vite-react-axhub` | React 19 지원 + Vite 7 peer (no Rolldown 강제) |
| `vite` ^5 → ^7.3.2 | `vite-react-axhub` | 2 major modernization, no Rolldown tax |
| `eslint-plugin-react-hooks` rc → ^7.1.1 | `vite-react-axhub` | RC → stable v7 |
| `engines.node: "^20.19 || >=22.12"` | `vite-react-axhub` | Vite 7 mandate |
| `.editorconfig` (top-level + per-template) | 전 템플릿(당시 6종) | Zero-dep hygiene |
| `CLAUDE.md` 에 axhub.ts 신뢰 모델 섹션 | 전 템플릿 | P5 carve-out 가시화 |
| express/hono/remix 템플릿 제거 → 3종 | repo 전체 (`11a3a0a`) | scope 축소 — 프론트엔드 3종에 집중 |
| Dockerfile 3장 + lib/axhub 인증·설정 정합 | 3종 (`feat/bootstrap-prep`) | spec 299 bootstrap end-to-end |
| Server templates → `@ax-hub/sdk 2.x` request-scoped factories | `nextjs-axhub`, `astro-axhub` | SDK 2.x verified method surface + runtime table introspection |
| `@ax-hub/sdk` 2.x → `^3.0.0` (gateway grant·session 모델, `res.allowed` in-band 플래그 → throw, catalog/engines 표면 제거) | `nextjs-axhub` (gateway helper), `astro-axhub` (핀) | 백엔드 15fd5a2 DAC Phase 1 + presets surface 정합 (라이브 prod E2E 검증) |
| `@ax-hub/sdk` 3.x → `^6.0.0` (developer-surface 정렬 — admin/콘솔/브라우저 인증 표면 제거, 85 ops) | `nextjs-axhub`, `astro-axhub` | 템플릿 사용 표면(identity.me · tenant scoping · gateway query · AxHubError)은 v6 유지 — 코드 무수정, typecheck 통과로 검증 (2026-07-03) |
| `@ax-hub/sdk` `^6.0.0` → `^6.1.0` (tenants 조회 확장 — orgDirectory·membersDirectory 추가, 87 ops; 코드 무변경으로 install+typecheck 통과 검증 (2026-07-03)) | `nextjs-axhub`, `astro-axhub` | 템플릿 사용 표면 불변 — minor 추가만 |
| `@ax-hub/sdk` `^6.1.0` → `^6.3.0` (backend 8714f5cd 정렬 — notifications·access-requests·gateway fileInvoke·402 `PaymentRequiredError`·deploy warnings, 97 ops; 에러 카탈로그 133) | `nextjs-axhub`, `astro-axhub` | 템플릿 사용 표면 불변(additive minor) — 코드 무변경, install+build 통과로 검증 (2026-07-22) |

## P5 Carve-out 명세

P5 (Convergence) 는 다음에만 적용됩니다:

✅ **자격 모델** (3종 동일):
- axhub 로그인 세션 JWT(`_hub_access`) 사용
- 정적 `APPHUB_API_KEY` / PAT 를 템플릿 앱 코드에 넣지 않음
- owner_id 격리는 backend 가 처리하고 앱 코드는 직접 쓰거나 필터링하지 않음

✅ **템플릿별 호출 표면** (runtime 에 맞게 분리):
- `vite-react-axhub`: browser 전용 `src/lib/axhub.ts` → `axhub.fetch(path, init?)`, `axhub.data(resource, init?)`, `axhub.slug`, `axhub.isConfigured`
- `nextjs-axhub`: server 전용 `lib/axhub-server.ts` → `makeAxhub()`, `makeApp()`, `makeTenant()`, gateway helpers, `table()`
- `astro-axhub`: server 전용 `src/lib/axhub-server.ts` → `makeAxhub(ctx)`, `makeApp(ctx)`, `makeTenant(ctx)`, `table(name, ctx)`

❌ **NOT 적용** — 다음은 구조적 차이, 게으른 분기 아님:
- **인증 transport:** browser(`vite-react`)는 `credentials:"include"` 자동 전송 + 401 silent SSO, server(`nextjs`/`astro`)는 들어온 `_hub_access` 를 SDK JWT 로 전달. (정적 `APPHUB_API_KEY` 폐기 — §부트스트랩 인증·설정)
- **SDK bundling:** `@ax-hub/sdk 6.x` 는 Node/server 템플릿 전용. Vite 정적 SPA 브라우저 번들에는 넣지 않는다.
- **설정 surface:** 1차는 bootstrap 의 `{{...}}` placeholder 치환. 로컬 fallback 은 browser `import.meta.env.VITE_APPHUB_*`, server `process.env.APPHUB_*`(astro 는 `import.meta.env` 우선) — prefix 차이는 빌드 도구 제약(Vite 의 `VITE_` 노출 규칙)에서 옴.
- **파일 경로 컨벤션:** `nextjs-axhub/lib/`, `vite-react-axhub/src/lib/`, `astro-axhub/src/lib/` — 각 framework idiom 존중.

## 재평가 일정

- **2026-Q3:** Vite 8 / Rolldown / react-compiler 생태계 점검 (H2)
- **2026-H2:** TW 4 LLM 밀도 점검 (H1)

## 관련 commits

- `b179733` 직전: 템플릿 초기 ship + verification (당시 6종)
- `11a3a0a`: express/hono/remix 제거 → vite-react / nextjs / astro 3종
- `feat/bootstrap-prep` (spec 299 후속): Dockerfile + axhub.yaml 정리, lib/axhub 인증·설정 정합, 본 ADR 개정
