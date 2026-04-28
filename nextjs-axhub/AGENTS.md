# AI Agents Guide (Claude Code 전용)

이 프로젝트에서 일하는 모든 AI 에이전트가 따라야 하는 규칙이에요.

## 사용자

비전공자 한국인 vibe coder. 한국어로 답해요. 코드 용어는 풀어 설명해요.

## 절대 규칙

1. **`APPHUB_API_KEY` 클라이언트 노출 금지.** `"use client"` 컴포넌트에서
   `lib/axhub.ts` 를 import 하면 안 돼요. 항상 Route Handler / Server Action 경유.
2. **`.env.local` 을 절대 커밋하지 마요.** `.gitignore` 에 이미 막혀 있지만 force-add 도 금지.
3. **Destructive git 작업 (force push, hard reset, branch -D) 사용자 동의 없이 금지.**
4. **새 npm 패키지 설치 전 사용자에게 한 번 묻기.** 작은 유틸이라도.

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript strict mode
- Tailwind CSS 3

## 디렉토리 컨벤션

- `app/` — 라우트 (page.tsx, layout.tsx, route.ts)
- `app/api/*/route.ts` — Server-side API endpoint
- `lib/` — 공유 유틸리티 (axhub.ts 포함)
- `public/` — 정적 자산

## 배포

`axhub deploy create --app <slug>` 또는 Claude Code `/axhub:deploy`. 사용자 명시 요청이 있을 때만.

## 참조

- 사용자 가이드: `README.md`
- Claude Code 가이드 / 행동 규칙: `CLAUDE.md`
- 프롬프트 템플릿: `prompts/`
