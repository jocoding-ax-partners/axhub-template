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

## 이 앱 (고객 설문)

고칠 때 아래 구조를 지켜요. 사용자용 설명은 README.md 에 있어요.

| 파일 | 하는 일 |
|---|---|
| `lib/survey.ts` | 순수 규칙 — 길이·개수 상한, 종류·상태 이름, 담당자 판단 `isManager`, 설문 검사 `validateSurvey`, 응답 검사 `validateAnswers`, 비율 `percent`, KST 시각 표시 |
| `lib/survey-store.ts` | DB 읽기·쓰기 전부. 목록은 30개씩 쪽 나눔 + 제목/답 검색(ILIKE, % _ 이스케이프). 결과 집계는 GROUP BY. 응답 저장은 트랜잭션 안에서 상태·문항을 다시 읽어요 |
| `lib/db.ts` | `ensureSchema()` 에 표 4개 (CREATE TABLE IF NOT EXISTS, `pg_advisory_lock(767023)`) |
| `app/actions.ts` | Server Action `createSurvey` · `submitResponse` · `setSurveyStatus` · `deleteSurvey` — 로그인·담당자·입력을 서버에서 다시 확인, `{ ok, message }` 를 돌려줘요 |
| `app/page.tsx` | 설문 응답 — 진행 중인 설문 목록(응답 전 먼저), 검색 |
| `app/s/[id]/page.tsx` | 응답 화면 — 응답 폼 / 응답함 / 마감 안내 |
| `app/admin/page.tsx` · `admin/new/page.tsx` | 설문 관리 목록(검색·쪽) · 새 설문. 관리자가 아니면 안내만 보여요 |
| `app/admin/surveys/[id]/page.tsx` | 결과 — 요약 숫자, 응답 링크 복사, 마감·다시 열기·삭제, 객관식 막대(`Meter`), 주관식 최근 5개 |
| `app/admin/surveys/[id]/questions/[qid]/page.tsx` | 주관식 한 문항의 답 전부 (검색·쪽) |
| `components/SurveyBuilder.tsx` · `ResponseForm.tsx` · `SurveyActions.tsx` | 브라우저 폼 — HeroUI 입력 · 확인 창(`useConfirm`) · 결과 알림(`toast`) / 오류(`Alert`) |
| `components/Notices.tsx` · `Pager.tsx` | 로그인 안내 · 담당자 전용 안내 · DB 미연결 경고 · 이전/다음 쪽 링크(검색어 유지) |
| `scripts/survey-check.mjs` | `npm run check:logic` — `lib/survey.ts` 를 바꾸면 돌려요 |

- **담당자 = `me().is_admin`** (앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자). `lib/survey.ts` 의 `isManager()` 한 곳에서만 판단해요. 다른 사람에게 이 앱만의 담당 권한을 주는 법은 README "관리자는 누구인가요".
- **데이터 모델**:
  `surveys(id, title, description, status open|closed, created_by_key, created_by_name, created_at, closed_at)` ·
  `survey_questions(id, survey_id→surveys CASCADE, position, kind choice|text, prompt, options text[], UNIQUE(survey_id, position))` ·
  `survey_responses(id, survey_id→surveys CASCADE, user_key=axhub user_id, created_at, UNIQUE(survey_id, user_key))` ·
  `survey_answers(response_id→responses CASCADE, question_id→questions CASCADE, choice int | text_value text — 둘 중 하나만, PK(response_id, question_id))`.
- 한 사람당 한 번은 `UNIQUE(survey_id, user_key)` + `ON CONFLICT DO NOTHING` 이 지켜요. 객관식 답은 보기 **번호**(0부터)로 저장해요 — 문항을 만든 뒤 고치는 화면이 없는 이유예요(번호가 어긋나요).
- 결과 화면에 응답자 이름을 보여 주지 않아요(익명 집계). 이름이 필요하면 README 에 그 사실을 먼저 알려야 해요.
- 컬럼을 더할 땐 `ensureSchema()` 에 `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` 를 더해요 (이미 배포된 DB 에도 적용되게).
- 시각은 `formatDateTime()` 으로 KST 표시.
