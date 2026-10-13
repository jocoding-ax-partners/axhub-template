# Claude Code 가이드

이 프로젝트의 행동 규칙은 모두 [AGENTS.md](./AGENTS.md) 에 있어요.
**먼저 AGENTS.md 를 읽고 그 규칙을 따라요.** Claude Code 든 Codex 든 동일한 규칙이에요.

## 이 앱 — 이벤트 참가 신청 관리

담당자가 이벤트를 만들고, 참가 신청자를 한 명씩 또는 CSV 로 등록하고, 당일 출석을 체크해요. 고칠 때 아래 구조를 지켜요.

**데이터** (`lib/db.ts` 의 `ensureSchema()`)
- `events(id, name, starts_at timestamptz, venue, capacity > 0, created_by, created_at)`
- `attendees(id, event_id → events ON DELETE CASCADE, name, company, email, checked_in_at, created_at)`
- 유일 인덱스 `(event_id, lower(email))` — 이벤트당 이메일 1회. 출석 = `checked_in_at IS NOT NULL`.
- 컬럼 추가는 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 로 같은 함수에.

**권한** — 담당자 = `me().is_admin` (소유자·워크스페이스 관리자·플랫폼 관리자). `lib/manager.ts`
- 화면은 `components/Gate.tsx` 로 감싸고(로그인/권한/DB 안내), **모든 Server Action 은 맨 앞에서 `requireManager()`** — 실패는 throw 대신 `{ message }` 를 돌려줘요(배포본은 throw 문구를 가려요).
- 로컬 개발(axhub 미설정 + NODE_ENV≠production)만 `'local-dev'` 담당자로 통과. production 에서 미설정이면 거부.

**파일**
- `app/page.tsx` 이벤트 목록(검색 `?q=` · 쪽 `?page=`) + 만들기 / `app/events/[id]/page.tsx` 현황 · 명단 · 출석 · 등록 · 지우기
- `app/actions.ts` 모든 변경(Server Action). 정원은 `addRows()` 가 이벤트 행을 `FOR UPDATE` 로 잠그고 판정해요.
- `lib/applicants.ts` CSV 글자 읽기(UTF-8/BOM → EUC-KR·CP949, 브라우저 TextDecoder) · CSV 나누기 · 값 검사 · `classifyRows()` 판정. 서버·브라우저 공용, 의존성 없음.
- `components/forms.tsx` 이벤트·신청자 폼(useActionState), 제출/확인 버튼 · `components/CsvImport.tsx` CSV 미리보기 → 등록 · `components/Pager.tsx` 쪽 나눔
- `lib/format.ts` 한국 시간 표시 · 출석률
- `scripts/check-logic.mjs` 규칙 점검 — `lib/applicants.ts` 를 바꾸면 `npm run check:logic` 으로 확인하고 필요하면 케이스를 추가해요.

## 화면을 만들기 전에 (요약 — 자세히는 AGENTS.md 「디자인」)

- 컴포넌트는 `@heroui/react` **v3** 에서 가져와요. v2 문법(`HeroUIProvider`, `@heroui/button`, `CardBody`, `onClick`)은 틀려요 — `Card.Header`, `onPress`.
- 이 프로젝트는 `@jocoding-ax-partners/design-system`(CSS 전용, HeroUI 를 콘솔처럼 칠함)을 써요.
  UI 코드를 쓰기 전에 `node_modules/@jocoding-ax-partners/design-system/llms.txt` 를 읽어요.
- 확인창 `useConfirm`, `PageHeader`, `StatusDot`, `CodeBlock` 은 `@/components/ax` 에서 (= `@jocoding-ax-partners/react`).
- 아이콘은 `@phosphor-icons/react` (서버 파일은 `@phosphor-icons/react/ssr`).
- 색·글자는 의미 토큰만: `bg-content` `text-muted` `border-default` `t-small` … — #hex · `text-[15px]` · `text-gray-500` 금지.
- 다른 UI 라이브러리는 설치하지 않아요. 고친 뒤 `npm run check:design` 으로 확인해요.
