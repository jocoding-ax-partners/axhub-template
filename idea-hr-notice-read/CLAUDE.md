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

## 이 앱 (사내 공지·읽음 확인)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/notice.ts` | 순수 규칙 — 관리자 판단 `isManager`, 입력 검사 `validateNotice`(제목 100자 · 본문 10,000자), 확인률 `readRate`(내림, 0~100), 번호 검사 `isNoticeId`, KST 시각 표시 |
| `lib/notice-store.ts` | DB 읽기·쓰기 전부. 명단 기록 `touchMember`, 직원 목록(안 읽은 것 → 중요 → 최신, 검색 · 30건 페이징), 확인 기록, 공지 올리기 · 지우기, 공지별 확인 수, 확인한/안 본 사람 목록 |
| `lib/db.ts` | `ensureSchema()` 에 `notices` · `notice_reads` · `members` 표 (CREATE TABLE IF NOT EXISTS, advisory lock 767012) |
| `app/actions.ts` | Server Action `createNotice` · `confirmRead` · `deleteNotice` — 로그인·관리자·입력을 서버에서 다시 확인, 결과는 `{ ok, message, errors?, values? }` |
| `app/page.tsx` | 사내 공지 (안 읽은 수 · 검색 · 목록) |
| `app/notices/[id]/page.tsx` | 공지 읽기 + "확인했어요" |
| `app/admin/page.tsx` | 공지 관리 (새 공지 폼 · 공지별 확인률 목록). 관리자가 아니면 안내만 보여요 |
| `app/admin/[id]/page.tsx` | 확인 현황 (확인률 · 아직 안 본 사람/확인한 사람 탭 `?tab=` · 이름 검색 · 공지 지우기) |
| `components/NoticeForms.tsx` | 브라우저 폼 — 새 공지(`useActionState`, 칸별 오류) · 확인 버튼 · 지우기 확인 창(`useConfirm`) · 결과 알림(`toast`) / 오류(`Alert`) |
| `components/Gate.tsx` · `Pager.tsx` · `SearchForm.tsx` | 로그인 안내 · 관리자 전용 안내 · DB 미연결 경고 · 이전/다음 쪽(검색어·탭 유지) · `?q=` 검색 칸 |
| `scripts/notice-check.mjs` | `npm run check:logic` — `lib/notice.ts` 를 바꾸면 돌려요 |

- **관리자 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). `lib/notice.ts` 의 `isManager()` 한 곳에서만 판단해요.
  관리자 화면 두 개와 `createNotice` · `deleteNotice` 가 모두 서버에서 확인해요. 다른 사람에게 이 앱만의 관리자 권한을 주는 법은 README "관리자는 누구인가요".
- **데이터 모델**: `notices(id, title, body, important, author_key=axhub user_id, author_name, created_at)` ·
  `notice_reads(notice_id → notices ON DELETE CASCADE, user_key, read_at, PK(notice_id, user_key))` ·
  `members(user_key PK, name, email, first_seen, last_seen)`.
- **확인률 = 그 공지의 notice_reads 수 ÷ members 수.** members 는 로그인해서 `/` 나 `/notices/[id]` 를 연 사람이에요(`touchMember`, 1시간에 한 번만 갱신).
  읽음 기록을 남기기 전에 늘 `touchMember` 를 거치므로 확인한 사람은 항상 명단에 있어요 — "안 본 사람 = members − 확인한 사람".
  분모를 조직도 전체로 바꾸려면 `countMembers` 와 `listPeople('unread')` 두 곳을 고쳐요.
- 이름 · 이메일은 members 에서 읽어요(최근 방문 때 값). notice_reads 에는 사용자 ID 만 둬요.
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 시각은 `formatDateTime()` 으로 KST 표시.
