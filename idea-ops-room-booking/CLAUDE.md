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

## 이 앱: 회의실 예약

고칠 때 아래 구조와 규칙을 지켜요. 사용자 안내는 [README.md](./README.md).

| 파일 | 역할 |
|------|------|
| `app/page.tsx` | 예약하기 — 날짜 이동 + 예약 양식(`?room=&start=` 일 때) + 시간표 카드 |
| `components/Timetable.tsx` | 회의실별 30분 시간표. rowSpan 으로 칸을 합쳐서 HeroUI `Table` 대신 평범한 `<table>` + 토큰 클래스 — 표 안에서만 옆으로 밀리고 시간 열은 고정(`sticky`) |
| `app/my/page.tsx` | 내 예약 — 오늘 이후 본인 예약, 확인 후 취소 |
| `app/rooms/page.tsx` | 회의실 관리 — 목록은 모두, 등록 양식은 `is_admin` 만 |
| `app/actions.ts` | 서버 액션 `createRoom` · `createBooking` · `cancelBooking`. 결과는 `?ok=` / `?error=` 로 돌려보내고 `components/Notice.tsx` 가 정해진 문구의 HeroUI `Alert` 로 보여줘요 (모르는 코드는 무시) |
| `lib/booking.ts` | 시간 규칙(순수 함수): 30분 단위, 08:00~20:00, KST 오늘·지금, 날짜 검증·표시 |
| `lib/db.ts` `ensureSchema()` | `rooms`, `bookings` 표를 멱등으로 생성 |
| `components/SubmitButton.tsx` | HeroUI `Button` 제출 버튼 — 처리 중 잠금 + 선택적 확인창(`confirm` = `useConfirm` 옵션) |
| `scripts/booking-check.mjs` | `npm run check:logic` — `lib/booking.ts` 규칙 점검 |

데이터 모델
- `rooms(id, name UNIQUE, capacity 1~1000, created_at)`
- `bookings(id, room_id → rooms ON DELETE CASCADE, user_key = me().user_id, user_name, title 1~100자, day date, start_min, end_min, created_at)`
- 시각은 **그날 0시부터의 분(KST 벽시계)** 정수예요. `day` 는 KST 날짜. timestamptz 로 바꾸지 마세요.
- **겹침 방지는 DB 제약 `bookings_no_overlap`** (`EXCLUDE USING gist (room_id =, day =, int4range(start_min, end_min) &&)`) 이 맡아요.
  앱 코드에 "먼저 조회하고 없으면 넣기" 를 따로 만들지 말고, INSERT 후 오류 코드 `23P01` 을 잡아 안내해요. 이 제약은 `btree_gist` 확장이 필요해서 `axhub.yaml` 의 `database.extensions` 에 선언돼 있어요 — 지우지 마세요.
- 시간표 범위(`DAY_START`/`DAY_END`)나 단위(`SLOT`)를 바꾸면 `lib/db.ts` 의 CHECK 제약도 함께 봐요. 이미 만들어진 표는 `CREATE TABLE IF NOT EXISTS` 로 바뀌지 않으니 제약 변경은 `ALTER TABLE` 을 `ensureSchema()` 에 추가해요.

권한
- 관리자 = `me().is_admin` (앱 소유자·워크스페이스 관리자). 관리자 전용 동작은 서버 액션 안에서 다시 확인해요 — 링크 숨기기만으로 막지 않아요.
- 예약 취소·수정은 `user_key = me().user_id` 조건으로 본인 것만.
