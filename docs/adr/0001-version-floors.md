# ADR-0001: 2026 BP 버전 홀드백 + 명명된 unblock 드라이버

**상태:** Accepted (2026-04-28) · 개정 (2026-05-20 — 템플릿 3종 정리 + 부트스트랩 인증·설정 모델 반영)
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
5. **Convergence** — **carve-out: 외부 API 표면(`axhub.fetch/data/slug/isConfigured`) 에만 적용. 자격(사용자 세션 JWT)은 3종 통일하되 전송 방식(browser 자동 쿠키 vs SSR 쿠키 포워딩)은 구조적 차이라 carve-out** (§부트스트랩 인증·설정).

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
- **nextjs / astro (server):** 진입 시 ingress L2 게이트가 이미 인증 + `X-AxHub-*` 헤더 주입(식별용, `/me` 호출 0). data 호출은 들어온 요청의 `_hub_access` 를 백엔드에 `Authorization: Bearer` 로 **포워딩**. (Next: `next/headers` `cookies()`, Astro: 호출 시 `Astro.request` 쿠키 전달.) 401 → server-side redirect.

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

## P5 Carve-out 명세

P5 (Convergence) 는 다음에만 적용됩니다:

✅ **외부 API 표면** (3종 동일):
- `axhub.fetch(path, init?)` → `Promise<Response>`
- `axhub.data(resource, init?)` → `Promise<Response>`
- `axhub.slug` → `string`
- `axhub.isConfigured` → `boolean`

(server 템플릿은 사용자 쿠키 포워딩용 인자를 추가로 받음 — Next 는 `init.cookie`/`cookies()`, Astro 는 3번째 `ctx` 인자. 표면 시그니처는 유지하되 framework idiom 으로 확장.)

❌ **NOT 적용** — 다음은 구조적 차이, 게으른 분기 아님:
- **인증 transport:** 자격은 사용자 세션 JWT(`_hub_access`)로 통일하되, browser(`vite-react`)는 `credentials:"include"` 자동 전송 + 401 silent SSO, server(`nextjs`/`astro`)는 들어온 `_hub_access` 를 `Bearer` 로 포워딩. (정적 `APPHUB_API_KEY` 폐기 — §부트스트랩 인증·설정)
- **설정 surface:** 1차는 bootstrap 의 `{{...}}` placeholder 치환. 로컬 fallback 은 browser `import.meta.env.VITE_APPHUB_*`, server `process.env.APPHUB_*`(astro 는 `import.meta.env` 우선) — prefix 차이는 빌드 도구 제약(Vite 의 `VITE_` 노출 규칙)에서 옴.
- **파일 경로 컨벤션:** `nextjs-axhub/lib/`, `vite-react-axhub/src/lib/`, `astro-axhub/src/lib/` — 각 framework idiom 존중.

## 재평가 일정

- **2026-Q3:** Vite 8 / Rolldown / react-compiler 생태계 점검 (H2)
- **2026-H2:** TW 4 LLM 밀도 점검 (H1)

## 관련 commits

- `b179733` 직전: 템플릿 초기 ship + verification (당시 6종)
- `11a3a0a`: express/hono/remix 제거 → vite-react / nextjs / astro 3종
- `feat/bootstrap-prep` (spec 299 후속): Dockerfile + axhub.yaml 정리, lib/axhub 인증·설정 정합, 본 ADR 개정
