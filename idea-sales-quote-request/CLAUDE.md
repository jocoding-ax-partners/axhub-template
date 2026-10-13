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

## 이 앱 (견적 요청 접수·배정)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/quote.ts` | 순수 규칙 — 상태 이름(`STATUS_LABEL`), 팀장 판단 `isLeader`, 입력 검사 `validateQuote`, 납기 표시 `dueLabel`, KST 날짜 |
| `lib/quote-store.ts` | DB 읽기·쓰기 전부. 목록(`listQuotes` 페이징 30건 · 검색 · 상태 · 미배정 · 내 요청), 상태별 건수, 담당자 후보(`members`), 등록 · 배정 |
| `lib/db.ts` | `ensureSchema()` 에 `quote_requests` · `members` 표 (CREATE TABLE IF NOT EXISTS, advisory lock 767015) |
| `app/actions.ts` | Server Action `submitQuote` · `assignQuote` — 로그인·팀장·입력을 서버에서 다시 확인 |
| `app/page.tsx` | 내 요청 (등록 폼 · 내 담당/내가 등록한 요청 목록) |
| `app/admin/page.tsx` | 전체 요청 (모든 요청 · 담당자 배정 · 상태 변경). 팀장이 아니면 안내만 보여요 |
| `components/QuoteBoard.tsx` | 두 화면이 같이 쓰는 목록 — 상태 탭(건수) · 검색 GET 폼 · 카드 목록 · 쪽 이동 |
| `components/QuoteForm.tsx` · `AssignForm.tsx` | 브라우저 폼 — HeroUI 입력 · Select · 확인 창(`useConfirm`) · 결과 알림(`toast`) / 오류(`Alert`) |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 카드 · DB 미연결 경고 · 이전/다음 쪽 링크(조건 유지) |
| `scripts/quote-check.mjs` | `npm run check:logic` — `lib/quote.ts` 를 바꾸면 돌려요 |

- **팀장 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). `lib/quote.ts` 의 `isLeader()` 한 곳에서만 판단해요.
  다른 사람에게 이 앱만의 팀장 권한을 주는 법은 README "팀장(관리자)은 누구인가요".
- **보이는 범위**: 팀장이 아닌 사람은 `assignee_key = 나 OR created_by_key = 나` 인 요청만 봐요 (`QuoteFilter.mine`). 이 조건은 SQL 에서 걸어요 — 화면에서 거르지 않아요.
- **데이터 모델**
  - `quote_requests(id, company, contact_name, contact_phone, item, quantity int>0, due_date date, status received|quoted|won|lost, assignee_key → members.user_key | NULL, created_by_key, created_by_name, created_at, updated_by_name, updated_at)`
  - `members(user_key=axhub user_id PK, name, email, last_seen_at)` — 화면을 열거나 요청을 등록하면 적혀요 (`touchMember`, 바뀐 게 있거나 하루가 지났을 때만 씀).
- 상태는 아무 상태로나 바꿀 수 있어요 (잘못 바꾼 걸 되돌릴 수 있게). 수주 · 실패로 바꿀 때만 확인 창을 띄워요.
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 날짜는 `date` 컬럼(시간대 없음), 시각은 `formatDateTime()` 으로 KST 표시. "오늘" 은 `kstToday()` 기준.
