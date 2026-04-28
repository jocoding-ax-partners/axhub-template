# AI Agents Guide

이 프로젝트의 **모든 AI 에이전트 행동 규칙** 이에요. Claude Code, Codex, 다른 어떤 AI 도구든 이 파일이 source-of-truth.
한국어 vibe coder 가 좋은 결과를 얻도록 설계됐어요.

## 사용자
비전공자 한국인 vibe coder. 한국어로 답해요. 콘텐츠 사이트 + SSR. 결과는 브라우저로 확인.

## Stack
Astro 5 · @astrojs/node (standalone) · TypeScript · Node 20+. **SSR.**

## 5가지 Vibe Coder 프로토콜 (모든 작업에 적용)

1. **Plan first** — 다단계 작업 시작 전, 한국어로 한 줄 plan 보여줘요.
   예: "1. `src/pages/blog.astro` 만들기 → 2. frontmatter 에서 axhub.fetch → 3. 카드 그리드". 사용자 OK 후 코드.
2. **Verify-then-claim** — 페이지 변경 후 "되긴 해요" / "should work" / "테스트 해보세요" 만으로 끝 금지.
   정확히 어디 접속해서 무엇이 보여야 하는지 알려줘요.
   예: "http://localhost:4321/blog 접속 → 글 카드 N개 보여야 해요. 빈 페이지면 frontmatter 에러 알려주세요."
   사용자 확인 전엔 "완료" 표시 금지.
3. **No unprompted refactor** — X 요청에 Y / Z 같이 "개선" 금지.
4. **Honest failure** — 못 만들면 plainly 말해요. 가짜 성공 보고 금지.
5. **Ask before install** — npm install 전에 한 번 물어봐요.

## Framework-Specific Rules (Astro 5 SSR)

- `astro.config.ts` 의 `output: "server"` + `adapter: node({ mode: "standalone" })` **절대 바꾸지 마요**. 이게 axhub 배포 핵심.
- `src/lib/axhub.ts` 는 **frontmatter / API endpoint (`src/pages/api/*.ts`) / `getStaticPaths` 안에서만** 호출. `<script>` 태그 안 호출 금지.
- `.astro` 한 파일에 frontmatter + 템플릿 + scoped style 같이 두는 게 컨벤션. 분리 금지.
- React/Vue 가 정말 필요한 경우만 island 추가 (`npm i @astrojs/react`). 기본은 `.astro`.
- 변경 보고: `file:line` 형식.

## 절대 규칙 (negative-phrased)

- DO NOT `output: "server"` 또는 `adapter: node({ mode: "standalone" })` 변경.
- DO NOT `axhub.ts` 를 `<script>` 태그 안에서 import.
- DO NOT `.env` 커밋.
- DO NOT 사용자 동의 없이 destructive git.
- DO NOT 새 npm 패키지 사용자 확인 없이 설치.

## axhub.ts 신뢰 모델 (1-line)

이 (Astro) 템플릿은 **server-side** (frontmatter 는 빌드/요청 시 서버에서 실행). axhub 헬퍼 = `axhub.fetch/data/slug/isConfigured` (6개 템플릿 동일 외부 API).
Transport: `Authorization: Bearer ${process.env.APPHUB_API_KEY}`. 풀 비교 표는 [examples README](../README.md#axhubts-신뢰-모델-모든-템플릿) 참고.

## 배포

`/axhub:deploy` 또는 `axhub deploy create --app <slug> --branch main`. `apphub.yaml` 의 `start` 가 `npm start` 인지 확인.
