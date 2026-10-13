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

## 이 앱 (샘플·자료 발송 기록)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/shipment.ts` | 순수 규칙 — 입력 검사 `validateShipment`, 권한 `canManage`, 후속 연락 상태(`followUpState`: none·done·overdue·today·upcoming), 고객사 이름 정리, KST 날짜 표시 |
| `lib/shipment-store.ts` | DB 읽기·쓰기 전부 — 홈 요약 · 연락할 건 · 전체 목록(검색) · 고객사 묶음 · 고객사 이력 · 등록 · 고치기 · 지우기 · 완료 표시. 목록은 30건씩 |
| `lib/db.ts` | `ensureSchema()` 에 `shipments` 표 (CREATE TABLE IF NOT EXISTS, advisory lock 767030) |
| `app/actions.ts` | Server Action `createShipment` · `updateShipment` · `deleteShipment` · `markFollowUp` — 로그인·권한·입력을 서버에서 다시 확인하고 `{ ok, message }` 를 돌려줘요 |
| `app/page.tsx` | 오늘 할 연락 (요약 숫자 · 연락할 때가 된 건 · 최근 발송). `?mine=1` 이면 내가 기록한 건만 |
| `app/shipments/page.tsx` · `new/page.tsx` · `[id]/page.tsx` | 발송 기록 목록(`?q=` 검색) · 새 기록(`?customer=` 로 고객사 미리 채움) · 한 건 보기/고치기/지우기 |
| `app/customers/page.tsx` · `history/page.tsx` | 고객사 목록(`?q=` 이름 검색) · 고객사별 발송 이력(`?name=`) |
| `components/ShipmentList.tsx` | 발송 목록 한 줄 · 상태 점 색 · 팀 전체/내 건 탭 (서버 컴포넌트) |
| `components/ShipmentForm.tsx` · `ShipmentButtons.tsx` | 브라우저 폼(`useActionState`, 고객사 자동완성 datalist) · 완료/완료 취소 · 지우기(`useConfirm`) |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 카드 · DB 미연결 경고 · 이전/다음 쪽 링크(검색어·필터 유지) |
| `scripts/shipment-check.mjs` | `npm run check:logic` — `lib/shipment.ts` 를 바꾸면 돌려요 |

- **팀 공용 기록이에요.** 로그인한 사람은 누구나 모든 발송 기록을 보고 새로 기록해요.
  고치기 · 지우기 · 연락 완료 표시는 **기록한 사람(created_by = axhub user_id) 또는 관리자(`me().is_admin`)** 만 — `lib/shipment.ts` 의 `canManage()` 와
  `lib/shipment-store.ts` 의 `manageable()` 두 곳이 같은 규칙이에요 (화면 버튼 숨김 + 서버 쿼리 조건). 바꿀 땐 둘 다 바꿔요.
- **데이터 모델**: `shipments(id, customer, contact, items, sent_on date, follow_up_on date NULL, memo, done_at, done_by, created_by, created_by_name, created_at, updated_at)`.
  CHECK: `follow_up_on >= sent_on`, 완료(done_at)는 예정일이 있을 때만. 고객사는 별도 표 없이 `lower(customer)` 로 묶어요 (보여 주는 이름은 최근 발송 때 적은 것).
- "연락할 때가 된 건" = `done_at IS NULL AND follow_up_on <= 오늘(KST)`. 예정일을 고치면 완료 표시가 풀려요 (`updateShipment` 의 CASE).
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE shipments ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 날짜는 `date` 컬럼(시간대 없음)이고 "오늘" 은 `kstToday()` 로 앱에서 구해 넘겨요. 시각은 `formatDateTime()` 으로 KST 표시.
