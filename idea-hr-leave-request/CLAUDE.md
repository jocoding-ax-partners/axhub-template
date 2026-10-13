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

## 이 앱 (휴가 신청·승인)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/leave.ts` | 순수 규칙 — 연차 15일(`ANNUAL_QUOTA`), 종류·상태 이름, 일수 계산(평일, 반차 0.5), 입력 검사 `validateLeave`, KST 날짜 표시 |
| `lib/leave-store.ts` | DB 읽기·쓰기 전부. 신청·승인은 트랜잭션 + 사람 단위 advisory lock 으로 남은 연차를 다시 확인해요 |
| `lib/db.ts` | `ensureSchema()` 에 `leave_requests` 표 (CREATE TABLE IF NOT EXISTS) |
| `app/actions.ts` | Server Action `submitLeave` · `decideLeave` — 로그인·관리자·입력을 서버에서 다시 확인 |
| `app/page.tsx` | 내 휴가 (남은 연차 · 신청 폼 · 내 목록) |
| `app/admin/page.tsx` | 승인 관리 (대기 목록 · 직원별 연차). 관리자가 아니면 안내만 보여요 |
| `components/LeaveForm.tsx` · `DecisionForm.tsx` | 브라우저 폼 — HeroUI 입력 · 확인 창(`useConfirm`) · 결과 알림(`toast`) / 오류(`Alert`) |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 카드 · DB 미연결 경고 · 이전/다음 쪽 링크(검색어 유지) |
| `scripts/leave-check.mjs` | `npm run check:logic` — `lib/leave.ts` 를 바꾸면 돌려요 |

- **관리자 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). `lib/leave.ts` 의 `isApprover()` 한 곳에서만 판단해요.
  본인 신청은 `decideLeave` 가 서버에서 거절해요 (신청자 user_key = 처리자 user_id). 다른 사람에게 이 앱만의 승인 권한을 주는 법은 README "관리자는 누구인가요".
- **데이터 모델**: `leave_requests(id, user_key=axhub user_id, user_name, user_email, kind annual|half|sick, start_date, end_date, days numeric(4,1), reason, status pending|approved|rejected, reject_reason, decided_by, decided_at, created_at)`.
  남은 연차 = 15 − 그해(시작일 연도) 승인된 annual·half 의 days 합. 병가는 빼지 않아요. 저장된 "잔여" 컬럼은 없어요.
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 날짜는 `date` 컬럼(시간대 없음), 시각은 `formatDateTime()` 으로 KST 표시. "올해" 는 `kstToday()` 기준.
