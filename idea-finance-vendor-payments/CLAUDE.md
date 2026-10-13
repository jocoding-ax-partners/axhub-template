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

## 이 앱 (거래처 지급 일정)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/payment.ts` | 순수 규칙 — 권한(`isManager` · `canEdit`), 입력 검사 `validatePayment` · `validatePaidDate`, 금액 읽기 `parseAmount`, 한 주(월~일) `weekRange`, 상태 `paymentState`, 목록 거르기 `FILTER_LABEL`, KST 날짜·금액 표시 |
| `lib/payment-store.ts` | DB 읽기·쓰기 전부. 홈 합계 · 이번 주 · 지연 · 지급 일정(거르기+검색+30건씩) · 거래처 합계 · 거래처 이력 · 등록 · 고치기 · 지우기 · 지급 완료 · 지급 취소 |
| `lib/db.ts` | `ensureSchema()` 에 `vendor_payments` 표 (CREATE TABLE IF NOT EXISTS, advisory lock 767018) |
| `app/actions.ts` | Server Action `createPayment` · `updatePayment` · `deletePayment` · `markPaid` · `cancelPaid` — 로그인·권한·입력을 서버에서 다시 확인 |
| `app/page.tsx` | 이번 주 지급 (합계 3개 · 이번 주 예정 · 지급 지연) |
| `app/payments/page.tsx` | 지급 일정 (등록 폼 · 미지급/지연/완료/전체 탭 · 검색 · 쪽) |
| `app/vendors/page.tsx` | 거래처 합계 목록(검색 · 쪽), `?v=거래처` 면 그 거래처의 합계와 지급 이력 |
| `components/PaymentForm.tsx` | 등록 · 고치기 폼 (거래처 자동완성 `<datalist>`, 금액 쉼표 미리보기) |
| `components/PaymentList.tsx` · `PaymentActions.tsx` | 지급 건 목록 한 줄 + 그 사람이 쓸 수 있는 버튼 (지급 완료 · 지급 취소 · 고치기 · 지우기, 확인창 `useConfirm`) |
| `components/Notices.tsx` · `Pager.tsx` · `SearchForm.tsx` | 로그인 안내 · DB 미연결 경고 · 이전/다음 쪽(조건 유지) · GET 검색창 |
| `scripts/payment-check.mjs` | `npm run check:logic` — `lib/payment.ts` 를 바꾸면 돌려요 |

- **관리자 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). `lib/payment.ts` 의 `isManager()` 한 곳에서만 판단해요.
  지급 완료 · 지급 취소는 관리자만. 고치기 · 지우기는 등록한 사람 본인 또는 관리자이고, 아직 지급하지 않은 건만 돼요 —
  `lib/payment-store.ts` 가 `WHERE paid_date IS NULL AND created_by_key = …` 조건으로 막아요. 이 앱만의 관리자를 두는 법은 README "관리자는 누구인가요".
- **데이터 모델**: `vendor_payments(id, vendor, amount bigint(원), due_date date, memo, paid_date date|null, paid_by, paid_at, created_by_key=axhub user_id, created_by_name, created_at, updated_at)`.
  `paid_date IS NULL` = 미지급. 상태 컬럼은 따로 두지 않아요. 거래처 표도 따로 없고 `vendor` 글자(공백 정리 후)로 묶어요.
- 한 주는 월~일 (`weekRange`). "이번 주 예정" 은 오늘 ~ 일요일, "지연" 은 오늘보다 앞이라 두 목록이 겹치지 않아요.
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE vendor_payments ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 날짜는 `date` 컬럼(시간대 없음)이라 시간대 영향이 없어요. "오늘" · "이번 주" 는 `kstToday()`(한국 시간) 기준.
