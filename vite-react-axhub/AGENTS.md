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

## Framework-Specific Rules (Vite + React, 정적 SPA)

- `VITE_*` 환경변수에 시크릿 (API_KEY 등) **절대 금지**. 빌드 결과물에 그대로 박혀서 누구나 봐요.
- 인증 필요한 axhub 호출은 **별도 backend** (`express-axhub` 또는 `hono-axhub`) 두고 거기서 처리. 같은 도메인 reverse proxy.
- 변경 보고: `file:line` 형식.

## 절대 규칙 (negative-phrased)

- DO NOT 시크릿을 `VITE_*` 환경변수로 넣기 (빌드 결과물 노출).
- DO NOT `.env.local` 커밋.
- DO NOT 사용자 동의 없이 destructive git.
- DO NOT 새 npm 패키지 사용자 확인 없이 설치.
- DO NOT 빌드/타입/린트 명령 사용자가 묻기 전에 실행.

## axhub.ts 신뢰 모델 (1-line)

이 (Vite + React) 템플릿은 **browser-side**. axhub 헬퍼 = `axhub.fetch/data/slug/isConfigured` (6개 템플릿 동일 외부 API).
Transport: `credentials: "include"` (cookie auth), **API_KEY 미주입**. 풀 비교 표는 [examples README](../README.md#axhubts-신뢰-모델-모든-템플릿) 참고.

## 배포

`/axhub:deploy` 또는 `axhub deploy create --app <slug> --branch main`. 빌드된 `dist/` 가 nginx 정적 서빙.
