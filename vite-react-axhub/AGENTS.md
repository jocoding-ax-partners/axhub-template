# AI Agents Guide

이 프로젝트의 **모든 AI 에이전트 행동 규칙** 이에요. Claude Code, Codex, 다른 어떤 AI 도구든 이 파일이 source-of-truth.
한국어 vibe coder 가 좋은 결과를 얻도록 설계됐어요.

## 사용자
비전공자 한국인 vibe coder. 한국어로 답해요. 결과는 브라우저로 확인.

## Stack
Vite 7 · React 19 · TypeScript strict · Tailwind 3 · Node 20.19+ . **정적 SPA (브라우저 only).**

## 5가지 Vibe Coder 프로토콜 (모든 작업에 적용)

1. **Plan first** — 다단계 작업 시작 전, 한국어로 한 줄 plan 보여줘요.
   예: "1. `src/App.tsx` 수정 → 2. axhub.data 호출 → 3. 카드 그리드 render". 사용자 OK 후 코드.
2. **Verify-then-claim** — UI 변경 후 "되긴 해요" / "should work" / "테스트 해보세요" 만으로 끝 금지.
   정확히 어디 클릭/접속해서 무엇이 보여야 하는지 알려줘요.
   예: "http://localhost:5173 새로고침 → 카드 3개 보여야 해요. 빈 화면이면 콘솔 에러 알려주세요."
   사용자 확인 전엔 "완료" 표시 금지.
3. **No unprompted refactor** — X 요청에 Y / Z 같이 "개선" 금지. 변경한 모든 line 이 X 와 직접 관련.
4. **Honest failure** — 못 만들면 plainly 말해요. 가짜 진행/성공 보고 금지.
5. **Ask before install** — 작은 utility 라도 npm install 전에 "X 추가해도 될까요? 이유: Y" 한 번 물어봐요.

## axhub 리소스 준비 — 데이터/시크릿 코드를 짜기 *전에* (에이전트 필수)

> 사용자는 "할 일 저장되게 / 목록 보여줘" 처럼 **결과만** 말해요.
> axhub 가 제공하는 **동적 DB** 와 **환경변수 주입** 은 사용자가 몰라요 — 에이전트가 코드보다 먼저 처리해야 배포 후에도 동작해요.
> axhub 플러그인이 있으면 `tables` / `env` 스킬이 미리보기+동의까지 대신 처리해요. 아래 CLI 는 그 스킬이 없을 때의 정확한 명령 형태예요.

### R1. 저장/조회/기록 요청 → 동적 테이블부터 (코드보다 먼저)
데이터를 담을 테이블이 backend 에 **먼저 있어야** 해요. 없으면 코드가 404/400 으로 깨져요.
1. 확인: `axhub tables list --app <APP_SLUG> --json`
2. 없으면 생성. **사용자마다 자기 데이터만 보는 경우(대부분) → `owner_id` 컬럼 + `--owner-column owner_id`**:
   ```bash
   # id · created_at · updated_at 은 자동 추가 — 선언하지 마세요. 정수는 integer 아닌 int.
   axhub tables create todos --app <APP_SLUG> \
     --column 'owner_id:text' --column 'title:text' --column 'done:text' \
     --owner-column owner_id --execute --json
   ```

### R2. owner_id 격리는 backend 몫 — 코드에서 owner_id 를 만지지 마세요
- POST insert 시 `owner_id` 를 **직접 넣지 마세요**. 로그인 사용자로 backend 가 자동 설정해요.
- GET 은 **본인 행만** 자동 반환돼요. owner_id 필터를 직접 걸지 마세요.
- 모두가 공유하는 공용 테이블은 owner_column 없이 만들되, 그땐 조회에 **필터가 반드시** 있어야 해요 (owner 도 필터도 없으면 400).

### R3. 데이터 호출엔 로그인 세션이 필요해요 (브라우저에서 직접)
- `axhub.data(...)` 가 `credentials:"include"` 로 로그인 세션 쿠키(`_hub_access`)를 자동 전송해요. 비로그인/만료면 401 → 헬퍼가 silent SSO 로 자동 재인증(`APP_ORIGIN` 필요). 별도 backend 불필요.
- 데이터는 컴포넌트에서 `axhub.data()` 로 바로 호출하면 돼요:
  ```ts
  const list = await (await axhub.data('todos')).json()                            // 내 행만
  await axhub.data('todos', { method: 'POST', body: JSON.stringify({ title: '할 일', done: 'false' }) })
  ```

### R4. 🔴 이 템플릿(정적 SPA)은 secret 을 담을 수 없어요
- `VITE_*` 는 빌드 결과물(브라우저 번들)에 그대로 박혀 **누구나 봐요**. OpenAI 키 같은 secret 절대 금지 (절대 규칙에도 명시).
- secret 으로 외부 API(OpenAI 등)를 호출해야 하면 브라우저에선 안전하게 못 해요:
  - → **서버 템플릿(`nextjs-axhub` / `astro-axhub`)** 으로 만들어요. 거기선 `axhub env set` 으로 키를 서버에만 두고 호출해요.
  - 외부 **DB/SaaS 데이터를 읽는** 거라면 axhub **gateway connector** 로 우회 (자격은 connector 에 보관, 앱은 정책 게이트된 조회만).
- 환경변수 주입: `VITE_APPHUB_*` 는 axhub 가 **빌드 시 자동 주입**(scope: build)해요. 소스에 `{{...}}` 가 그대로거나 `axhub.isConfigured()` 가 false 면 미배포/미설정 상태이니, 코드를 깨지 말고 사용자에게 알려요.

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

이 (Vite + React) 템플릿은 **browser-side**. axhub 헬퍼 = `axhub.fetch/data/slug/isConfigured` (3종 동일 외부 API).
인증: `credentials: "include"` 로 axhub 세션 쿠키(`_hub_access`) 자동 전송 + 401 시 silent SSO 재인증. **시크릿 키 미주입.** 풀 비교 표는 [axhub-template README](../README.md#axhubts-신뢰-모델-3종-공통) 참고.

## 배포

`/axhub:deploy` 또는 `axhub deploy create --app <slug> --branch main`. 빌드된 `dist/` 가 nginx 정적 서빙.
