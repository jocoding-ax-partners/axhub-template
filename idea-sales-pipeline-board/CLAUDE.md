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

## 이 앱 (영업 파이프라인 보드)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/pipeline.ts` | 순수 규칙 — 단계 이름·순서(`STAGE_LABEL`), 이웃 단계, 금액 파싱(bigint), 입력 검사 `validateDeal`, 권한 `isManager` · `canDelete`, 원·KST 날짜 표시 |
| `lib/pipeline-store.ts` | DB 읽기·쓰기 전부 — 보드(단계별 앞 30장 + 단계별 건수·합계), 목록(검색·단계·30개씩), 추가·고치기·옮기기·지우기 |
| `lib/db.ts` | `ensureSchema()` 에 `deals` 표 (CREATE TABLE IF NOT EXISTS, advisory lock 767029) |
| `app/actions.ts` | Server Action `createDeal` · `updateDeal` · `moveDeal` · `deleteDeal` — 로그인·권한·입력을 서버에서 다시 확인 |
| `app/page.tsx` | 보드 (요약 카드 · 검색 · 단계 열) |
| `app/deals/page.tsx` | 거래 목록 (단계 탭 · 검색 · 쪽 나눔) |
| `app/deals/new/page.tsx` · `app/deals/[id]/page.tsx` | 새 거래 · 고치기/지우기 |
| `components/Board.tsx` | 브라우저 보드 — 드래그 · ◀ ▶ · 「옮기기」 메뉴, `useOptimistic` 으로 먼저 옮기고 실패하면 `toast` |
| `components/DealForm.tsx` | 거래 폼 — HeroUI 입력 · 지우기 확인(`useConfirm`) · 오류(`Alert`) |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 카드 · DB 미연결 경고 · 이전/다음 쪽 링크(검색어·단계 유지) |
| `scripts/pipeline-check.mjs` | `npm run check:logic` — `lib/pipeline.ts` 를 바꾸면 돌려요 |

- **권한**: 로그인한 누구나 추가·고치기·옮기기. 지우기는 등록한 사람(`created_by_key` = `me().user_id`) 또는 관리자(`me().is_admin`, `isManager()`).
  지우기 조건은 `deleteDeal` 의 `DELETE … WHERE` 에도 들어 있어요. 다른 사람에게 이 앱만의 관리자 권한을 주는 법은 README "관리자는 누구인가요".
- **데이터 모델**: `deals(id, company, amount bigint 원, owner text, expected_close date NULL, stage contact|proposal|negotiation|won|lost, created_by_key=axhub user_id, created_by_name, updated_by_name, created_at, updated_at)`.
  건수·합계는 저장하지 않고 `GROUP BY stage` 로 계산해요. 금액은 `amount::text` 로 읽어 `BigInt` 로 더해요 (Number 로 바꾸지 않아요).
- **옮기기**는 `UPDATE … WHERE id = ? AND stage = <보드가 본 단계>` — 다른 사람이 먼저 옮겼으면 덮어쓰지 않고 안내해요.
- 단계를 더하거나 바꾸면 `lib/pipeline.ts` 의 `STAGE_LABEL` 과 `lib/db.ts` 의 CHECK 제약을 같이 바꿔요 (이미 배포된 DB 는 `ALTER TABLE deals DROP CONSTRAINT … / ADD CONSTRAINT …`).
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE deals ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 날짜는 `date` 컬럼(시간대 없음), 시각은 `formatDateTime()` 으로 KST 표시. "오늘" 은 `kstToday()` 기준.
