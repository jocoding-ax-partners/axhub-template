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

## 이 앱 (택배·우편 수령)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/parcel.ts` | 순수 규칙 — 종류 이름(`KIND_LABEL`), 담당자 판단 `isDesk`, 입력 검사 `validateParcel`, 이메일 정규화, 보관 일수(KST 날짜 기준) · 시각 표시 |
| `lib/parcel-store.ts` | DB 읽기·쓰기 전부. 목록은 30개씩 + 서버 검색(`?q=`). 수령·취소는 조건을 UPDATE/DELETE 의 WHERE 에 넣어 한 번만 처리돼요 |
| `lib/db.ts` | `ensureSchema()` 에 `parcels` 표 (CREATE TABLE IF NOT EXISTS, advisory lock 767026) |
| `app/actions.ts` | Server Action `registerParcel` · `receiveParcel` · `cancelParcel` — 로그인·담당자·입력을 서버에서 다시 확인 |
| `app/page.tsx` | 내 택배 (찾아갈 택배 · 받은 기록) |
| `app/desk/page.tsx` | 안내데스크 (현황 숫자 · 등록 폼 · 미수령/수령 완료 탭 · 검색). 담당자가 아니면 안내만 보여요 |
| `components/ParcelForm.tsx` · `ParcelAction.tsx` | 브라우저 폼 — 등록(`useActionState`) · 확인 창(`useConfirm`) 뒤 수령/등록 취소 · 결과 알림(`toast`) / 오류(`Alert`) |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 카드 · DB 미연결 경고 · 이전/다음 쪽 링크(검색어·탭 유지) |
| `scripts/parcel-check.mjs` | `npm run check:logic` — `lib/parcel.ts` 를 바꾸면 돌려요 |

- **담당자 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). `lib/parcel.ts` 의 `isDesk()` 한 곳에서만 판단해요.
  다른 사람에게 이 앱만의 담당자 권한을 주는 법은 README "담당자는 누구인가요".
- **받는 사람 = 이메일**. 담당자는 직원의 axhub user_id 를 모르니 이메일로 등록하고, 직원 화면은 `me().email` 을 소문자로 맞춰 찾아요.
  `recipient_email` 은 늘 소문자로 저장해요 (CHECK 제약).
- **수령 권한**: 받는 사람 본인(이메일 일치) 또는 담당자. `receiveParcel` 의 UPDATE WHERE 에 그 조건과 `received_at IS NULL` 이 같이 있어요.
- **데이터 모델**: `parcels(id, kind parcel|mail, recipient_email, recipient_name, sender, location, memo, arrived_at, registered_by_key, registered_by_name, received_at, received_by_key, received_by_name)`.
  미수령 = `received_at IS NULL`. 상태 컬럼을 따로 두지 않아요.
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE parcels ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 시각은 `formatDateTime()` 으로 KST 표시. "오늘 · n일째" 는 한국 날짜 기준(`daysWaiting`, SQL 은 `AT TIME ZONE 'Asia/Seoul'`).
