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

## 이 앱 (캠페인 성과 기록)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/campaign.ts` | 순수 규칙 — 입력 검사 `validateCampaign` · `validateDaily`(기간 안 날짜, 클릭 ≤ 노출), 지표 `ctr` · `cpa`, 정렬 이름, 권한 `canEdit`, KST 날짜·숫자 표시 |
| `lib/campaign-store.ts` | DB 읽기·쓰기 전부. 합계·정렬·검색·쪽 나눔은 SQL 에서. 수정·삭제·날짜별 저장은 트랜잭션 안에서 권한·기간을 다시 확인해요 |
| `lib/db.ts` | `ensureSchema()` 에 `campaigns` · `campaign_daily` 표 (CREATE TABLE IF NOT EXISTS, advisory lock 767022) |
| `app/actions.ts` | Server Action `createCampaign` · `updateCampaign` · `deleteCampaign` · `saveDaily` · `deleteDaily` — 로그인·권한·입력을 서버에서 다시 확인, `{ ok, message }` 를 돌려줘요 |
| `app/page.tsx` | 캠페인 비교 (전체 합계 · 검색 `?q=` · 정렬 `?sort=recent\|cpa\|ctr` · 30개씩 쪽 나눔 · 넓은 화면 표 / 좁은 화면 목록) |
| `app/campaigns/new/page.tsx` · `[id]/edit/page.tsx` | 캠페인 등록 · 고치기 (고치기는 등록한 사람·관리자만) |
| `app/campaigns/[id]/page.tsx` | 캠페인 상세 (합계 · 클릭/전환 선 차트 · 날짜별 입력과 기록) |
| `components/CampaignForm.tsx` · `DailyEditor.tsx` · `DeleteCampaignButton.tsx` | 브라우저 폼 — HeroUI 입력 · 확인 창(`useConfirm`) · 결과 알림(`toast`) / 오류(`Alert`) |
| `components/TrendChart.tsx` | 차트 라이브러리 없는 SVG 선 차트 (가로축 = 캠페인 기간 전체) |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 카드 · DB 미연결 경고 · 이전/다음 쪽 링크(검색어·정렬 유지) |
| `scripts/campaign-check.mjs` | `npm run check:logic` — `lib/campaign.ts` 를 바꾸면 돌려요 |

- **누가 무엇을**: 로그인한 사람은 모든 캠페인을 봐요(팀이 함께 비교하는 앱). 캠페인 정보·날짜별 기록을 고치고 지우는 건
  **등록한 사람(owner_key = axhub user_id) 또는 관리자(`me().is_admin`)** 만 — `lib/campaign.ts` 의 `canEdit()` 한 곳에서 판단하고,
  화면(버튼 숨김)과 `lib/campaign-store.ts`(트랜잭션 안) 양쪽에서 확인해요. 다른 사람에게 이 앱만의 관리 권한을 주는 법은 README "관리자는 누구인가요".
- **데이터 모델**:
  - `campaigns(id, name, channel, start_date, end_date, cost numeric(15,0) 원, owner_key, owner_name, created_at, updated_at)` — 기간 최대 366일.
  - `campaign_daily(campaign_id → campaigns ON DELETE CASCADE, day, impressions, clicks, conversions bigint, updated_at)` — 기본키 `(campaign_id, day)`, 같은 날짜는 덮어써요. `clicks <= impressions` 는 DB 제약으로도 막혀요.
  - 총 노출·클릭·전환, 클릭률(클릭÷노출×100), 전환당 비용(비용÷전환)은 **저장하지 않고** 매번 계산해요. 분모가 0 이면 `null` → 화면에 `–`.
- 날짜별 기록은 캠페인 기간 안에서만 저장돼요. 기간을 줄일 때 밖에 기록이 남아 있으면 `updateCampaign` 이 거절해요 (`FOR UPDATE` / `FOR SHARE` 로 동시 저장과 차례를 지켜요).
- 정렬은 `orderOf()` 의 정해진 세 SQL 조각 중에서만 골라요 — 주소의 값을 SQL 에 넣지 않아요.
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 날짜는 `date` 컬럼(시간대 없음). "오늘" 은 `kstToday()` (한국 시간) 기준.
