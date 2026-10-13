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

## 이 앱 (구매 요청·결재)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/purchase.ts` | 순수 규칙 — 고액 기준 100만 원(`HIGH_VALUE_THRESHOLD`), 상태 이름, 수량·단가 상한, 입력 검사 `validatePurchase`, 금액(`won`)·KST 시각 표시 |
| `lib/purchase-store.ts` | DB 읽기·쓰기 전부. 목록은 30개씩(`PAGE_SIZE`) + 서버 검색. 결재는 트랜잭션 안에서 `FOR UPDATE` 로 줄을 잠그고 상태·본인 여부를 다시 확인해요 |
| `lib/db.ts` | `ensureSchema()` 에 `purchase_requests` 표 (CREATE TABLE IF NOT EXISTS, advisory lock 767017) |
| `app/actions.ts` | Server Action `submitPurchase` · `decidePurchase` — 로그인·관리자·입력을 서버에서 다시 확인 |
| `app/page.tsx` | 내 구매 요청 (상태별 요약 · 요청 폼 · 내 목록: 상태 탭 `?status=` · 품목 검색 `?q=`) |
| `app/admin/page.tsx` | 결재함 (대기 요약 · 결재 대기/처리 완료 탭 `?view=done` · 검색 `?q=` · 고액만 `?high=1`). 관리자가 아니면 안내만 보여요 |
| `components/PurchaseForm.tsx` · `DecisionForm.tsx` | 브라우저 폼 — 총액 실시간 계산 · 확인 창(`useConfirm`) · 결과 알림(`toast`) / 오류(`Alert`) |
| `components/PurchaseItem.tsx` | 목록 한 줄 · 고액 칩 · 금액 표시 · 검색칸 |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 카드 · DB 미연결 경고 · 이전/다음 쪽 링크(검색어·필터 유지) |
| `scripts/purchase-check.mjs` | `npm run check:logic` — `lib/purchase.ts` 를 바꾸면 돌려요 |

- **관리자 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). `lib/purchase.ts` 의 `isApprover()` 한 곳에서만 판단해요.
  본인 요청은 `decidePurchase`(lib/purchase-store.ts)가 서버에서 거절해요 (요청자 user_key = 처리자 user_id). 다른 사람에게 이 앱만의 결재 권한을 주는 법은 README "관리자는 누구인가요".
- **데이터 모델**: `purchase_requests(id, user_key=axhub user_id, user_name, user_email, item, quantity int, unit_price bigint, total bigint GENERATED (quantity × unit_price), reason, status pending|approved|rejected, reject_reason, decided_by, decided_at, created_at)`.
  "고액" 은 저장하지 않고 `total >= HIGH_VALUE_THRESHOLD` 로 매번 판단해요 — 기준을 바꾸면 지난 요청 표시도 같이 바뀌어요.
- 금액은 bigint 지만 상한(수량 1만 × 단가 10억 = 10조)이 JS 숫자로 정확한 범위라 `::float8` 로 읽어요. 상한을 바꾸면 `lib/db.ts` 의 CHECK 제약과 이 가정을 같이 고쳐요 (이미 배포된 DB 는 ALTER TABLE 로 제약을 바꿔요).
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 시각은 `formatDateTime()` 으로 KST 표시.
