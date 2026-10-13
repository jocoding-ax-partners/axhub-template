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

## 이 앱 (장비 대여 관리)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/rental.ts` | 순수 규칙 — 관리자 `isAdmin` · 반납 권한 `canReturn`, 입력 검사 `validateEquipment` · `validateDue`(오늘~90일), 반납 지연 `isOverdue`, 보기 필터, KST 날짜 표시 |
| `lib/rental-store.ts` | DB 읽기·쓰기 전부. 대여 · 빼기는 트랜잭션에서 장비 줄을 `FOR UPDATE` 로 잠가 동시에 눌러도 한 번만 돼요. 목록은 30개씩 + `?q=` 검색 |
| `lib/db.ts` | `ensureSchema()` 에 `equipment` · `rentals` 표와 인덱스 (advisory lock 767014) |
| `app/actions.ts` | Server Action `rent` · `giveBack` · `addEquipment` · `retireEquipment` — 로그인 · 관리자 · 입력을 서버에서 다시 확인, `{ ok, message }` 를 돌려줘요 |
| `app/page.tsx` | 장비 목록 (현황 숫자 · 보기 필터 `?f=` · 검색 · 대여/반납) |
| `app/my/page.tsx` | 내 대여 (지금 빌린 것 먼저, 지난 기록) |
| `app/admin/page.tsx` | 장비 관리 (등록 · 목록에서 빼기). 관리자가 아니면 안내만 보여요 |
| `components/EquipmentItem.tsx` | 장비 한 줄 — 빌린 사람 · 반납 예정일, 지연이면 빨간색 (서버 컴포넌트) |
| `components/RentForm.tsx` · `ConfirmAction.tsx` · `EquipmentForm.tsx` | 브라우저 폼 — 반납 예정일 + 대여, 확인 창(`useConfirm`) 뒤 반납/빼기, 장비 등록 |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 카드 · DB 미연결 경고 · 이전/다음 쪽 링크(검색어 · 필터 유지) |
| `scripts/rental-check.mjs` | `npm run check:logic` — `lib/rental.ts` 를 바꾸면 돌려요 |

- **관리자 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). `lib/rental.ts` 의 `isAdmin()` 한 곳에서만 판단해요.
  반납은 빌린 본인 또는 관리자(`canReturn`) — `returnRental` 이 서버에서도 확인해요. 다른 사람에게 이 앱만의 관리 권한을 주는 법은 README "관리자는 누구인가요".
- **데이터 모델**
  - `equipment(id, name, kind, asset_no, created_at, retired_at)` — 목록에서 빼면 지우지 않고 `retired_at` 을 채워요. `lower(asset_no)` 는 `retired_at IS NULL` 인 장비끼리 유일.
  - `rentals(id, equipment_id → equipment, user_key=axhub user_id, user_name, user_email, due_date date, rented_at, returned_at, returned_by)` — `returned_at IS NULL` 이 "지금 빌린 것" 이고, 장비당 하나만 있을 수 있어요(부분 유니크 인덱스).
  - "반납 지연" = 반납 안 된 대여 중 `due_date < kstToday()`. 저장된 상태 컬럼은 없어요.
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 날짜는 `date` 컬럼(시간대 없음), 시각은 `formatDateTime()` 으로 KST 표시. "오늘" 은 `kstToday()` 기준.
