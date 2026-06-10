# AI Agents Guide

이 프로젝트의 **모든 AI 에이전트 행동 규칙** 이에요. Claude Code, Codex, 다른 어떤 AI 도구든 이 파일이 source-of-truth.
한국어 vibe coder 가 좋은 결과를 얻도록 설계됐어요.

## 사용자
비전공자 한국인 vibe coder. 한국어로 답해요. 콘텐츠 사이트 + SSR. 결과는 브라우저로 확인.

## Stack
Astro 5 · @astrojs/node (standalone) · TypeScript · Node 20+ · **@ax-hub/sdk 2.x (서버 호출 전용)**. **SSR.**

## 5가지 Vibe Coder 프로토콜 (모든 작업에 적용)

1. **Plan first** — 다단계 작업 시작 전, 한국어로 한 줄 plan 보여줘요.
   예: "1. `src/pages/blog.astro` 만들기 → 2. frontmatter 에서 makeAxhub/table 호출 → 3. 카드 그리드". 사용자 OK 후 코드.
2. **Verify-then-claim** — 페이지 변경 후 "되긴 해요" / "should work" / "테스트 해보세요" 만으로 끝 금지.
   정확히 어디 접속해서 무엇이 보여야 하는지 알려줘요.
   예: "http://localhost:4321/blog 접속 → 글 카드 N개 보여야 해요. 빈 페이지면 frontmatter 에러 알려주세요."
   사용자 확인 전엔 "완료" 표시 금지.
3. **No unprompted refactor** — X 요청에 Y / Z 같이 "개선" 금지.
4. **Honest failure** — 못 만들면 plainly 말해요. 가짜 성공 보고 금지.
5. **Ask before install** — npm install 전에 한 번 물어봐요.

## axhub 리소스 준비 — 데이터/시크릿 코드를 짜기 *전에* (에이전트 필수)

> 사용자는 "방명록 저장되게 / 글 목록 보여줘 / OpenAI 로 요약" 처럼 **결과만** 말해요.
> axhub 가 제공하는 **동적 DB** 와 **환경변수 주입** 은 사용자가 몰라요 — 에이전트가 코드보다 먼저 처리해야 배포 후에도 동작해요.
> axhub 플러그인이 있으면 `tables` / `env` 스킬이 미리보기+동의까지 대신 처리해요. 아래 CLI 는 그 스킬이 없을 때의 정확한 명령 형태예요.

### R1. 저장/조회/기록 요청 → 동적 테이블부터 (코드보다 먼저)
데이터를 담을 테이블이 backend 에 **먼저 있어야** 해요. 없으면 코드가 404/400 으로 깨져요.
1. 확인: `axhub tables list --app <APP_SLUG> --json`
2. 없으면 생성. **사용자마다 자기 데이터만 보는 경우(대부분) → `owner_id` 컬럼 + `--owner-column owner_id`**:
   ```bash
   # id · created_at · updated_at 은 자동 추가 — 선언하지 마세요. 정수는 integer 아닌 int.
   axhub tables create guestbook --app <APP_SLUG> \
     --column 'owner_id:text' --column 'message:text' \
     --owner-column owner_id --execute --json
   ```

### R2. owner_id 격리는 backend 몫 — 코드에서 owner_id 를 만지지 마세요
- POST insert 시 `owner_id` 를 **직접 넣지 마세요**. 로그인 사용자로 backend 가 자동 설정해요.
- GET 은 **본인 행만** 자동 반환돼요. owner_id 필터를 직접 걸지 마세요.
- 모두가 공유하는 공용 테이블은 owner_column 없이 만들되, 그땐 조회에 **필터가 반드시** 있어야 해요 (owner 도 필터도 없으면 400).

### R3. 데이터 호출은 SDK 2.x + 로그인 세션 쿠키 ctx 안에서만
- read/write 는 **로그인한 사용자의 세션 쿠키**로 인증돼요. 비로그인 호출은 401.
- Astro 는 전역 `cookies()` 가 없어서, **호출마다 ctx 로 쿠키를 넘겨야** 인증돼요:
  ```ts
  import { where } from '@ax-hub/sdk'
  import { table } from '../lib/axhub-server'

  const ctx = { cookie: Astro.request.headers.get('cookie') }
  const guestbook = await table<{ id: string; message: string; created_at: string }>('guestbook', ctx)
  // owner-scoped 테이블(owner_column)은 무필터 list 가 내 행만 자동 반환 (SDK ≥2.1.2).
  // non-owner-scoped 테이블은 최소 1개 where 필수 (mass-scan guard — ValidationError(code: 'where_required'))
  const page = await guestbook.list({ where: where('created_at').gte('1970-01-01T00:00:00Z'), limit: 20 })  // 내 행만 자동 반환
  await guestbook.insert({ message: '안녕' })              // owner_id 는 backend 가 자동
  ```
- 사용자/테넌트 정보나 일반 Hub API 는 `makeAxhub(ctx)` / `makeApp(ctx)` 로 호출해요.
- frontmatter · `src/pages/api/*.ts` 안에서만 (Framework-Specific 참조). `<script>` 태그(브라우저)에서 호출 금지.

### R4. 코드가 secret(API 키 등)을 쓰면 → axhub env 에 등록 (배포 필수)
`.env` 만 채우면 **로컬만** 돌아가요. 배포 환경엔 그 값이 없어 배포 preflight 가 막히거나 런타임에 `env: <KEY> not found` 로 깨져요.
1. `axhub.yaml` 의 `env` 에 **이름과 scope 만** 선언 (값은 적지 않음). `scope` 는 `build` / `runtime` / `both` — 런타임에 쓰는 API 키는 `runtime`:
   ```yaml
   env:
     required:
       - { name: OPENAI_API_KEY, scope: runtime }
   ```
2. 값은 CLI 로 등록 (콘솔도 되지만 CLI 권장 · 값은 stdin 으로만 — 명령행 노출 방지). `--stage` 는 위 `scope` 와 같은 값:
   ```bash
   printf %s "$OPENAI_API_KEY" | axhub env set OPENAI_API_KEY --app <APP_SLUG> --secret --from-stdin --stage runtime --json
   ```
- `APPHUB_API_URL` / `APPHUB_APP_SLUG` / `APPHUB_TENANT` 는 axhub 가 **자동 주입**해요 — 직접 등록 불필요. 소스에 `{{...}}` 가 그대로 보이거나 `isAxhubConfigured()` 가 false 면 아직 미배포/미설정 상태이니, 코드를 깨지 말고 그 사실을 사용자에게 알려요.

## Framework-Specific Rules (Astro 5 SSR)

- `astro.config.ts` 의 `output: "server"` + `adapter: node({ mode: "standalone" })` **절대 바꾸지 마요**. 이게 axhub 배포 핵심.
- `src/lib/axhub-server.ts` 는 **frontmatter / API endpoint (`src/pages/api/*.ts`) / `getStaticPaths` 안에서만** import. `<script>` 태그 안 호출 금지. `src/lib/axhub.ts` 는 호환 re-export 뿐이므로 새 코드는 `axhub-server` 를 직접 import.
- `.astro` 한 파일에 frontmatter + 템플릿 + scoped style 같이 두는 게 컨벤션. 분리 금지.
- React/Vue 가 정말 필요한 경우만 island 추가 (`npm i @astrojs/react`). 기본은 `.astro`.
- 변경 보고: `file:line` 형식.

## 절대 규칙 (negative-phrased)

- DO NOT `output: "server"` 또는 `adapter: node({ mode: "standalone" })` 변경.
- DO NOT `axhub-server.ts` 또는 `axhub.ts` 를 `<script>` 태그 안에서 import.
- DO NOT `.env` 커밋.
- DO NOT 사용자 동의 없이 destructive git.
- DO NOT 새 npm 패키지 사용자 확인 없이 설치.

## axhub.ts 신뢰 모델 (1-line)

이 (Astro) 템플릿은 **server-side** (frontmatter 는 빌드/요청 시 서버에서 실행). Hub 호출은 `src/lib/axhub-server.ts` 의 `@ax-hub/sdk 2.x` factory(`makeAxhub` / `makeApp` / `table`)만 믿어요.
인증: 호출 시 넘긴 `Astro.request` 쿠키에서 `_hub_access` 를 꺼내 SDK JWT 로 전달하고, SDK 가 `Authorization: Bearer` 로 처리해요. 정적 API key 안 씀. `src/lib/axhub.ts` 는 호환 re-export 이며 새 코드는 `axhub-server` 를 직접 import. 풀 비교 표는 [axhub-template README](../README.md#axhubts-신뢰-모델-3종-공통) 참고.

## 배포

`/axhub:deploy` 또는 `axhub deploy create --app <slug> --branch main`. 빌드는 repo 의 `Dockerfile`(`node ./dist/server/entry.mjs`, PORT=3000)로 떠요.
