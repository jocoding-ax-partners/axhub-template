# 경비 정산 앱 — 바로 쓰는 요청 모음

그대로 복붙하거나 [ ] 부분만 바꿔서 Claude 에게 던져요. 이 앱의 구조는 `CLAUDE.md` 의 "이 앱 — 경비 정산" 에 있어요.

## 1. 항목 바꾸기

```
경비 항목에 [숙박] 을 추가해줘. lib/expense-utils.ts 의 CATEGORIES 만 고치면 돼.
```

## 2. 반려 사유 받기

```
관리자가 반려할 때 사유를 한 줄 적게 해줘.
- expenses 테이블에 reject_reason 컬럼을 ALTER TABLE ... ADD COLUMN IF NOT EXISTS 로 추가
- 반려 버튼을 누르면 사유 입력 칸이 보이고, 비우면 반려가 안 되게
- 직원의 "내 경비" 목록에 반려 사유를 보여줘
```

## 3. 처리 결과 알림

```
경비가 승인되거나 반려되면 올린 직원에게 axhub 알림을 보내줘.
AXHUB.md §5 의 createAppMessagingClient() 를 쓰고, 받는 사람은 expenses.user_id 야.
알림 링크는 "/" 로.
```

## 4. 영수증 필수 조건

```
금액이 [300000] 원을 넘으면 영수증 사진 없이 올릴 수 없게 해줘.
화면에서 먼저 알려 주고, 서버(app/actions.ts)에서도 똑같이 막아줘.
```

## 5. 정산 CSV 늘리기

```
정산 CSV 에 직원별 항목별(식대/교통/소모품/기타) 승인 합계 열을 추가해줘.
엑셀에서 한글이 안 깨지게 지금처럼 lib/expense-utils.ts 의 toCsv() 를 써줘.
```

## 6. 배포 전 점검

```
배포 전에 점검해줘:
- npx tsc --noEmit, npm run lint, npm run check:design, npm run check:logic 이 모두 통과하나?
- 관리자 화면·CSV·승인 액션이 서버에서 isAppAdmin() 으로 막혀 있나?
- 영수증 사진을 공개 주소로 내보내는 곳이 없나? (app/receipts/[id]/route.ts 만 거쳐야 해)
- console.log 남은 거 있나?
```
