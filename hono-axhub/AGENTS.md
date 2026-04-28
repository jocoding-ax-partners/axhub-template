# AI Agents Guide

이 프로젝트의 **모든 AI 에이전트 행동 규칙** 이에요. Claude Code, Codex, 다른 어떤 AI 도구든 이 파일이 source-of-truth.
한국어 vibe coder 가 좋은 결과를 얻도록 설계됐어요.

## 사용자
비전공자 한국인 vibe coder. 한국어로 답해요. 가벼운 API 서버. 결과는 curl 또는 브라우저로 확인.

## Stack
Hono 4 · @hono/node-server · TypeScript strict · Node 20+. **NodeNext ESM.**

## 5가지 Vibe Coder 프로토콜 (모든 작업에 적용)

1. **Plan first** — 다단계 작업 시작 전, 한국어로 한 줄 plan 보여줘요.
   예: "1. `src/index.ts` 에 POST /api/feedback 추가 → 2. 검증 → 3. axhub.data 호출 → 4. 응답". 사용자 OK 후 코드.
2. **Verify-then-claim** — endpoint 추가 후 "되긴 해요" / "should work" / "테스트 해보세요" 만으로 끝 금지.
   정확히 어떤 curl 로 어떤 응답이 와야 하는지 알려줘요.
   예: "`curl localhost:3000/api/health` → `{ok:true, slug}` 받아야 해요. 다르면 알려주세요."
   사용자 확인 전엔 "완료" 표시 금지.
3. **No unprompted refactor** — X 요청에 Y / Z 같이 "개선" 금지.
4. **Honest failure** — 못 만들면 plainly 말해요. 가짜 성공 보고 금지.
5. **Ask before install** — npm install 전에 한 번 물어봐요.

## Framework-Specific Rules (Hono + Node)

- import 경로엔 **`.js` 확장자** 붙여요 (NodeNext ESM 컨벤션). 예: `import { axhub } from "./lib/axhub.js";`
- 새 라우트는 `src/index.ts` 직접 수정. 폴더 분리 금지 (한 파일에서 다 보는 게 vibe coder 에 좋음).
- 입력 검증 — `c.req.json()` 결과를 그대로 `axhub.data` 에 흘리지 마요. 최소 필드 / 길이 체크.
- 변경 보고: `file:line` 형식.

## 절대 규칙 (negative-phrased)

- DO NOT `APPHUB_API_KEY` 를 응답 본문 / 로그 / stack trace 어디에도 노출.
- DO NOT import 경로에서 `.js` 확장자 빼기 (NodeNext 가 깨져요).
- DO NOT `.env` 커밋.
- DO NOT 사용자 동의 없이 destructive git.
- DO NOT 새 npm 패키지 사용자 확인 없이 설치.
- DO NOT 입력 검증 없이 endpoint 출시.

## axhub.ts 신뢰 모델 (1-line)

이 (Hono) 템플릿은 **server-side**. axhub 헬퍼 = `axhub.fetch/data/slug/isConfigured` (6개 템플릿 동일 외부 API).
Transport: `Authorization: Bearer ${process.env.APPHUB_API_KEY}` from server.
이 템플릿은 `vite-react-axhub` / `nextjs-axhub` 같은 SPA / SSR 클라이언트의 **가벼운 backend 역할** 로 자주 쓰여요. 풀 비교 표는 [examples README](../README.md#axhubts-신뢰-모델-모든-템플릿) 참고.

## 배포

`/axhub:deploy` 또는 `axhub deploy create --app <slug> --branch main`. health_path = `/api/health` (apphub.yaml).
