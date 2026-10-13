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

## 이 앱 (부서 예산 현황)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/budget.ts` | 순수 규칙 — 강조 기준 `WARN_RATE`(90%), 집행률 `usageRate` · `isWarn`, 금액·연도 파싱, 입력 검사(`validateExpense` 등), 관리자 판정 `isBudgetAdmin`, KST 날짜·원 표시 |
| `lib/budget-store.ts` | DB 읽기·쓰기 전부. 현황·합계 집계, 집행 건 입력(권한·그해 예산 확인), 부서·예산·담당자 관리 |
| `lib/db.ts` | `ensureSchema()` 에 표 4개 (CREATE TABLE IF NOT EXISTS, `pg_advisory_lock(767016)` 아래) |
| `app/actions.ts` | Server Action — 집행 건 넣기·지우기, 부서 추가·삭제, 예산 저장, 담당자 지정·해제. 로그인·관리자·입력을 서버에서 다시 확인 |
| `app/page.tsx` | 예산 현황 (연도별 합계 카드 · 부서별 표 · 부서 검색) |
| `app/expenses/page.tsx` | 집행 내역 (입력 폼 · 그해 집행 목록 · 검색 · 지우기) |
| `app/admin/page.tsx` | 부서 · 예산 관리 (부서 추가 · 연간 예산 · 담당자). 관리자가 아니면 안내만 보여요 |
| `components/StatusTable.tsx` | 현황 표 — 넓은 화면은 `<table>`, 좁은 화면은 목록. 90% 이상 강조 |
| `components/ExpenseForm.tsx` · `ActionForm.tsx` · `ConfirmButton.tsx` | 브라우저 폼 — HeroUI 입력, 결과 알림(`toast`) / 오류(`Alert`), 지우기 전 확인 창(`useConfirm`) |
| `components/YearNav.tsx` · `SearchForm.tsx` · `Pager.tsx` · `Notices.tsx` | 연도 이동 · 검색칸 · 이전/다음 쪽(연도·검색어 유지) · 로그인 안내/DB 미연결 경고 |
| `scripts/budget-check.mjs` | `npm run check:logic` — `lib/budget.ts` 를 바꾸면 돌려요 |

- **관리자 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). `lib/budget.ts` 의 `isBudgetAdmin()` 한 곳에서만 판단해요.
- **부서 담당자** = 관리자가 부서에 지정한 이메일(소문자). 로그인한 사람의 `me().email` 과 같으면 그 부서 집행 건을 넣을 수 있어요. 관리자는 모든 부서에 넣을 수 있어요.
- **데이터 모델**
  - `departments(id, name, created_at)` — 이름은 `lower(name)` 유일.
  - `department_managers(department_id → departments ON DELETE CASCADE, email, created_at)` — PK (department_id, email).
  - `budgets(department_id → departments ON DELETE CASCADE, year, amount bigint ≥ 0, updated_by, updated_at)` — PK (department_id, year). 다시 저장하면 금액을 고쳐요.
  - `expenses(id, department_id → departments ON DELETE RESTRICT, spent_on date, description, amount bigint > 0, user_key=axhub user_id, user_name, created_at)`.
- 집행액·남은 예산·집행률은 저장하지 않고 매번 계산해요. 집행 건은 **집행 날짜의 연도** 예산에서 빠지고, 그해 예산이 등록된 부서에만 넣을 수 있어요. 미래 날짜는 받지 않아요.
- 집행 건은 넣은 사람과 관리자만 지울 수 있어요. 집행 건이 남은 부서는 지울 수 없어요(FK RESTRICT).
- 예산을 넘겨 집행해도 막지 않아요 — 남은 예산이 음수로, 집행률이 100% 넘게 보여요.
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 날짜는 `date` 컬럼(시간대 없음), "올해"·"오늘" 은 `kstToday()` 기준. 금액은 원 단위 정수, 한 칸 최대 10조 원(`AMOUNT_MAX`).
