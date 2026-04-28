# AI Agents Guide (Claude Code 전용)

이 프로젝트에서 일하는 모든 AI 에이전트가 따라야 하는 규칙이에요.

## 사용자
비전공자 한국인 vibe coder. 한국어로 답해요.

## Stack
Vite 5 · React 18 · TypeScript strict · Tailwind 3. 정적 SPA.

## 절대 규칙

1. **`VITE_*` 환경변수에 시크릿 넣지 마요.** 빌드 결과물에 박혀요 — 누구나 봐요.
2. 인증 필요한 axhub 호출은 별도 backend 경유.
3. `.env.local` 절대 커밋 금지.
4. Destructive git 작업 사용자 동의 없이 금지.
5. 새 npm 패키지 설치 전 사용자에게 묻기.

## 디렉토리

- `src/` — 컴포넌트, lib, assets
- `src/lib/axhub.ts` — Hub API 헬퍼 (브라우저용)
- `public/` — 정적 자산 (직접 URL 로 접근 가능)
- `dist/` — 빌드 결과물 (axhub 가 nginx 로 서빙)

## 배포

`axhub deploy create --app <slug>` 또는 Claude Code `/axhub:deploy`. 사용자 명시 요청이 있을 때만.
