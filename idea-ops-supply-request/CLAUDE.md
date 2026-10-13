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

## 이 앱 (비품 신청·재고)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/supply.ts` | 순수 규칙 — 관리자 판단 `isAdmin`, 부족 판단 `isShort`, 입력 검사 `validateSupply` · `validateRequest` · `parseCount`, 상한값, KST 시각 표시 |
| `lib/supply-store.ts` | DB 읽기·쓰기 전부. 지급은 트랜잭션 안에서 신청 줄 → 비품 줄 순서로 `FOR UPDATE` 잠그고 재고를 다시 확인해요 |
| `lib/db.ts` | `ensureSchema()` 에 `supplies` · `supply_requests` 표 (CREATE TABLE IF NOT EXISTS, advisory lock 767027) |
| `app/actions.ts` | Server Action `addSupply` · `editSupply` · `receiveStock` · `requestSupply` · `decideRequest` — 로그인·관리자·입력을 서버에서 다시 확인 |
| `app/page.tsx` | 비품 (재고 현황 · 부족 먼저인 재고 목록 · 줄마다 신청 칸). 검색 `?q=` · 30개씩 |
| `app/my/page.tsx` | 내 신청 (상태 · 반려 사유) |
| `app/admin/page.tsx` | 신청 처리 (대기 목록 · 지급/반려). 관리자가 아니면 안내만 보여요 |
| `app/supplies/page.tsx` | 비품 관리 (등록 · 입고 · 이름/최소 재고 고치기). 관리자만 |
| `components/forms.tsx` · `DecisionForm.tsx` | 브라우저 폼 — HeroUI 입력 · 확인 창(`useConfirm`) · 결과 알림(`toast`) / 오류(`Alert`) |
| `components/SupplyItem.tsx` | 재고 목록 한 줄 (부족 표시 · 재고/최소/지급 대기). 비품 · 비품 관리 화면이 같이 써요 |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 · 관리자 전용 안내 · DB 미연결 경고 · 이전/다음 쪽 링크(검색어 유지) |
| `scripts/supply-check.mjs` | `npm run check:logic` — `lib/supply.ts` 를 바꾸면 돌려요 |

- **관리자 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). `lib/supply.ts` 의 `isAdmin()` 한 곳에서만 판단해요.
  본인 신청은 `decideRequest` 가 서버에서 거절해요 (신청자 user_key = 처리자 user_id). 다른 사람에게 이 앱만의 관리 권한을 주는 법은 README "관리자는 누구인가요".
- **데이터 모델**
  - `supplies(id, name, stock int ≥0, min_stock int ≥0, created_at, updated_at)` — 이름은 `lower(name)` 유니크 인덱스.
  - `supply_requests(id, supply_id → supplies, user_key=axhub user_id, user_name, user_email, qty int >0, note, status pending|issued|rejected, reject_reason, decided_by, decided_at, created_at)`.
  - 부족 = `stock < min_stock` (저장하지 않고 쿼리에서 계산). 재고는 입고(+)와 지급(−)으로만 바뀌어요 — 신청은 재고를 건드리지 않아요.
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 시각은 `formatDateTime()` 으로 KST 표시.
