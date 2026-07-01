# 시작용 프롬프트 모음

처음 vibe coding 할 때 그대로 복붙하거나 살짝 바꿔서 AI 한테 던져요.

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
/me 라우트 만들어줘. @ax-hub/sdk 3.x 의 sdk.identity.me 를 Server Component 에서 호출해서
로그인 사용자 정보 + 소속 tenant 목록을 카드로 보여줘.
lib/axhub-server.ts 의 makeAxhub() 사용. 에러는 AxHubError.code 로 분기.
```

## 3. 입력 폼 + 저장 (앱 데이터 · raw-db)

```
app/feedback 라우트에 피드백 입력 폼 만들어줘. 먼저 db/migrations 에 feedback 테이블 SQL
(owner_id uuid not null 포함) 을 추가하고, Server Action 에서 lib/data.ts 의
const ownerId = await currentUserId(); await ownedTable('feedback', ownerId).insert({ ... }) 로 저장.
(ownedTable 이 owner_id 를 자동으로 넣고 필터해줘 — 내 데이터만 보여.)
저장 성공하면 "감사합니다" 토스트 띄워줘.
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
```

## 3-B. 필터된 목록 — raw-db 커스텀 쿼리

```
app/orders 라우트에 결제 완료 + 금액 100 이상 "내" 주문만 보여주는 페이지.
먼저 db/migrations 에 orders 테이블 SQL (owner_id uuid not null 포함) 추가.
lib/data.ts 의 query() 로 조회 — 항상 parameterized $n, owner_id 필터 필수:
const ownerId = await currentUserId();
const { rows } = await query("SELECT id, total FROM orders WHERE owner_id = $1 AND status = $2 AND total >= $3 ORDER BY total DESC LIMIT $4", [ownerId, "paid", 100, 50]);
rows 를 테이블로 렌더. LIMIT/OFFSET 으로 페이지네이션.
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
- "use client" 컴포넌트가 lib/axhub-server.ts import 하는 곳 있나? (위험 — 서버 전용)
- raw fetch 로 api.axhub.ai 를 직접 호출하는 곳 있나? (반드시 SDK 경유)
- 모듈 최상단에서 new AxHubClient() 캐싱하는 곳 있나? (사용자 자격 누설 위험)
- AxHubError.message 한국어 문자열로 분기하는 곳 있나? (.code/.category 만)
- public/ 에 안 쓰는 이미지 있나?
```
