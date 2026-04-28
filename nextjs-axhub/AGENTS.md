# AI Agents Guide

이 프로젝트의 **모든 AI 에이전트 행동 규칙** 이에요. Claude Code, Codex, 다른 어떤 AI 도구든 이 파일이 source-of-truth.
한국어 vibe coder 가 좋은 결과를 얻도록 설계됐어요.

## 사용자
비전공자 한국인 vibe coder. 한국어로 답해요. 코드 용어는 풀어서 설명해요. 결과는 화면으로 확인.

## Stack
Next.js 16 (App Router · RSC · Server Actions) · React 19 · TypeScript strict · Tailwind 3 · Node 20+.

## 5가지 Vibe Coder 프로토콜 (모든 작업에 적용)

1. **Plan first** — 다단계 작업 시작 전, 한국어로 한 줄 plan 보여줘요.
   예: "1. `app/page.tsx` 수정 → 2. axhub.fetch 추가 → 3. 결과 카드 render". 사용자 OK 후 코드.
2. **Verify-then-claim** — UI 변경 후 "되긴 해요" / "should work" / "테스트 해보세요" 만으로 끝 금지.
   정확히 어디 클릭/접속해서 무엇이 보여야 하는지 알려줘요.
   예: "http://localhost:3000 새로고침 → '안녕 axhub' + 파란 버튼 보여야 해요. 안 보이면 알려주세요."
   사용자 확인 전엔 "완료" 표시 금지.
3. **No unprompted refactor** — X 요청에 Y / Z 같이 "개선" 금지. 변경한 모든 line 이 X 와 직접 관련.
   추가로 할 일은 한국어로 적어두고 사용자가 결정.
4. **Honest failure** — 못 만들면 plainly 말해요. "아직 안 풀렸어요. 시도: A, B. 모름: C." 가짜 진행/성공 보고 금지.
5. **Ask before install** — 작은 utility 라도 npm install 전에 "X 추가해도 될까요? 이유: Y" 한 번 물어봐요.

## Framework-Specific Rules (Next.js)

- `lib/axhub.ts` 는 **Server-side 전용**. `"use client"` 컴포넌트에서 import 금지 (`APPHUB_API_KEY` 가 브라우저로 새요).
- 새 axhub API 호출은 항상 Route Handler (`app/api/.../route.ts`) 또는 Server Action 경유.
- Tailwind class 는 길어도 분리하지 말고 인라인 유지 (vibe coder 가 한 곳에서 다 보는 게 편함).
- 변경 보고: `file:line` 형식.

## 절대 규칙 (negative-phrased)

- DO NOT `APPHUB_API_KEY` 를 클라이언트 컴포넌트 / 응답 본문 / 로그 어디에도 노출.
- DO NOT `.env.local` 커밋 (`.gitignore` 막혀있지만 force-add 도 금지).
- DO NOT 사용자 동의 없이 destructive git (`reset --hard`, `push --force`, `branch -D`).
- DO NOT 새 npm 패키지 사용자 확인 없이 설치.
- DO NOT 빌드/타입/린트 명령 사용자가 묻기 전에 실행.

## axhub.ts 신뢰 모델 (1-line)

이 (Next.js) 템플릿은 **server-side**. axhub 헬퍼 = `axhub.fetch/data/slug/isConfigured` (6개 템플릿 동일 외부 API).
Transport: `Authorization: Bearer ${process.env.APPHUB_API_KEY}` from server. 풀 비교 표는 [examples README](../README.md#axhubts-신뢰-모델-모든-템플릿) 참고.

## 배포

`/axhub:deploy` (Claude Code) 또는 `axhub deploy create --app <slug> --branch main`. 사용자 명시 요청 후에만.
