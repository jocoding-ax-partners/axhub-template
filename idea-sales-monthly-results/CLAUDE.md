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

## 이 앱 (월간 실적 집계)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/sales.ts` | 순수 규칙 — 권한(`isManager` · `canDelete`), 월 계산(`monthOf` · `shiftMonth` · `lastMonths` · `monthRange`, KST), 입력 검사 `validateContract`, 금액·날짜 표시 |
| `lib/sales-store.ts` | DB 읽기·쓰기 전부 — 담당자별 합계 `listRepTotals`, 최근 6개월 `listMonthTotals`, 계약 목록(검색·30건 쪽) `listContracts`, `createContract`, `deleteContract`(본인·관리자 확인) |
| `lib/db.ts` | `ensureSchema()` 에 `contracts` 표 (CREATE TABLE IF NOT EXISTS, advisory lock 767028) |
| `app/actions.ts` | Server Action `addContract` · `deleteContract` — 로그인·권한·입력을 서버에서 다시 확인, `{ ok, message }` 를 돌려줘요 |
| `app/page.tsx` | 월간 실적 (달 고르기 · 팀 합계 카드 · 담당자별 표 · 6개월 차트) |
| `app/contracts/page.tsx` | 계약 입력 (입력 폼 · 고른 달 계약 목록 · 검색 · 쪽 나누기 · 지우기) |
| `components/ContractForm.tsx` · `DeleteContractButton.tsx` | 브라우저 폼 — `useActionState` · 확인 창(`useConfirm`) · 결과 알림(`toast`) / 오류(`Alert`) |
| `components/MonthNav.tsx` · `MonthChart.tsx` | 이전/다음 달 링크 + 달 고르기 · 막대 차트(라이브러리 없이 HTML) |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 카드 · DB 미연결 경고 · 이전/다음 쪽 링크(달·검색어 유지) |
| `scripts/sales-check.mjs` | `npm run check:logic` — `lib/sales.ts` 를 바꾸면 돌려요 |

- **담당자 = 계약을 넣은 사람** (`me().user_id` → `user_key`). 다른 사람 이름으로 대신 넣는 기능은 없어요.
- **관리자 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). `lib/sales.ts` 의 `isManager()` · `canDelete()` 에서만 판단해요.
  지우기는 넣은 본인이나 관리자만 — `deleteContract` 가 서버에서 다시 확인해요. 다른 사람에게 이 앱만의 관리 권한을 주는 법은 README "관리자는 누구인가요".
- **데이터 모델**: `contracts(id, user_key=axhub user_id, user_name, user_email, contract_date date, customer text 1~100자, amount bigint 1 ~ 1조 미만, created_at)`.
  월별·담당자별 합계는 저장하지 않고 `contract_date` 기준으로 매번 `sum` 해요. 담당자 이름은 그 달 마지막 계약의 값.
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE contracts ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 날짜는 `date` 컬럼(시간대 없음). "오늘"·"이번 달" 은 `kstToday()` 기준. 주소의 `?month=` 는 `monthOf()` 로만 읽어요 (미래 달·이상한 값은 이번 달).
