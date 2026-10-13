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

## 이 앱 — 경비 정산

직원이 경비(사용일 · 항목 · 금액 · 메모 · 영수증 사진)를 올리고, 관리자가 월별로 승인·반려하고 정산표(CSV)를 내려받는 앱이에요.
고칠 때 아래 구조와 규칙을 유지해요.

### 역할
- **관리자** = `me().is_admin` 이 true 인 사람 (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). 판단은 `lib/expenses.ts` 의 `isAppAdmin()` 한 곳에서만 해요.
- **직원** = 로그인한 나머지 모두. 자기 경비만 보고, 승인 전(대기·반려) 경비만 지울 수 있어요.
- 관리자 화면·CSV·승인 액션은 **서버에서** `isAppAdmin()` 으로 막아요. 메뉴 숨기기만으로 막지 않아요.
- 관리자도 **본인 경비는 승인·반려 못 해요** (`reviewExpense` 의 `user_id <> 관리자` 조건 + 화면엔 "본인 경비"만).
- 앱 전용 관리자를 늘리려면 워크스페이스 관리자로 올리지 말고, 그 사람을 앱 초대(`app_role` = `app_member`)한 뒤 `isAppAdmin()` 에서 `app_role === 'app_member'` 도 관리자로 봐요 (README 「누가 관리자인가요」).

### 데이터 (`lib/db.ts` 의 `ensureSchema()`)
- 테이블 `expenses` 하나: `user_id`(= `me().user_id`) · `user_name` · `user_email`(올린 순간 값) · `spent_on`(date) · `category` · `amount`(원, 정수) · `memo` · `receipt_key`(저장소 위치, 없으면 NULL) · `status`(`pending`/`approved`/`rejected`) · `reviewed_by` · `reviewer_name` · `reviewed_at`(마지막으로 승인·반려한 사람·시각 — 결정을 바꾸면 덮어써요) · `created_at`.
- 컬럼을 늘릴 땐 `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS …` 를 `ensureSchema()` 에 덧붙여요 (기존 데이터 보존).
- 정산표 = `status = 'approved'` 인 경비를 직원별로 더한 값 (`lib/expenses.ts` 의 `settlement()`). 월 기준은 **사용일**(`spent_on`)이에요.

### 영수증 사진 (axhub 파일 저장소 · `lib/storage.ts`)
- `axhub.yaml` 의 `storage: enabled: true` 로 켜져 있어요. 버킷은 비공개 — **공개 주소를 만들지 않아요.**
- 보기는 `app/receipts/[id]/route.ts` 만 거쳐요: 본인 또는 관리자인지 확인 → 5분짜리 임시 주소로 이동. 다른 길로 사진 주소를 내보내지 않아요.
- 올릴 때 JPG · PNG · WEBP, 10MB 이하만 받아요. 형식은 파일 앞부분(매직 바이트)으로 서버가 다시 확인해요. 한도를 바꾸면 `lib/expense-utils.ts` 의 상수와 `next.config.ts` 의 `bodySizeLimit` 를 함께 바꿔요.

### 파일 지도
| 파일 | 하는 일 |
|---|---|
| `app/page.tsx` | 내 경비 — 올리기 폼 + 내가 올린 목록 |
| `app/admin/page.tsx` | 승인 · 정산 — 월 고르기, 정산표, 직원별 경비 승인·반려 |
| `app/admin/settlement.csv/route.ts` | 정산표 CSV (UTF-8 BOM — 한국어 엑셀에서 바로 열려요) |
| `app/receipts/[id]/route.ts` | 영수증 사진 보기 (권한 확인 후 임시 주소) |
| `app/actions.ts` | 쓰기: 올리기 · 지우기 · 승인/반려 (모두 서버에서 권한·입력 검사) |
| `lib/expense-utils.ts` | 항목 목록 · 금액/날짜 검사 · 한국 시간 · CSV (순수 함수) |
| `lib/expenses.ts` | 조회 쿼리 · `isAppAdmin()` |
| `lib/storage.ts` | 파일 저장소 올리기 · 지우기 · 임시 주소 |
| `components/ExpenseForm.tsx` · `ExpenseItem.tsx` · `ConfirmButton.tsx` · `ActionForm.tsx` · `Notice.tsx` | 화면 조각 (`ActionForm` = 지우기·승인·반려 결과 문구 표시, `ConfirmButton` = `useConfirm` 확인창 뒤 제출) |
| `components/AppShell.tsx` · `Shell.tsx` · `Providers.tsx` · `ax.ts` | 앱 뼈대·공용 설정 (건드리지 않아요) |

### 규칙
- 날짜·월은 **한국 시간** 기준 (`todayKst()` · `currentMonthKst()`). `new Date()` 를 그대로 화면 날짜로 쓰지 않아요.
- 항목을 바꾸려면 `lib/expense-utils.ts` 의 `CATEGORIES` 만 고치면 돼요 (DB 는 그대로).
- 순수 함수를 고치면 `npm run check:logic` 으로 확인해요.
