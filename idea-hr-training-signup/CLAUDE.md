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

## 이 앱 (사내 교육 신청)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/training.ts` | 순수 규칙 — 관리자 판단 `isManager`, 신청 버튼 상태 `signupState`(started > mine > full > open), 입력 검사 `validateTraining`, KST 일시 변환(`parseKstInput` · `toKstInput` · `formatWhen`), CSV(`toCsv`: BOM + 수식 막기) |
| `lib/training-store.ts` | DB 읽기·쓰기 전부. 목록은 30개씩 쪽 나눔 + `?q=` 검색. 신청 · 취소 · 수정은 트랜잭션 + 교육 줄 `FOR UPDATE` 로 정원을 다시 확인해요 |
| `lib/db.ts` | `ensureSchema()` 에 `trainings` · `training_signups` 표 (CREATE TABLE IF NOT EXISTS, advisory lock 767021) |
| `app/actions.ts` | Server Action `signUp` · `cancelSignup` · `saveTraining`(등록·수정) · `deleteTraining` — 로그인·관리자·입력을 서버에서 다시 확인하고 `{ ok, message, fieldErrors }` 를 돌려줘요 |
| `app/page.tsx` | 교육 신청 (다가오는 교육 · 검색 · 신청/취소) |
| `app/mine/page.tsx` | 내 신청 (다가오는 것 먼저, 지난 교육은 뒤) |
| `app/admin/page.tsx` | 교육 관리 (등록 폼 · 전체 목록 · 검색) |
| `app/admin/[id]/page.tsx` | 교육 한 건 (신청 현황 · 명단 검색 · 정보 수정 · 지우기) |
| `app/admin/[id]/roster.csv/route.ts` | 신청자 명단 CSV (관리자만, 403) |
| `components/forms.tsx` | 브라우저 폼 — `TrainingForm` · `SignupButton` · `DeleteTrainingButton` (useActionState · 확인 창 `useConfirm` · `toast`) |
| `components/TrainingCard.tsx` | 직원 화면의 교육 카드 |
| `components/Notices.tsx` · `Pager.tsx` · `SearchForm.tsx` | 로그인 안내 · DB 미연결 · 관리자 전용 안내 · 이전/다음 쪽 · 검색 줄 |
| `scripts/training-check.mjs` | `npm run check:logic` — `lib/training.ts` 를 바꾸면 돌려요 |

- **관리자 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). `lib/training.ts` 의 `isManager()` 한 곳에서만 판단해요. 다른 사람에게 이 앱만의 관리 권한을 주는 법은 README "관리자는 누구인가요".
- **데이터 모델**:
  `trainings(id, title, description, starts_at timestamptz, location, capacity int>0, created_by, created_at, updated_at)`,
  `training_signups(training_id → trainings ON DELETE CASCADE, user_key=axhub user_id, user_name, user_email, created_at, PK(training_id, user_key))`.
  신청 인원 = `training_signups` 줄 수 (저장된 카운터 없음). 취소 = 줄 삭제.
- 신청 · 취소는 `starts_at` 이 지나면 서버에서 막아요. 정원 확인은 반드시 교육 줄을 `FOR UPDATE` 로 잠근 뒤 세요 (동시 신청 대비).
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 일시 입력(`datetime-local`)은 시간대가 없어서 늘 한국 시간으로 읽어요(`parseKstInput`). 표시는 `formatWhen` / `formatDateTime` (KST).
