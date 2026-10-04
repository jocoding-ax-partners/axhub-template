# AI Agents Guide

이 프로젝트의 **모든 AI 에이전트 행동 규칙** 이에요. Claude Code, Codex, 다른 어떤 AI 도구든 이 파일이 source-of-truth.
한국어 vibe coder 가 좋은 결과를 얻도록 설계됐어요.

## axhub 기능은 먼저 AXHUB.md 를 봐요 (에이전트 필수)

사용자가 "파일 올리게 / 알림 보내줘 / 결제 웹훅 받아줘 / 회사 사람만 쓰게 / 도메인 연결 / 이전 버전으로" 처럼 말하면
**직접 만들기 전에 [AXHUB.md](./AXHUB.md) 의 표를 먼저 봐요.** axhub 가 이미 주는 기능(DB · 파일 저장 · 알림/메일 · 웹훅 relay ·
공개 범위·초대 · 스테이징·심사 · 커스텀 도메인 · 로그 · 되돌리기)은 **설정 + 다시 배포** 로 켜고, 새 서비스·패키지로 다시 만들지 않아요.
- `axhub.yaml` 을 바꾸거나(`database:` · `storage:`) env 를 넣는 일, `--execute` 가 붙는 명령은 **사용자에게 먼저 말하고** 해요.
- 메일·알림에 SendGrid 같은 외부 서비스를 붙이지 말고 `createAppMessagingClient()` (이미 설치된 `@ax-hub/sdk`) 를 써요.
- 파일 저장은 `storage: enabled: true` + S3 호환 (`requestChecksumCalculation/responseChecksumValidation: 'WHEN_REQUIRED'` 필수).

## 사용자
비전공자 한국인 vibe coder. 한국어로 답해요. 코드 용어는 풀어서 설명해요. 결과는 화면으로 확인.

## 디자인 — 토큰과 레이아웃 (에이전트 필수)

이 템플릿은 axhub 콘솔과 같은 디자인 토큰·레이아웃을 쓰고 있어요. **화면을 만들 때 이 규칙을 지켜야 앱들이 같은 모양으로 보여요.**

### 색·크기는 항상 토큰으로

- ❌ `#2d64fa`, `bg-[#eee]`, `text-[15px]`, `text-gray-500`, `bg-white`
- ✅ `var(--primary)`, `text-muted`, `bg-content`, `border-default`, `rounded-card`, `.ax-small`
- 이유: 다크 모드가 토큰 값만 바꿔서 동작해요. 생값을 쓰면 그 부분만 색이 안 따라가요.
- 예외가 꼭 필요하면 같은 줄에 `design-token-allow` 주석을 답니다.
- `bash scripts/check-design.sh` 가 위반을 잡아요. 배포 전에 자동으로 돌아요.

### 회색 바탕 위 흰 카드

내용은 `.ax-card` 안에 넣어요. 이게 axhub 의 기본 모양이에요. 카드 밖에 글씨를 그냥 얹지 마세요.

### 페이지 모양

```
<div class="ax-stack">                     세로 40px 간격
  <div class="ax-page-header">             제목 + 오른쪽 액션
    <div>
      <h1 class="ax-page-title">제목</h1>
      <p class="ax-page-desc">한 줄 설명</p>
    </div>
    <a class="ax-btn ax-btn-ghost">버튼</a>
  </div>
  <section class="ax-card"> … </section>
</div>
```

바깥 여백과 최대 폭은 셸이 이미 잡았어요. 페이지가 또 붙이지 마세요.

### 쓸 수 있는 조각

`.ax-card` `.ax-card-title` `.ax-card-desc` `.ax-section-title` `.ax-btn`(`.ax-btn-primary` / `.ax-btn-ghost` / `.ax-btn-sm`) `.ax-input` `.ax-tag` `.ax-dot` `.ax-check` `.ax-empty` `.ax-grid`(`.ax-grid-3`) `.ax-muted` `.ax-subtle` `.ax-small` `.ax-caption` `.ax-done`

Tailwind 는 배치(flex·grid·gap·mt)에 쓰고, 색과 크기는 위 조각이나 토큰 클래스를 쓰세요.

### 건드리지 않는 파일

- `app/tokens.css` — 자동 생성이에요. 고치려면 axhub-template 레포의 `design/tokens.css` 를 고치고 `node scripts/sync-design.mjs` 를 돌려요.
- `components/AppShell.tsx · components/Nav.tsx` — 앱 전체 뼈대예요. 내용만 그 안에 넣어요.

### 화면·메뉴 추가

- 새 화면은 셸 안에 내용만 넣어요.
- 사이드바 메뉴는 `config/navigation.ts` 배열에 한 줄 추가해요.
- 상단바·사이드바는 이미 제자리에 고정돼 있고(`position: sticky`) 페이지 전체가 스크롤돼요. 화면 안에 `h-screen`·`overflow-auto` 로 스크롤 상자를 따로 만들지 마세요 — 스크롤이 두 겹이 돼요.
- 좁은 화면 메뉴(서랍)는 `components/Nav.tsx` 의 `MobileNav` 예요. 메뉴 항목은 사이드바와 같은 `config/navigation.ts` 를 써요.
- 없는 주소는 `app/not-found.tsx`, 화면 오류는 `app/error.tsx` 가 보여줘요. 데이터가 없을 때는 `notFound()` 를 불러요.

## 이 템플릿 = AI 챗봇

사용자는 "말투를 바꿔줘 / 우리 회사 규정만 답하게 해줘 / 대화 저장되게" 처럼 **결과만** 말해요. 고칠 곳은 정해져 있어요.

| 요청 | 고칠 곳 |
|---|---|
| 이름·인사·예시 질문·역할·말투·금지 주제 | `config/assistant.ts` 만 |
| 화면 뼈대·대화 상태(보내기·다시 생성·멈추기·대화 목록) | `components/chat/ChatApp.tsx` |
| 말 한 줄(말풍선·마크다운·복사·코드 복사) | `components/chat/Message.tsx` |
| 입력창(자동 높이·Enter/Shift+Enter) | `components/chat/Composer.tsx` |
| 스크롤 규칙(맨 아래 따라가기·아래로 버튼) | `components/chat/MessageList.tsx` |
| 사이드바(새 대화·지난 대화·다른 화면 메뉴·로그인) | `components/chat/Sidebar.tsx` |
| 크기·간격·고정 배치 | `app/chat.css` |
| 브라우저 저장(localStorage)·스트림 읽기 | `lib/chat-client.ts` |
| 모델·답 길이·Claude 옵션 | `app/api/chat/route.ts` (모델 기본값은 `lib/ai.ts`, 바꿀 땐 env `AI_MODEL` 우선) |

### C1. Claude 는 서버에서만
- `@anthropic-ai/sdk` 와 `lib/ai.ts` 는 Route Handler·Server Component·Server Action 에서만 import 해요.
- ❌ `"use client"` 파일에서 import — API 키가 브라우저 번들로 새요.
- 키는 코드에 적지 않아요. 로컬은 `.env.local`, 배포는 아래 D5 대로 `axhub env set ANTHROPIC_API_KEY --secret`.
- `ANTHROPIC_API_KEY` 는 `axhub.yaml` 에 **optional** 로 선언돼 있어요. required 로 바꾸지 마세요 — 키 없이 첫 배포가 막혀요.

### C1-A. 키는 두 가지 — 기본은 Anthropic 키, AXRouter 는 선택
| | 기본 ① Anthropic 키 | 선택 ② 회사 AXRouter |
|---|---|---|
| 키 | `sk-ant-…` (console.anthropic.com) | `ax-…` (`axhub axrouter keys issue --name "내 챗봇"`) |
| 넣는 변수 | `ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` + `ANTHROPIC_BASE_URL=https://axrouter.ai` |
| 비용·관리 | 키 주인 Anthropic 계정 | 회사 AXRouter 한도·가드레일, 사용량은 관리자 콘솔 |
| 코드 차이 | 없음 | 없음 — SDK 가 `ANTHROPIC_BASE_URL` 을 알아서 읽어요 |

- **AXRouter 란** axhub 의 회사 AI 통로예요. 회사가 등록한 공급사 키(BYOK)로 대신 호출하고, 누가 얼마나 썼는지·한도·허용 모델·민감정보 탐지를 관리자 콘솔(AXRouter 메뉴)에서 모아 봐요. 회사 관리자가 AXRouter 를 켜고 Anthropic 공급사 키를 연결해 둬야 쓸 수 있어요.
- **발급:** `axhub axrouter keys issue --name "<이름>" [--purpose "<용도>"] [--tenant <회사 슬러그>]` — 키 값은 이때 한 번만 보여요. 목록 `axhub axrouter keys list`, 폐기 `axhub axrouter keys revoke <key_id> --execute`. 관리자 콘솔 › AXRouter › API 키 에서도 발급돼요.
- **배포 앱에 넣기:** `ANTHROPIC_API_KEY` 는 `--secret`, `ANTHROPIC_BASE_URL` 은 평문으로 `axhub env set` 후 재배포.
- **거절되면:** AXRouter 가드레일이 모델을 허용하지 않거나 한도를 넘으면 403/429 가 나요. 코드를 고치지 말고 관리자에게 허용 모델·한도를 확인하게 하거나 `AI_MODEL` 을 허용된 모델로 바꿔요.
- 사용자가 AXRouter 를 원한다고 말하기 전에는 ② 로 바꾸지 마세요. 기본은 ① 이에요.

### C2. 모델·옵션
- 모델 이름은 `lib/ai.ts` 의 `AI_MODEL` 하나로만 정해요 (env `AI_MODEL`, 기본 `claude-sonnet-5-5`). 다른 곳에 모델 이름을 박지 마세요.
- `route.ts` 는 Opus·Sonnet 5.5 계열에 `fallbacks: "default"` (거절 시 다른 모델로 자동 재답) 와 `effort: "low"` (빠른 답) 를 붙여요. Haiku 는 effort 를 받지 않아 빠져요.
- `temperature`·`top_p`·`budget_tokens` 는 최신 모델에서 400 오류예요. 넣지 마세요.
- 오류는 `instanceof Anthropic.AuthenticationError` 처럼 **종류로** 나눠요. 메시지 문자열 비교 금지.

### C3. 대화 저장하기 — 여러 기기에서 이어 보기 (요청이 있을 때만)
기본은 이 브라우저의 localStorage 예요 (`lib/chat-client.ts`, 로그인한 사람마다 따로). DB 는 기본으로 꺼져 있어요.
"다른 컴퓨터에서도 내 대화가 보이게" 같은 요청이 오면 **아래 한 가지 방식으로만** 옮겨요. 화면(`components/chat/*`)은 고치지 않아요.

**① DB 켜기** — README "DB 켜기" 순서 그대로. 로컬은 `npm run db:up` + `.env.local` 의 `DATABASE_URL` 주석 해제,
배포는 `axhub.yaml` 의 `database:` 두 줄 주석 해제 후 재배포. 사용자에게 이 두 가지를 해야 한다고 먼저 알려요.

**② 테이블 하나** — `lib/db.ts` 의 `ensureSchema()` 에 추가. 대화 한 개 = 한 줄, 말 목록은 `turns` 에 브라우저 모양 그대로(JSON).
```sql
CREATE TABLE IF NOT EXISTS chat_conversations (
  id         text PRIMARY KEY,               -- 브라우저가 만든 대화 id 그대로
  user_key   text NOT NULL,                  -- 대화 주인 (me().user_id)
  title      text NOT NULL,
  turns      jsonb NOT NULL,                 -- Turn[] (lib/chat-client.ts)
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_conversations_user ON chat_conversations (user_key, updated_at DESC);
```

**③ API 하나 — `app/api/conversations/route.ts`** (서버 전용)
- 주인 판정: `const v = await me()` → `isAxhubConfigured()` 가 false(로컬)면 `'local-dev'`, 배포에서 `v.authenticated` 가 false 면 **401** (익명 대화를 한 통에 섞지 않게), 아니면 `v.user_id`.
- `GET` → 내 대화 목록 `SELECT id, title, turns, updated_at FROM chat_conversations WHERE user_key = ${key} ORDER BY updated_at DESC LIMIT 50`
- `PUT` (body = Conversation 하나) → `INSERT … ON CONFLICT (id) DO UPDATE SET title=…, turns=…, updated_at=now() WHERE chat_conversations.user_key = ${key}` (남의 대화 id 로 덮어쓰기 방지)
- `DELETE ?id=` → `DELETE FROM chat_conversations WHERE id = ${id} AND user_key = ${key}`
- 모든 쿼리는 `db()` tagged-template, 첫 호출 전에 `await ensureSchema()`.

**④ 브라우저 쪽은 `lib/chat-client.ts` 의 두 함수만 바꿔요**
- `loadConversations` → `GET /api/conversations` (async 로 바뀌니 `ChatApp.tsx` 의 첫 `useEffect` 에서 `await` 해서 `setConversations`)
- `saveConversations` → 바뀐 대화만 `PUT` (지금처럼 잠깐 멈췄을 때 한 번 — 답을 받는 중 조각마다 보내지 않기), 삭제는 `DELETE`
- 실패해도 대화는 계속되게 try/catch, 화면에는 "저장하지 못했어요" 정도만.

**⑤ 확인** — 로컬에서 대화 → 새로고침 → 남아 있음, `npm run db:psql` 로 `SELECT id, title FROM chat_conversations;` 에 보임. 배포 뒤엔 다른 브라우저로 로그인해서 같은 대화가 보이는지.

### C4. 자료를 근거로 답하게 하기
- 짧은 규정·FAQ 는 `systemPrompt` 에 그대로 붙이면 돼요 (수십 쪽 이내).
- 길면 파일을 `data/` 폴더에 두고 `route.ts` 에서 읽어 system 에 붙여요. 같은 자료를 매번 보내면 `cache_control: { type: 'ephemeral' }` 로 캐시해 비용을 줄여요.

## Stack
Claude (`@anthropic-ai/sdk`, `lib/ai.ts`) · 마크다운 렌더 (`react-markdown` + `remark-gfm`) ·
Next.js 16 (App Router · RSC · Server Actions) · React 19 · TypeScript strict · Tailwind 3 · Node 20+ ·
**데이터는 표준 PostgreSQL** (`lib/db.ts`, `DATABASE_URL`) · **인증/식별 · 외부 connector 는 `@ax-hub/sdk 6.x`** (`lib/axhub-server.ts`).

## 5가지 Vibe Coder 프로토콜 (모든 작업에 적용)

1. **Plan first** — 다단계 작업 시작 전, 한국어로 한 줄 plan 보여줘요.
   예: "1. `lib/db.ts` 에 테이블 추가 → 2. `app/page.tsx` 에서 조회·표시 → 3. 결과 확인". 사용자 OK 후 코드.
2. **Verify-then-claim** — UI 변경 후 "되긴 해요" / "should work" 만으로 끝 금지.
   정확히 어디 접속해서 무엇이 보여야 하는지 알려줘요.
   예: "http://localhost:3000 새로고침 → '내 할 일' 카드에 방금 추가한 항목이 보여야 해요. 안 보이면 알려주세요."
   사용자 확인 전엔 "완료" 표시 금지.
3. **No unprompted refactor** — X 요청에 Y / Z 같이 "개선" 금지. 변경한 모든 line 이 X 와 직접 관련.
4. **Honest failure** — 못 만들면 plainly 말해요. "아직 안 풀렸어요. 시도: A, B. 모름: C." 가짜 성공 보고 금지.
5. **Ask before install** — 작은 utility 라도 npm install 전에 "X 추가해도 될까요? 이유: Y" 한 번 물어봐요.
   (단, `@ax-hub/sdk` · `postgres` · `@anthropic-ai/sdk` · `react-markdown` · `remark-gfm` 은 이미 설치돼 있으니 다시 설치 금지.)

## 데이터 = 표준 PostgreSQL (`lib/db.ts`)

> 사용자는 "대화 저장되게 / 주문 목록 보여줘" 처럼 **결과만** 말해요. 이 앱의 데이터는 이 앱 전용
> **PostgreSQL** 에 저장해요 — `lib/db.ts` 가 단일 진입점이에요. 평범한 SQL 을 쓰면 돼요(특별한 API 없음).

### D1. read/write 는 `lib/db.ts` 의 `db()` 로 — 평범한 SQL
```ts
import { db, ensureSchema } from '@/lib/db'
await ensureSchema()                                  // 첫 read/write 전에 한 번 (테이블 정의는 lib/db.ts 에)
// 값은 tagged-template 으로 — 자동 바인딩되어 SQL injection 안전. 문자열 이어붙이기 금지.
await db()`INSERT INTO todos (user_key, title) VALUES (${userKey}, ${title})`
const rows = await db()<{ id: string; title: string }[]>`
  SELECT id::text, title FROM todos WHERE user_key = ${userKey} ORDER BY id DESC LIMIT 50`
```

### D2. 테이블은 `ensureSchema()` 에 `CREATE TABLE IF NOT EXISTS` 로
- 새 테이블/컬럼이 필요하면 `lib/db.ts` 의 `ensureSchema()` 안에 `CREATE TABLE IF NOT EXISTS ...`
  (또는 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) 한 줄을 추가. 별도 마이그레이션 도구 불필요.
- `id`/`created_at` 같은 컬럼도 직접 SQL 로 선언 (자동 추가 같은 마법 없음 — 평범한 Postgres).

### D3. 사용자별 데이터 → `user_key` 컬럼 + 로그인 사용자
- **자동 격리는 없어요.** 자기 데이터만 보이게 하려면 테이블에 `user_key text` 컬럼을 두고,
  모든 쿼리를 `WHERE user_key = ${userKey}` 로 직접 필터해요.
- 로그인 사용자는 `const visitor = await me()` (`@/lib/axhub-server`, 문이 넘긴 `X-AxHub-*` 헤더) → `visitor.email`(또는 `user_id`)을 `user_key` 로. `visitor.authenticated=false` 는 오류가 아니라 익명(정상) — 로그인 버튼(`await loginUrl('/')`)을 보여줘요. `sdk.identity.me()` 로 방문자를 알아내지 마세요 — 퍼블릭·커스텀 도메인에선 401.
  배포 시엔 실제 로그인 사용자, 로컬 단독 실행 땐 `'local-dev'` 로 폴백 (예: `app/page.tsx` 의 `currentUserKey()`).

### D4. 로컬은 docker, 배포는 axhub 가 주입
- **로컬**: `npm run db:up` 으로 Postgres 를 띄우고 `.env.local` 의 `DATABASE_URL` 사용.
  DB 조작은 npm 스크립트 우선 — `db:up` / `db:down`(데이터 유지) / `db:reset`(초기화) / `db:psql`(콘솔).
  최초 세팅은 `npm run setup` (`.env.local` 없으면 예시 복사 + DB 기동).
- **배포**: `axhub.yaml` 의 `database: { engine: postgres }` 선언으로 axhub 가 이 앱 전용 DB 를 발급하고
  `DATABASE_URL` / `DIRECT_DATABASE_URL` 을 자동 주입해요. `isDbConfigured()` 가 false 면 아직 로컬 DB 미설정.

### D5. 코드가 secret(API 키 등)을 쓰면 → axhub env 에 등록 (배포 필수)
`.env.local` 만 채우면 **로컬만** 돌아가요. 배포 환경엔 그 값이 없어 런타임에 `env: <KEY> not found` 로 깨져요.
1. `axhub.yaml` 의 `env` 에 **이름과 scope 만** 선언 (값은 적지 않음). `scope` 는 `build`/`runtime`/`both`:
   ```yaml
   env:
     required:
       - { name: OPENAI_API_KEY, scope: runtime }
   ```
2. 값은 CLI 로 등록 (값은 stdin 으로만 — 명령행 노출 방지):
   ```bash
   printf %s "$OPENAI_API_KEY" | axhub env set OPENAI_API_KEY --app <APP_SLUG> --secret --from-stdin --stage runtime --json
   ```
- `DATABASE_URL` / `DIRECT_DATABASE_URL` 은 DB 를 켜고 배포하면 axhub 가 **자동 주입** — 직접 등록 불필요.
- `APPHUB_*` 는 axhub 가 앱을 만들 때(bootstrap) 코드의 `{{...}}` 자리에 미리 채워요. 템플릿을 직접 내려받아 올린 앱만 `axhub env set` 으로 넣어요.
- 값을 넣거나 바꾼 뒤엔 **다시 배포해야** 적용돼요. `NEXT_PUBLIC_` 로 시작하는 값은 브라우저에 보이니 비밀값에 쓰지 않아요.

## SDK 사용 프로토콜 (인증/식별 · 외부 connector)

> 이 템플릿에서 `@ax-hub/sdk 6.x` 는 **인증/식별**과 **외부 connector(gateway)** 호출에 써요. (앱 데이터는 위 PostgreSQL.)
> 방문자 신원은 `lib/axhub-server.ts` 의 `me()` (문이 넘긴 헤더). 허브 SDK 가 필요한 gateway 는 `makeAxhub()` factory 가 사용자 자격을 처리하되 **회사 앱 주소에서만** 동작해요. raw `fetch()` 로 `api.axhub.ai` 직접 호출 금지.

### S1. 진입점은 factory 만 — 모듈 레벨 클라이언트 금지
- ✅ 매 호출마다 `const sdk = await makeAxhub()`.
- ❌ 파일 최상단에 `const sdk = new AxHubClient({...})` 캐싱 — 사용자 자격이 다음 요청에 누설돼요.
- 이유: 들어온 요청의 `_hub_access` 쿠키마다 다른 사용자. SDK 인스턴스는 그 요청 안에서만 유효.

### S2. 슬러그 하드코딩 금지 — helper / 상수 사용
- ✅ tenant 만 필요하면 `const t = await makeTenant()` → `t.apps.list()`.
- ❌ `sdk.tenant('my-tenant')` 처럼 슬러그 문자열 박지 마요 — `lib/axhub-server.ts` 의 `TENANT`/`APP_SLUG` 상수가 환경별로 달라요.
- ❌ flat 호출 (`sdk.apps.create(...)` 같이 tenant 스코프 없이) 금지 — `TenantSlugRequiredError`. (단, `sdk.identity.*` 는 tenant 불필요 — 예외.)

### S3. 서버 전용 — 클라이언트 컴포넌트에서 import 금지
- ✅ `app/page.tsx`, `app/api/.../route.ts`, Server Action 안에서만 `lib/axhub-server.ts` / `lib/db.ts` import.
- ❌ `"use client"` 컴포넌트에서 `me` / `makeAxhub` / `db` import — `next/headers` · DB 드라이버는 server-only 라 빌드 깨져요.
- 클라이언트에서 백엔드가 필요하면 Route Handler (`app/api/.../route.ts`) 또는 Server Action 거치게.

### S4. 에러는 `error.code` / `instanceof` 로 분기 — 메시지 문자열 매칭 금지
- ✅ `if (err instanceof AxHubError && err.code === 'slug_taken')`.
- ❌ `if (err.message.includes('이미 존재'))` — 백엔드 메시지는 변경 가능, machine-readable 한 건 `code`/`category` 뿐.
- 자주 쓰는 클래스: `ValidationError`, `UnauthenticatedError`, `PermissionDeniedError`, `NotFoundError`, `ConflictError`, `AxHubError`(catch-all).
- DB(`lib/db.ts`) 호출은 표준 postgres 에러를 던져요 — try/catch 로 감싸요.

### S5. Gateway query — 외부 DB/SaaS 조회는 `queryConnector()` 로
> **이 기능은 핵심.** 외부 시스템(자체 PostgreSQL/MySQL/SaaS connector) 데이터를 안전하게 읽어요.
> 모든 호출은 audit log 에 기록되고 connector 권한 정책으로 게이트돼요. 직접 DB 접속 금지.
> (이 앱 자체의 데이터 저장과는 별개 — 그건 위 `lib/db.ts` PostgreSQL.)

> ⚠️ **gateway 는 tenant 경로에 UUID 를 요구해요 (slug 거부 → 400 invalid_format).** slug 기반 `makeTenant()` 로는 안 돼요.
> `lib/axhub-server.ts` 의 `makeGateway()` (me() 로 tenant UUID 자동 스코프) / `queryConnector()` 를 쓰세요.

#### 기본 사용 — connector "이름" 으로 (UUID 자동 resolve)
```ts
import { queryConnector } from '@/lib/axhub-server'
const res = await queryConnector<{ id: number; name: string }>({
  connector: 'my-db',          // connector 이름 (gateway.me.connectors() 의 .name) — UUID 아님, helper 가 resolve
  sql: 'SELECT id, name FROM public.employees WHERE active = $1 LIMIT $2',  // postgres 네이티브 $n placeholder — '?' 는 백엔드에서 500(internal_error)
  params: [true, 10],          // ✅ 항상 parameterized · $1,$2 순서대로 — SQL injection 방지
})
// res.rows: 컬럼명으로 매핑된 객체 배열 · res.rowCount · res.columns
// 정책 deny 는 in-band 플래그가 아니라 throw — try/catch 로 PermissionDeniedError 분기.
```

> **SDK 6.x gateway 모델:** connector 에 **활성 grant** 가 있어야 **session** 을 열고, SQL 은 그 session 으로 실행해요.
> `queryConnector()` 가 (grant 보유 connector resolve → session open → query → session close) 를 한 번에 감싸요.

#### 저수준 — 직접 session 을 다룰 때
```ts
import { makeGateway } from '@/lib/axhub-server'
const gw = await makeGateway()                       // tenant UUID 로 스코프된 gateway (makeTenant 아님!)
const connectors = await gw.me.connectors()          // 배열 — 내가 grant 가진 connector 만. .find(c => c.name === 'my-db')
const session = await gw.sessions.create({ connectorId: connectors[0].id })  // grant 없으면 NotFoundError
try {
  const res = await gw.query.run({ sessionId: session.id, sql: 'SELECT 1' })
} finally {
  await gw.sessions.end(session.id)                  // 끝나면 반드시 닫기
}
```
- `gw.me.connectors()` / `gw.me.connectorResources(id)` / `gw.me.grants()` 는 **배열** 반환 (member-scoped — 내 grant 기준).
- REST connector 는 `gw.invoke({ sessionId, method, path })` 로 프록시 (SQL 아님).
- connector 등록·관리(create/update/delete)는 콘솔 관리자 작업 — SDK gateway 표면에 없어요.

#### 절대 규칙 (Gateway)
- ✅ **PostgreSQL SQL 테이블명은 스키마 포함 필수** — `FROM schema.table`. `FROM table` 만 쓰면 `AxHubError(internal_error)` 발생.
- ✅ `queryConnector()` 우선 — connector 이름만 넘기면 grant resolve·session 생명주기를 helper 가 처리.
- ✅ **항상 parameterized SQL** — placeholder + `params: [...]`. 사용자 입력을 SQL 문자열에 직접 박지 마요.
- ✅ `connector` / `sql` 은 코드 상수 — 사용자 값은 `params` 로만 (권한 우회·injection 방지).
- ✅ 결과 cap 은 SQL `LIMIT` 로 — gateway 가 무한 결과를 막지 않아요.
- ✅ **정책 deny 는 throw** — `try/catch` 로 `PermissionDeniedError` / `UnauthenticatedError`(session 만료) / `NotFoundError`(grant 없음) 분기.
- ❌ `makeTenant()` (slug) 로 gateway 호출 — **400 invalid_format**. `makeGateway()` / `queryConnector()` 만.
- ❌ connector UUID 하드코딩 — connector 이름으로 넘기면 자동 resolve.
- ❌ session 을 안 닫고 방치 — 저수준 사용 시 `finally` 로 `sessions.end()`. (`queryConnector()` 는 자동.)
- ❌ 모듈-레벨에 gateway 결과·session 캐싱 — 자격·데이터가 사용자별로 달라요.

## Framework-Specific Rules (Next.js)

- `lib/db.ts` · `lib/axhub-server.ts` 는 **Server-side 전용**. `"use client"` 컴포넌트에서 import 금지.
- 새 백엔드/DB 호출은 항상 Server Component · Route Handler (`app/api/.../route.ts`) · Server Action 경유.
- Tailwind class 는 길어도 분리하지 말고 인라인 유지 (vibe coder 가 한 곳에서 다 보는 게 편함).
- 변경 보고: `file:line` 형식.

## 절대 규칙 (negative-phrased)

- DO NOT `lib/db.ts` · `lib/axhub-server.ts`(server 전용)를 `"use client"` 컴포넌트에서 import.
- DO NOT DB 쿼리에 사용자 입력을 문자열로 이어붙이기 — 항상 tagged-template `db()\`... ${value} ...\`` 로 바인딩.
- DO NOT raw `fetch()` 로 `api.axhub.ai` 직접 호출 — 신원은 `me()`, gateway 는 `queryConnector()` 경유.
- DO NOT `/__axhub/auth/*` 경로를 앱 라우트로 사용 — 플랫폼 예약.
- DO NOT 모듈 레벨에 `AxHubClient` 인스턴스를 캐싱 (사용자 자격 누설).
- DO NOT slug/tenant 를 코드에 하드코딩 — `TENANT` / `APP_SLUG` 상수 또는 helper 사용.
- DO NOT `AxHubError.message` 한국어 문자열로 분기 — `code` / `category` / `instanceof` 만.
- DO NOT Gateway `query.run({ sql })` 에 사용자 입력을 그대로 박기 — 항상 `params: [...]` (parameterized SQL).
- DO NOT 사용자 세션 쿠키(`_hub_access`)/토큰을 응답 본문·로그에 노출.
- DO NOT `.env.local` 커밋 (`.gitignore` 막혀있지만 force-add 도 금지).
- DO NOT 사용자 동의 없이 destructive git (`reset --hard`, `push --force`, `branch -D`).
- DO NOT 새 npm 패키지 사용자 확인 없이 설치 (`@ax-hub/sdk` · `postgres` 는 이미 들어가 있어 재설치 금지).
- DO NOT `npm run build`·배포를 사용자가 묻기 전에 실행 (느리고 결과물이 바뀌어요). 고친 뒤 확인용 `npx tsc --noEmit` · `npm run check:design` 은 스스로 돌려도 돼요 — Verify-then-claim 의 일부예요.

## 신뢰 모델 (1-line)

- **데이터**: `lib/db.ts` 의 `db()` / `ensureSchema()` — `DATABASE_URL`(런타임, prepare:false) · `DIRECT_DATABASE_URL`(마이그레이션). 로컬은 docker compose, 배포는 axhub 주입.
- **인증/식별**: `lib/axhub-server.ts` 의 `me()` / `loginUrl()` / `logoutUrl()` — axhub 문이 요청마다 실어 주는 `X-AxHub-*` 헤더를 `headers()` 로 읽어요. 허브에 다시 묻지 않아요. **gateway**: 같은 파일의 `makeAxhub` / `makeTenant` / `makeGateway` / `queryConnector` — 들어온 요청의 `_hub_access` 쿠키를 SDK JWT 로 박아요 (**회사 앱 주소에서만** 동작).

## 빠른 레퍼런스

```ts
// ── 데이터 (표준 PostgreSQL) — Server Component / Route Handler / Server Action 안에서 ──
import { db, ensureSchema } from '@/lib/db'
await ensureSchema()
await db()`INSERT INTO todos (user_key, title) VALUES (${userKey}, ${title})`
const rows = await db()<{ id: string; title: string; done: boolean }[]>`
  SELECT id::text, title, done FROM todos WHERE user_key = ${userKey} ORDER BY id DESC LIMIT 50`

// ── 방문자 신원 (사용자별 데이터의 user_key) ──
import { me, loginUrl, logoutUrl } from '@/lib/axhub-server'
const visitor = await me()            // { authenticated, user_id, email, name, app_role, is_admin, tenant_slug, surface }
// visitor.authenticated=false → 익명(정상): <a href={await loginUrl('/')}>로그인</a>
// 로그아웃: await logoutUrl('/') — 회사 앱이면 null(콘솔 로그아웃 안내)

// ── 조직 구성원 조회 (tenant_member 권한이면 가능, sdk 6.1+) ──
// ⚠️ 사용자 쿠키가 필요해 회사 앱 주소에서만 동작 (gateway 와 같음). 슬러그는 TENANT 상수를 그대로 넘겨요.
import { makeAxhub, TENANT } from '@/lib/axhub-server'
const sdk = await makeAxhub()                         // 요청마다 새로 (모듈 레벨 캐싱 금지)
const org = await sdk.tenants.orgDirectory(TENANT)    // { departments: [{ name, members }], unassigned } — SCIM 조직도, 미가입자는 joined:false
const dir = await sdk.tenants.membersDirectory(TENANT) // { items: [{ userId, name, role, groupId? }], total } — 가입한 활성 멤버 (email 없음)

// ── Gateway · 외부 DB/SaaS connector 조회 (connector 이름으로; helper 가 grant·session·UUID 처리) ──
import { queryConnector } from '@/lib/axhub-server'
const employees = await queryConnector<{ id: number; name: string }>({
  connector: 'my-db',     // connector 이름 (UUID 아님) — 활성 grant 가 있어야 보여요
  sql: 'SELECT id, name FROM public.employees WHERE active = $1 LIMIT $2',  // ⚠️ PostgreSQL: 스키마 포함 + 네이티브 $n placeholder('?' 는 500)
  params: [true, 10],
})
// 정책 deny 는 throw — try/catch 로 PermissionDeniedError 분기 (in-band allowed 플래그 없음)

// ── 에러 처리 ──
import { AxHubError } from '@ax-hub/sdk'
try {
  /* DB 또는 SDK 호출 */
} catch (err) {
  if (err instanceof AxHubError) console.error(err.code, err.category, err.requestId) // SDK(identity/gateway)
  else console.error(err)                                                             // 표준 postgres 에러
}
```

## 배포

`/axhub:deploy` (Claude Code) 또는 `axhub deploy create --app <slug> --execute` (`--execute` 없으면 미리보기). 사용자 명시 요청 후에만. 앱 슬러그는 `axhub apps list`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
