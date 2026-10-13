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

## 이 앱 (시설 고장 신고)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/facility.ts` | 순수 규칙 — 상태 이름(`STATUS_LABEL`), 글자 수 상한, 사진 형식·크기, 입력 검사 `validateReport` · `validateUpdate`, 매직 바이트 `sniffImageType`, 담당자 판단 `isManager`, KST 시각 표시 |
| `lib/facility-store.ts` | DB 읽기·쓰기 전부. 목록은 30건씩 OFFSET 페이징 + ILIKE 검색, 담당자 저장은 `version` 으로 동시 수정을 막아요 |
| `lib/storage.ts` | 파일 저장소(S3 호환) 올리기·지우기·5분짜리 서명 주소 |
| `lib/db.ts` | `ensureSchema()` 에 `facility_reports` 표 (CREATE TABLE IF NOT EXISTS, advisory lock 767025) |
| `app/actions.ts` | Server Action `submitReport` · `saveHandling` — 로그인·담당자·입력·사진을 서버에서 다시 확인 |
| `app/page.tsx` | 고장 신고 (새 신고 폼 · 내 신고 목록) |
| `app/admin/page.tsx` | 신고 관리 (상태 탭 · 검색 · 상태/메모 저장). 담당자가 아니면 안내만 보여요 |
| `app/photos/[id]/route.ts` | 사진 보기 — 신고자 본인·담당자만, 서명 주소로 302 (남의 사진은 404) |
| `components/ReportForm.tsx` · `HandleForm.tsx` | 브라우저 폼 — HeroUI 입력 · 결과 알림(`toast`) / 오류(`Alert`) |
| `components/ReportItem.tsx` | 신고 한 건 본문(사진 썸네일 · 상태 점 · 처리 메모 · 시각) — 두 화면이 같이 써요 |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 카드 · DB 미연결 경고 · 이전/다음 쪽 링크(탭·검색어 유지) |
| `scripts/facility-check.mjs` | `npm run check:logic` — `lib/facility.ts` 를 바꾸면 돌려요 |

- **담당자 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). `lib/facility.ts` 의 `isManager()` 한 곳에서만 판단해요.
  화면(`app/admin`) · Server Action · 사진 주소 세 곳이 모두 이 함수를 써요. 다른 사람에게 이 앱만의 담당자 권한을 주는 법은 README "담당자는 누구인가요".
- **데이터 모델**: `facility_reports(id, reporter_key=axhub user_id, reporter_name, reporter_email, location ≤100, description ≤1000, photo_key null|'reports/<uuid>.<ext>', status received|in_progress|done, memo ≤1000, handled_by, handled_at, version, created_at)`.
  `version` 은 담당자가 저장할 때마다 +1 — `HandleForm` 이 화면을 그릴 때의 값을 보내고, 다르면 저장을 거절해요.
- 사진 열쇠(`photo_key`)는 화면에 내보내지 않아요 (`has_photo` 만). 사진은 항상 `/photos/<id>` 를 거쳐요. 저장에 실패하면 먼저 올린 사진을 지워요.
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE facility_reports ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 시각은 `formatDateTime()` 으로 KST 표시.
