# Claude Code 가이드

이 프로젝트의 행동 규칙은 모두 [AGENTS.md](./AGENTS.md) 에 있어요.
**먼저 AGENTS.md 를 읽고 그 규칙을 따라요.** Claude Code 든 Codex 든 동일한 규칙이에요.

## 이 앱: 고객 미팅 기록

고객사를 등록하고 고객사마다 미팅 기록을 남겨요. 홈은 다음 연락일이 오늘(KST)이거나 지난 고객사를 먼저 보여 줘요.
고칠 때 아래 구조와 규칙을 지켜요.

### 데이터 (`lib/db.ts` 의 `ensureSchema()`)
- `companies(id, name, contact_name, contact_info, owner_key, owner_name, created_at)` — `owner_key` = 담당(등록한 사람)의 `me().user_id`.
- `meetings(id, company_id → companies ON DELETE CASCADE, met_on date, attendees, notes, next_action, next_contact_on date NULL, author_key, author_name, created_at)`.
- **고객사의 다음 연락일 = 가장 최근 미팅(met_on DESC, id DESC)의 `next_contact_on`.** 따로 저장하지 않아요.
- 컬럼을 늘릴 땐 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 를 `ensureSchema()` 에 추가 (이미 배포된 DB 가 있어요).

### 권한 (`lib/user.ts`, `app/actions.ts`)
- 로그인한 사람 모두: 보기 · 고객사 등록 · 미팅 기록 남기기 · 자기가 남긴 기록 지우기.
- 담당 또는 앱 관리자(`me().is_admin`): 고객사 수정 · 삭제, 그 고객사의 모든 기록 삭제 (`canManageCompany`).
- 권한은 Server Action 의 SQL `WHERE` 조건으로 다시 확인해요. 버튼 숨기기만으로 끝내지 않아요.

### 파일
- `app/page.tsx` 홈(목록 · 검색 `?q=` · 내 담당 `?mine=1` · 페이지 `?page=`), `app/companies/new/page.tsx` 등록, `app/companies/[id]/page.tsx` 상세.
- `app/actions.ts` 저장·수정·삭제 Server Action — 모든 입력을 서버에서 검사하고 `FormState`(칸별 `errors`, 입력값 `values`)를 돌려줘요.
- `components/MeetingLogForms.tsx` 폼(클라이언트) — `useActionState` 로 오류 표시, 삭제는 `useConfirm()` 확인창으로 한 번 더 확인.
- `components/Notices.tsx` 로그인 필요 · DB 없음 안내. `lib/dates.ts` 한국 시간 오늘 · 날짜 표시('10월 12일 (월)', '3일 지남').
- 날짜는 `date` 타입('YYYY-MM-DD' 문자열)으로만 다루고, 오늘은 `todayKst()` 로 구해요.

## 화면을 만들기 전에 (요약 — 자세히는 AGENTS.md 「디자인」)

- 컴포넌트는 `@heroui/react` **v3** 에서 가져와요. v2 문법(`HeroUIProvider`, `@heroui/button`, `CardBody`, `onClick`)은 틀려요 — `Card.Header`, `onPress`.
- 이 프로젝트는 `@jocoding-ax-partners/design-system`(CSS 전용, HeroUI 를 콘솔처럼 칠함)을 써요.
  UI 코드를 쓰기 전에 `node_modules/@jocoding-ax-partners/design-system/llms.txt` 를 읽어요.
- 확인창 `useConfirm`, `PageHeader`, `StatusDot`, `CodeBlock` 은 `@/components/ax` 에서 (= `@jocoding-ax-partners/react`).
- 아이콘은 `@phosphor-icons/react` (서버 파일은 `@phosphor-icons/react/ssr`).
- 색·글자는 의미 토큰만: `bg-content` `text-muted` `border-default` `t-small` … — #hex · `text-[15px]` · `text-gray-500` 금지.
- 다른 UI 라이브러리는 설치하지 않아요. 고친 뒤 `npm run check:design` 으로 확인해요.
