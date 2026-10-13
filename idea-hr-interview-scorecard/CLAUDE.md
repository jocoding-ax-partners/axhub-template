# Claude Code 가이드

이 프로젝트의 행동 규칙은 모두 [AGENTS.md](./AGENTS.md) 에 있어요.
**먼저 AGENTS.md 를 읽고 그 규칙을 따라요.** Claude Code 든 Codex 든 동일한 규칙이에요.

## 화면을 만들기 전에 (요약 — 자세히는 AGENTS.md 「디자인」)

- 컴포넌트는 `@heroui/react` **v3** 에서 가져와요. v2 문법(`HeroUIProvider`, `@heroui/button`, `CardBody`, `onClick`)은 틀려요 — `Card.Header`, `onPress`.
- 이 프로젝트는 `@jocoding-ax-partners/design-system`(CSS 전용, HeroUI 를 콘솔처럼 칠함)을 써요.
  UI 코드를 쓰기 전에 `node_modules/@jocoding-ax-partners/design-system/llms.txt` 를 읽어요.
- 확인창 `useConfirm`, `PageHeader`, `StatusDot`, `CodeBlock` 은 `@/components/ax` 에서 (= `@jocoding-ax-partners/react`).
- 아이콘은 `@phosphor-icons/react` (서버 파일은 `@phosphor-icons/react/ssr`).
- 색·글자는 의미 토큰만: `bg-content` `text-muted` `border-default` `t-small` … — #hex · `text-[15px]` · `text-gray-500` 금지.
- 다른 UI 라이브러리는 설치하지 않아요. 고친 뒤 `npm run check:design` 으로 확인해요.

## 이 앱 (면접 일정·평가표)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/interview.ts` | 순수 규칙 — 평가 항목 `CRITERIA`(1~5점), 결과 이름, 채용 담당자 판단 `isRecruiter`, 입력 검사 `validateCandidate` · `validateScore`, KST 시각 변환·표시 |
| `lib/interview-store.ts` | DB 읽기·쓰기 전부. 평가 저장·지원자 수정은 트랜잭션 + 지원자 줄 잠금(FOR UPDATE)으로 결과 기록과 엇갈리지 않게 해요 |
| `lib/db.ts` | `ensureSchema()` 에 `candidates` · `scorecards` 표 (CREATE TABLE IF NOT EXISTS) |
| `app/actions.ts` | Server Action `createCandidate` · `updateCandidate` · `deleteCandidate` · `recordResult`(채용 담당자) · `submitScorecard`(배정된 면접관) — 로그인·권한·입력을 서버에서 다시 확인 |
| `app/page.tsx` | 내 면접 (평가 현황 · 배정된 면접 목록) |
| `app/interviews/[id]/page.tsx` | 평가표 — 배정된 면접관만, 아니면 404. 결과가 기록되면 읽기 전용 |
| `app/candidates/page.tsx` | 지원자 관리 (등록 폼 · 검색 `?q=` · 결과 거르기 `?result=` · 30개씩 쪽 나눔) |
| `app/candidates/[id]/page.tsx` | 지원자 상세 (평균 · 면접관 의견 · 결과 기록 · 정보 수정 · 삭제) |
| `components/Forms.tsx` | 브라우저 폼 — HeroUI 입력 · 확인 창(`useConfirm`) · 결과 알림(`toast`) / 오류(`Alert`) |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 · 채용 담당자 전용 안내 · DB 미연결 경고 · 이전/다음 쪽 링크(검색어·거르기 유지) |
| `scripts/interview-check.mjs` | `npm run check:logic` — `lib/interview.ts` 를 바꾸면 돌려요 |

- **채용 담당자 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). `lib/interview.ts` 의 `isRecruiter()` 한 곳에서만 판단해요.
  **면접관 = 지원자의 `interviewers` 배열에 로그인 이메일(소문자)이 있는 사람.** 면접관은 다른 면접관의 평가를 볼 수 없어요 (상세는 채용 담당자 전용).
- **데이터 모델**:
  `candidates(id, name, position, interview_at timestamptz, interviewers text[] 1~10개 소문자 이메일, result pass|hold|fail|NULL, result_by, result_at, created_by, created_at)`,
  `scorecards(candidate_id → candidates ON DELETE CASCADE, interviewer_email, interviewer_name, job_skill, communication, culture_fit smallint 1~5, comment, created_at, updated_at, PK(candidate_id, interviewer_email))`.
  평균은 저장하지 않고 scorecards 에서 계산해요 (종합 = 세 항목 평균).
- 규칙: 결과가 기록된 지원자는 평가 저장을 서버에서 거절해요. 평가를 낸 면접관은 `updateCandidate` 가 빼지 못하게 막아요.
- 평가 항목을 늘리려면 `CRITERIA` 에 한 줄 + `ensureSchema()` 에 `ALTER TABLE scorecards ADD COLUMN IF NOT EXISTS … smallint CHECK (… BETWEEN 1 AND 5)` + store 의 SELECT/INSERT 를 같이 고쳐요.
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 면접 일시는 화면에서 KST 로 고른 값(`datetime-local`)을 `parseKstLocal()` 로 시각으로 바꿔 저장하고, `formatDateTime()` 으로 KST 표시해요.
