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

## 이 앱 (디자인 요청 접수)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/design.ts` | 순수 규칙 — 종류·단계 이름, 입력 검사 `validateRequest`, 단계 이동 `NEXT_STATUS` · `statusChangeError`, 파일 형식 판별 `sniffFileType` · 크기 제한, 디자이너 판단 `isDesigner`, KST 날짜 표시 |
| `lib/design-store.ts` | DB 읽기·쓰기 전부. 목록은 30개씩 쪽 나눔 + 서버 검색(`q`). 단계·결과물 변경은 트랜잭션 + `FOR UPDATE` 로 담당자·단계를 다시 확인해요 |
| `lib/storage.ts` | axhub 파일 저장소(S3 호환) 올리기 · 지우기 · 5분짜리 임시 주소 |
| `lib/db.ts` | `ensureSchema()` 에 `design_requests` · `design_files` 표 (CREATE TABLE IF NOT EXISTS, advisory lock 767024) |
| `app/actions.ts` | Server Action `submitRequest` · `cancelRequest` · `takeRequest` · `changeStatus` · `uploadResults` · `deleteResult` — 로그인·디자이너·입력을 서버에서 다시 확인하고 `{ ok, message }` 로 돌려줘요 |
| `app/page.tsx` | 내 요청 (단계별 숫자 · 검색 · 목록) |
| `app/new/page.tsx` | 새 요청 폼 |
| `app/manage/page.tsx` | 요청 관리 (단계 탭 · 검색 · 마감 급한 순). 디자이너가 아니면 안내만 보여요 |
| `app/requests/[id]/page.tsx` | 요청 상세 (진행 단계 · 맡기/이어받기 · 단계 버튼 · 파일 · 결과물 올리기). 요청자 본인과 디자이너만 |
| `app/files/[id]/route.ts` | 파일 열기 — 권한 확인 뒤 임시 주소로 302. 남의 파일은 404 |
| `components/RequestForm.tsx` · `ResultUploadForm.tsx` · `FileInput.tsx` | 브라우저 폼 — 파일 수·크기를 먼저 알려 주고 서버가 다시 검사해요 |
| `components/ActionForm.tsx` · `ConfirmButton.tsx` · `CancelRequestButton.tsx` | 작은 버튼 폼 · 확인창(`useConfirm`) |
| `components/RequestList.tsx` · `FileList.tsx` | 목록 줄 · 단계 표시 · 마감 표시 · 검색칸 / 파일 목록 |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 카드 · DB 미연결 경고 · 이전/다음 쪽 링크(검색어·단계 유지) |
| `scripts/design-check.mjs` | `npm run check:logic` — `lib/design.ts` 를 바꾸면 돌려요 |

- **디자이너 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). `lib/design.ts` 의 `isDesigner()` 한 곳에서만 판단해요.
  단계 변경 · 결과물은 **맡은 디자이너(designer_key = user_id)** 만 할 수 있어요. 다른 디자이너는 먼저 이어받아요.
- **데이터 모델**
  - `design_requests(id, requester_key=axhub user_id, requester_name, requester_email, kind banner|detail|sns|etc, size, copy_text, due_date date, status received|in_progress|review|done, designer_key, designer_name, created_at, updated_at)`
  - `design_files(id, request_id → design_requests ON DELETE CASCADE, role reference|result, storage_key UNIQUE, file_name, content_type, size_bytes, uploaded_by, created_at)`
- 파일은 **내용(매직 바이트)** 으로 형식을 확인하고, 저장소 열쇠는 `design/<uuid>.<확장자>` — 사용자 파일 이름은 경로에 쓰지 않아요. 원래 이름은 `file_name` 에만 둬요.
  DB 저장에 실패하면 먼저 올린 파일을 지워요. 형식을 늘리려면 `FILE_TYPES` · `sniffFileType` · `FILE_ACCEPT` 를 같이 고쳐요 (SVG · HTML 은 스크립트가 들 수 있어 받지 않아요).
- 한 번에 올리는 크기(`UPLOAD_MAX_BYTES` 50MB)를 바꾸면 `next.config.ts` 의 `bodySizeLimit` 도 같이 바꿔요.
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 날짜는 `date` 컬럼(시간대 없음), 시각은 `formatDateTime()` 으로 KST 표시. "오늘" 은 `kstToday()` 기준.
