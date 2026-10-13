# 시작용 프롬프트 모음

이 앱(이벤트 참가 신청 관리)을 내 상황에 맞게 바꿀 때 그대로 복붙하거나 살짝 바꿔서 Claude 에게 던져요.
데이터 구조와 파일 위치는 [CLAUDE.md](../CLAUDE.md) 의 "이 앱" 절에 있어요.

## 1. 이벤트 수정 화면

```
이벤트 상세(app/events/[id]/page.tsx)에 "이벤트 정보 수정" 카드를 추가해줘.
이름·일시·장소·정원을 고칠 수 있게 하고, 저장은 app/actions.ts 에 updateEvent Server Action 으로.
createEvent 와 같은 검사 규칙을 쓰고, 정원은 지금 신청 인원보다 작게 줄일 수 없게 막아줘.
```

## 2. 명단 내려받기

```
이벤트 상세에 "명단 CSV 내려받기" 버튼을 만들어줘.
app/events/[id]/export/route.ts Route Handler 에서 담당자인지(lib/manager.ts 의 managerAccess) 확인하고,
이름·회사·이메일·출석 여부·출석 시각(한국 시간)을 엑셀에서 한글이 안 깨지게 UTF-8 BOM 을 붙여 내려줘.
```

## 3. 신청자 항목 추가

```
신청자에 연락처(전화번호) 칸을 추가해줘.
lib/db.ts 의 ensureSchema() 에 ALTER TABLE attendees ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '' 를 넣고,
한 명 등록 폼 · CSV 머리글('연락처', '전화번호') · 미리보기 표 · 명단에 함께 보여줘.
lib/applicants.ts 를 바꾸면 scripts/check-logic.mjs 에도 확인을 추가해줘.
```

## 4. 담당자 범위 넓히기

```
lib/manager.ts 를 고쳐서 이 앱에 초대된 사람(app_role 이 app_member)도 담당자로 쓸 수 있게 해줘.
화면 안내 문구(components/Gate.tsx)와 README 의 "누가 쓸 수 있나요" 도 맞춰 고쳐줘.
```

## 5. 안내 메일

```
이벤트 상세에 "신청자에게 안내 메일 보내기" 버튼을 만들어줘.
AXHUB.md §5 의 createAppMessagingClient() 를 쓰고, 보내기 전에 몇 명에게 가는지 확인을 받아줘.
```

## 6. 배포 직전 점검

```
배포 전에 점검해줘:
- npx tsc --noEmit · npm run lint · npm run check:design · npm run check:logic 이 모두 통과하나?
- 새로 만든 Server Action 마다 맨 앞에서 requireManager() 를 부르나?
- DB 쿼리에 사용자 입력을 문자열로 이어붙인 곳은 없나? (항상 db()`... ${값} ...`)
- 날짜·시간을 한국 시간(lib/format.ts)으로 보여주나?
```
