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

## 이 앱 (법인카드 사용 내역)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/card.ts` | 순수 규칙 — 입력 검사 `validateExpense` · `validatePurpose`, 금액 읽기(쉼표·원), 상한(`AMOUNT_MAX`), 월 계산(`parseMonth` · `monthRange` · `shiftMonth`), KST 날짜·원 표시, CSV(`toCsv`), 관리자 판단 `isAdmin` |
| `lib/card-store.ts` | DB 읽기·쓰기 전부. 목록(월 · 검색 · 미기재만 · 30건 페이징), 부서별 합계, CSV 행, 용도 채우기 · 지우기(본인 건만, SQL 의 WHERE 에서 막아요) |
| `lib/db.ts` | `ensureSchema()` 에 `card_expenses` 표 (CREATE TABLE IF NOT EXISTS, advisory lock 767011) |
| `app/actions.ts` | Server Action `addExpense` · `fillPurpose` · `deleteExpense` — 로그인·입력을 서버에서 다시 확인, 결과는 `{ ok, message }` |
| `app/page.tsx` | 내 사용 내역 (미기재 알림 · 입력 폼 · 월 이동 · 검색 · 내 목록, `?missing=1` 은 달 상관없이 미기재만) |
| `app/summary/page.tsx` | 월별 합계 (합계 카드 · 부서별 합계 · 모든 사람 목록). 관리자가 아니면 안내만 보여요 |
| `app/summary/export/route.ts` | 한 달 CSV 내려받기 (관리자만, UTF-8 BOM · 수식 막기) |
| `components/ExpenseForm.tsx` · `ExpenseActions.tsx` | 브라우저 폼 — 입력 · 용도 적기 · 지우기 확인 창(`useConfirm`) · 결과 알림(`toast`) / 오류(`Alert`) |
| `components/ExpenseList.tsx` | 사용 건 목록 · 월 이동(`MonthNav`) · 검색창(`SearchForm`) — 두 화면이 같이 써요 |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 카드 · DB 미연결 경고 · 이전/다음 쪽 링크(월 · 검색어 유지, `hrefWith`) |
| `scripts/card-check.mjs` | `npm run check:logic` — `lib/card.ts` 를 바꾸면 돌려요 |

- **관리자 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). `lib/card.ts` 의 `isAdmin()` 한 곳에서만 판단해요.
  월별 합계 화면과 CSV 라우트가 둘 다 서버에서 확인해요. 다른 사람에게 이 앱만의 관리자 권한을 주는 법은 README "관리자는 누구인가요".
- **데이터 모델**: `card_expenses(id, user_key=axhub user_id, user_name, user_email, used_on date, merchant, amount bigint(원, >0), department, purpose NULL=용도 미기재, created_at, updated_at)`.
  부서별·전체 합계는 저장하지 않고 `used_on` 이 그달인 줄을 더해요. 빈 문자열 용도는 넣지 않아요(CHECK) — 미기재 판단은 `purpose IS NULL` 하나예요.
- 용도 채우기는 `purpose IS NULL` 인 본인 줄만 바꿔요. 이미 적힌 용도를 고치게 하려면 그 조건을 풀어요.
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE card_expenses ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 날짜는 `date` 컬럼(시간대 없음). "오늘·이번 달" 은 `kstToday()` 기준.
