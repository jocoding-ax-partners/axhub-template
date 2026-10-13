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

## 이 앱 (콘텐츠 발행 캘린더)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/content.ts` | 순수 규칙 — 채널(이름 · 색 클래스) · 상태 이름, 입력 검사 `validateContent`, 지우기 권한 `canDelete`, 달력 칸 `monthGrid` · 달 이동, KST 날짜 표시 |
| `lib/content-store.ts` | DB 읽기·쓰기 전부. 달력(`listMonth`, 한 달 최대 1000건), 목록(`listContents`, 30건씩 + 검색·거르기), 상세·등록·수정(version 비교)·지우기 |
| `lib/db.ts` | `ensureSchema()` 에 `contents` 표 (CREATE TABLE IF NOT EXISTS, advisory lock 767013) |
| `app/actions.ts` | Server Action `saveContent`(등록·수정) · `deleteContent` — 로그인·권한·입력을 서버에서 다시 확인 |
| `app/page.tsx` | 월간 달력 (`?m=YYYY-MM`). 좁은 화면은 칸에 색 점 + 아래 "이 달 일정" |
| `app/list/page.tsx` | 목록 (`?q=&channel=&status=&date=&page=`) |
| `app/new/page.tsx` · `app/c/[id]/page.tsx` | 등록 · 상세(보기 · 고치기 · 지우기) |
| `components/ContentForm.tsx` · `DeleteButton.tsx` | 브라우저 폼 — HeroUI 입력 · 확인 창(`useConfirm`) · 결과 알림(`toast`) / 오류(`Alert`) |
| `components/ChoiceSelect.tsx` · `ContentBadges.tsx` | HeroUI Select 묶음(폼·GET 검색 둘 다) · 채널 색 점 / 상태 점 |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 카드 · DB 미연결 경고 · 이전/다음 쪽 링크(조건 유지) |
| `scripts/content-check.mjs` | `npm run check:logic` — `lib/content.ts` 를 바꾸면 돌려요 |

- **권한**: 보기·등록·수정 = 로그인한 사람 누구나. 지우기 = 등록자(`created_by_key` = `me().user_id`) 또는 관리자(`me().is_admin`).
  판단은 `lib/content.ts` 의 `canDelete()` 한 곳에서만 해요. 다른 사람에게 이 앱만의 관리자 역할을 주는 법은 README "관리자는 누구인가요".
- **데이터 모델**: `contents(id, title ≤100, channel blog|instagram|youtube|newsletter, publish_date date, owner text ≤50 (이름 그대로), status planning|writing|review|published, memo ≤1000, created_by_key=axhub user_id, created_by_name, created_at, updated_by_name, updated_at, version)`.
  수정은 `WHERE id = … AND version = …` 로 해서 동시 수정이 앞 저장을 덮지 않아요 (`CHANGED_ELSEWHERE`).
- **채널을 더하려면** `CHANNELS` 에 한 줄 + `ensureSchema()` 의 CHECK 를 바꿔요. 이미 배포된 DB 는 `ALTER TABLE contents DROP CONSTRAINT contents_channel_check, ADD CONSTRAINT …` 가 필요해요.
  색 클래스는 Tailwind 가 소스에서 찾으니 `bg-info` 처럼 통째로 적어요 (문자열 조립 금지).
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE contents ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 날짜는 `date` 컬럼(시간대 없음), 시각은 `formatDateTime()` 으로 KST 표시. "이번 달" · "오늘" 은 `kstToday()` 기준.
