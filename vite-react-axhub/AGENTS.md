# AI Agents Guide

이 프로젝트의 **모든 AI 에이전트 행동 규칙** 이에요. Claude Code, Codex, 다른 어떤 AI 도구든 이 파일이 source-of-truth.
한국어 vibe coder 가 좋은 결과를 얻도록 설계됐어요.

## 사용자
비전공자 한국인 vibe coder. 한국어로 답해요. 결과는 브라우저로 확인.

## Stack
Vite 7 · React 19 · TypeScript strict · Tailwind 3 · Node 20.19+ . **정적 SPA (브라우저 only).**

## 5가지 Vibe Coder 프로토콜 (모든 작업에 적용)

1. **Plan first** — 다단계 작업 시작 전, 한국어로 한 줄 plan 보여줘요.
   예: "1. `src/App.tsx` 수정 → 2. axhub.fetch('/api/v1/me') 호출 → 3. 환영 카드 render". 사용자 OK 후 코드.
2. **Verify-then-claim** — UI 변경 후 "되긴 해요" / "should work" / "테스트 해보세요" 만으로 끝 금지.
   정확히 어디 클릭/접속해서 무엇이 보여야 하는지 알려줘요.
   예: "http://localhost:5173 새로고침 → 카드 3개 보여야 해요. 빈 화면이면 콘솔 에러 알려주세요."
   사용자 확인 전엔 "완료" 표시 금지.
3. **No unprompted refactor** — X 요청에 Y / Z 같이 "개선" 금지. 변경한 모든 line 이 X 와 직접 관련.
4. **Honest failure** — 못 만들면 plainly 말해요. 가짜 진행/성공 보고 금지.
5. **Ask before install** — 작은 utility 라도 npm install 전에 "X 추가해도 될까요? 이유: Y" 한 번 물어봐요.

## 인증/식별 — 로그인한 사용자 보여주기 (에이전트 필수)

> 사용자는 "로그인한 사람 환영 메시지 / 내 이름 보여줘" 처럼 **결과만** 말해요.
> 이 템플릿이 제공하는 건 **인증/식별**(누가 로그인했는지)이에요 — 별도 backend 없이 브라우저에서 바로 돼요.

### 로그인 사용자 정보는 `axhub.fetch('/api/v1/me')` 로 (브라우저에서 직접)
- 이 템플릿은 **브라우저 전용 세션 fetch 헬퍼**만 사용해요. 서버용 Node SDK 를 클라이언트 번들에 넣지 마세요.
- `axhub.fetch(...)` 가 `credentials:"include"` 로 로그인 세션 쿠키(`_hub_access`)를 자동 전송해요. 비로그인/만료면 401 → 헬퍼가 silent SSO 로 자동 재인증(`APP_ORIGIN` 필요). 별도 backend 불필요.
  ```ts
  const me = await (await axhub.fetch('/api/v1/me')).json() // { user, tenants }
  ```

## 데이터 — 이 템플릿(정적 SPA)은 자체 DB 가 없어요

> 이 템플릿은 **정적 SPA**(브라우저 전용, 서버 프로세스 없음)예요. 서버가 없어 DB 시크릿(`DATABASE_URL`)을 쥘 수 없으니 **자체 데이터베이스가 없어요**.

- "할 일 저장되게 / 목록 보여줘" 처럼 **데이터 저장/조회**가 필요하면 → **서버 템플릿(`nextjs-axhub` / `astro-axhub`)** 으로 만들어요. 거기선 표준 **Postgres**(`DATABASE_URL`)를 써요.
- 외부 **DB/SaaS 데이터를 읽는** 거라면 → 서버 템플릿에서 axhub **gateway connector** 로 우회해요 (자격은 connector 에 보관, 앱은 정책 게이트된 조회만). 정적 SPA 에선 안전하게 못 해요.

### 🔴 이 템플릿(정적 SPA)은 secret 을 담을 수 없어요
- `VITE_*` 는 빌드 결과물(브라우저 번들)에 그대로 박혀 **누구나 봐요**. OpenAI 키 같은 secret 절대 금지 (절대 규칙에도 명시).
- secret 으로 외부 API(OpenAI 등)를 호출해야 하면 브라우저에선 안전하게 못 해요 → **서버 템플릿(`nextjs-axhub` / `astro-axhub`)** 으로 만들어요. 거기선 `axhub env set` 으로 키를 서버에만 두고 호출해요.
- 환경변수 주입: `VITE_APPHUB_*` 는 axhub 가 **빌드 시 자동 주입**(scope: build)해요. 소스에 `{{...}}` 가 그대로거나 `axhub.isConfigured` 가 false 면 미배포/미설정 상태이니, 코드를 깨지 말고 사용자에게 알려요.

## Framework-Specific Rules (Vite + React, 정적 SPA)

- `VITE_*` 환경변수에 시크릿 (API_KEY 등) **절대 금지**. 빌드 결과물에 그대로 박혀서 누구나 봐요.
- 인증된 axhub 호출은 `axhub` 헬퍼로 **직접** 해요 — `credentials:"include"` 가 로그인 세션 쿠키(`_hub_access`)를 보내고, 401 이면 헬퍼가 silent SSO 로 재인증. 별도 backend 불필요.
- 변경 보고: `file:line` 형식.

## 절대 규칙 (negative-phrased)

- DO NOT 시크릿을 `VITE_*` 환경변수로 넣기 (빌드 결과물 노출).
- DO NOT `.env.local` 커밋.
- DO NOT 사용자 동의 없이 destructive git.
- DO NOT 새 npm 패키지 사용자 확인 없이 설치.
- DO NOT 빌드/타입/린트 명령 사용자가 묻기 전에 실행.

## axhub.ts 신뢰 모델 (1-line)

이 (Vite + React) 템플릿은 **browser-side**. axhub 헬퍼 = **브라우저 전용 세션 fetch 헬퍼** `axhub.fetch/slug/isConfigured`. **자체 DB 없음(정적 SPA)** — 데이터가 필요하면 서버 템플릿(nextjs/astro, 표준 Postgres)을 써요.
인증: `credentials: "include"` 로 axhub 세션 쿠키(`_hub_access`) 자동 전송 + 401 시 silent SSO 재인증. **시크릿 키 미주입.** 풀 비교 표는 [axhub-template README](../README.md#axhubts-신뢰-모델-3종-공통) 참고.

## 배포

`/axhub:deploy` 또는 `axhub deploy create --app <slug> --branch main`. 빌드된 `dist/` 가 nginx 정적 서빙.
