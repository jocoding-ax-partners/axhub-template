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

## 이 앱 (신규 입사자 온보딩 체크리스트)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/onboarding.ts` | 순수 규칙 — 기본 5개(`DEFAULT_ITEMS`), 글자 수 상한, 입력 검사 `validateHire`·`validateTitle`, 진행률 `progress()`, 관리자 판단 `isAdmin()`, KST 날짜 표시 |
| `lib/onboarding-store.ts` | DB 읽기·쓰기 전부. 등록 = 입사자 + 기본 목록 복사를 한 트랜잭션. 목록은 30명씩 + 이름·부서 검색 |
| `lib/db.ts` | `ensureSchema()` 에 표 4개 + 기본 5개를 딱 한 번 넣는 시드 (advisory lock 767020) |
| `app/actions.ts` | Server Action — 로그인·관리자·입력을 서버에서 다시 확인하고 `{ ok, message }` 를 돌려줘요 (throw 없음) |
| `app/page.tsx` | 입사자 목록 (현황 숫자 · 등록 폼 · 검색 · 진행률 목록 · 쪽 이동) |
| `app/hires/[id]/page.tsx` | 입사자 상세 (체크리스트 · 메모 · 정보 고치기 · 관리자만 삭제) |
| `app/settings/page.tsx` | 기본 체크리스트 (누구나 보기, 관리자만 추가·삭제) |
| `components/OnboardingForms.tsx` | 브라우저 폼 — 등록/정보 폼, 체크 항목 한 줄, 삭제 버튼, 기본 항목 관리, 결과 알림 |
| `components/Progress.tsx` | 진행률 막대 + "60% · 3/5" |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 카드 · DB 미연결 경고 · 이전/다음 쪽 링크(검색어 유지) |
| `scripts/onboarding-check.mjs` | `npm run check:logic` — `lib/onboarding.ts` 를 바꾸면 돌려요 |

- **역할**: 로그인한 사람 = 담당자 (등록 · 체크 · 메모 · 정보 고치기). **관리자 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자) — 기본 항목 추가·삭제, 입사자 삭제. `lib/onboarding.ts` 의 `isAdmin()` 한 곳에서만 판단해요.
- **데이터 모델**:
  `checklist_templates(id, title, created_at)` ·
  `hires(id, name, department, start_date date, created_by_key=axhub user_id, created_by_name, created_at)` ·
  `hire_items(id, hire_id → hires ON DELETE CASCADE, position, title, done, memo, updated_by, updated_at)` ·
  `app_meta(key)` — `templates_seeded` 가 있으면 기본 5개를 다시 넣지 않아요.
- 입사자 항목은 등록 순간의 **복사본**이에요 (`hire_items.title`). 기본 항목을 바꿔도 기존 입사자는 그대로. 진행률은 저장하지 않고 `hire_items` 를 세요.
- 체크(`setItemDone`)와 메모(`saveItemMemo`)는 따로 저장해요 — 두 사람이 동시에 하나는 체크, 하나는 메모를 고쳐도 서로 덮어쓰지 않게.
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 날짜는 `date` 컬럼(시간대 없음), 시각은 `formatDateTime()` 으로 KST 표시. "오늘" 은 `kstToday()` 기준.
