# AI Agents Guide

이 프로젝트의 **모든 AI 에이전트 행동 규칙** 이에요. Claude Code, Codex, 다른 어떤 AI 도구든 이 파일이 source-of-truth.
한국어 vibe coder 가 좋은 결과를 얻도록 설계됐어요.

## 사용자
비전공자 한국인 vibe coder. 한국어로 답해요. SSR 풀스택. 결과는 브라우저로 확인.

## Stack
Remix 2 (Vite-based) · React 18 · TypeScript strict · Node 20+. **SSR (서버 렌더링).**

## 5가지 Vibe Coder 프로토콜 (모든 작업에 적용)

1. **Plan first** — 다단계 작업 시작 전, 한국어로 한 줄 plan 보여줘요.
   예: "1. `app/routes/users.tsx` loader 추가 → 2. axhub.fetch → 3. useLoaderData 로 카드 render". 사용자 OK 후 코드.
2. **Verify-then-claim** — UI / loader / action 변경 후 "되긴 해요" / "should work" / "테스트 해보세요" 만으로 끝 금지.
   정확히 어디 클릭/접속해서 무엇이 보여야 하는지 알려줘요.
   예: "http://localhost:5173/users 접속 → 사용자 카드 N개 보여야 해요. 안 보이면 콘솔 에러 알려주세요."
   사용자 확인 전엔 "완료" 표시 금지.
3. **No unprompted refactor** — X 요청에 Y / Z 같이 "개선" 금지.
4. **Honest failure** — 못 만들면 plainly 말해요. 가짜 성공 보고 금지.
5. **Ask before install** — npm install 전에 한 번 물어봐요.

## Framework-Specific Rules (Remix 2 SSR)

- `app/lib/axhub.server.ts` 의 `.server.ts` 접미사 **절대 떼지 마요**. 클라이언트 번들 노출 위험.
- `axhub` 헬퍼는 **loader / action 안에서만** 호출. 컴포넌트 함수 본문 호출 금지.
- 폼은 **`<Form>` (Remix 컴포넌트) 우선**. SPA 처럼 `fetch` + `useState` 로 폼 처리하지 마요.
- 새 기능은 가능하면 한 라우트 파일에 loader + action + 컴포넌트 모두 (Remix 의 강점).
- 변경 보고: `file:line` 형식.

## 절대 규칙 (negative-phrased)

- DO NOT `axhub.server.ts` 를 컴포넌트 함수 본문에서 import (loader/action 만).
- DO NOT `.server.ts` 접미사 제거.
- DO NOT `.env` 커밋.
- DO NOT 사용자 동의 없이 destructive git.
- DO NOT 새 npm 패키지 사용자 확인 없이 설치.
- DO NOT `<Form>` 대신 `fetch` + `setState` 로 폼 처리 (Remix idiom 깨짐).

## axhub.ts 신뢰 모델 (1-line)

이 (Remix) 템플릿은 **server-side**. axhub 헬퍼 = `axhub.fetch/data/slug/isConfigured` (6개 템플릿 동일 외부 API).
Transport: `Authorization: Bearer ${process.env.APPHUB_API_KEY}` from server. 풀 비교 표는 [examples README](../README.md#axhubts-신뢰-모델-모든-템플릿) 참고.

## 배포

`/axhub:deploy` 또는 `axhub deploy create --app <slug> --branch main`. `apphub.yaml` 의 `start` 가 `npm start` (remix-serve) 인지 확인.
