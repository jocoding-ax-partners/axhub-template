# 시작용 프롬프트 모음

처음 vibe coding 할 때 그대로 복붙하거나 살짝 바꿔서 AI 한테 던져요.

## 0. 챗봇 성격 바꾸기 (가장 먼저)

```
config/assistant.ts 를 고쳐줘.
- 이름: "인사팀 도우미"
- 역할: 우리 회사 휴가·출장 규정만 답하고, 그 밖의 질문은 정중히 인사팀 메일로 안내
- 말투: 존댓말, 세 문장 이내
- 예시 질문 3개도 이 역할에 맞게
```

## 0-1. 규정 문서를 근거로 답하게

```
아래 규정 문서를 data/policy.md 로 저장하고, app/api/chat/route.ts 에서 읽어서
system 프롬프트 뒤에 붙여줘. 문서에 없는 내용은 "규정에 없어요" 라고 답하게 해줘.
같은 문서를 매번 보내니까 캐시(cache_control)도 걸어줘.
[규정 문서 붙여넣기]
```

## 0-2. 여러 기기에서 대화 이어 보기 (DB 켜기)

```
지금은 대화가 이 브라우저에만 저장돼. 다른 컴퓨터에서도 내 대화가 보이게 DB 에 저장해줘.
AGENTS.md 의 "대화 저장하기" 순서대로 하고, 내가 해야 하는 일(DB 켜기)은 먼저 알려줘.
```

## 1. 첫 화면 만들기

```
app/page.tsx 메인 화면을 [내가 만들고 싶은 서비스 한 줄 설명] 의 첫인상에 맞게 바꿔줘.
- 제목 큰 거 하나
- 설명 문단 하나
- 클릭 가능한 버튼 1개 (눌러도 아직 동작 안 해도 됨)
- Tailwind 로 깔끔하게, 모바일에서도 안 깨지게
```

## 2. axhub Hub API 호출하는 페이지

```
/me 라우트 만들어줘. lib/axhub-server.ts 의 me() 를 Server Component 에서 호출해서
로그인 사용자 정보(이름·이메일·app_role)를 카드로 보여줘.
로그인 안 했으면(authenticated=false) 오류 대신 loginUrl('/') 로 가는 로그인 버튼을 보여줘.
```

## 3. 입력 폼 + 저장 (앱 데이터 = 표준 Postgres)

```
app/feedback 라우트에 피드백 입력 폼 만들어줘. Server Action 으로 lib/db.ts 의 db() 를 써서
Postgres 에 저장해줘. 먼저 lib/db.ts 의 ensureSchema() 에 feedback 테이블을
(CREATE TABLE IF NOT EXISTS feedback (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_key text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()))
추가하고, insert 는 db()`INSERT INTO feedback (user_key, message) VALUES (${userKey}, ${message})`.
userKey 는 me() 의 email (익명은 'anonymous', 로컬은 'local-dev'). 저장 성공하면 "감사합니다" 표시.
```

## 3-A. Gateway query — 외부 DB 조회 페이지

```
app/employees 라우트 만들어줘. lib/axhub-server.ts 의 queryConnector() 로
const res = await queryConnector({ connector: "my-db",
sql: "SELECT id, name FROM employees WHERE active = $1 LIMIT $2", params: [true, 20] })
(placeholder 는 postgres 네이티브 $n — '?' 는 백엔드에서 500 으로 떨어져)
호출해서 res.rows 를 테이블로 렌더. connector 는 "이름" 으로 넘기면 helper 가 grant·session·UUID 를 자동 처리해.
connector / sql 은 코드 상수로 (사용자 입력은 반드시 params 로). 정책 deny 는 throw 라 try/catch 로 안내.
AxHubError 는 .code 로 분기 (PermissionDeniedError / UnauthenticatedError).
(이 앱 자체 데이터 저장은 위 3번 — lib/db.ts Postgres. gateway 는 *외부* DB 읽기 전용.)
```

## 4. 디자인 폴리싱

```
app/page.tsx 디자인을 "조코딩 AX 파트너스" 브랜드 톤에 맞게 다듬어줘.
색은 보라/파랑 계열, 폰트는 시스템 산세리프, 여백 넉넉하게, 모서리 부드럽게.
```

## 5. 배포 직전 체크리스트

```
배포 전에 점검해줘:
- console.log 남은 거 있나?
- 환경변수 미설정인 곳에서 죽는 코드 있나?
- "use client" 컴포넌트가 lib/axhub-server.ts 나 lib/ai.ts 를 import 하는 곳 있나? (위험 — 서버 전용, API 키 유출)
- 배포한 앱에 ANTHROPIC_API_KEY 를 axhub env 로 넣었나?
- raw fetch 로 api.axhub.ai 를 직접 호출하는 곳 있나? (반드시 SDK 경유)
- 모듈 최상단에서 new AxHubClient() 캐싱하는 곳 있나? (사용자 자격 누설 위험)
- AxHubError.message 한국어 문자열로 분기하는 곳 있나? (.code/.category 만)
- public/ 에 안 쓰는 이미지 있나?
```
