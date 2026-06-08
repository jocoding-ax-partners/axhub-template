# 시작용 프롬프트 모음

처음 vibe coding 할 때 그대로 복붙하거나 살짝 바꿔서 AI 한테 던져요.

## 1. 첫 화면 만들기

```
src/App.tsx 메인 화면을 [내가 만들고 싶은 서비스 한 줄 설명] 의 첫인상에 맞게 바꿔줘.
- 제목 큰 거 하나
- 설명 문단 하나
- 클릭 가능한 버튼 1개
- Tailwind 로 깔끔하게, 모바일에서도 안 깨지게
```

## 2. axhub 데이터 불러오는 컴포넌트

```
src/components/UserList.tsx 만들어줘. axhub Data plane 의 /users 리소스에서 사용자 목록을
가져와서 카드 그리드로 보여줘. lib/axhub.ts 의 브라우저 세션 헬퍼 `axhub.data` 사용. 로딩/에러 상태도 표시.
```

## 3. 폼 + 저장

```
src/components/FeedbackForm.tsx 만들어줘. 입력 → 제출 시 `axhub.data("feedback", { method: "POST", body })` 로
POST. 성공하면 "감사합니다" 토스트. 실패하면 에러 메시지.
```

## 4. 디자인 폴리싱

```
src/App.tsx 디자인을 "조코딩 AX 파트너스" 브랜드 톤에 맞게 다듬어줘.
색은 보라/파랑 계열, 폰트는 시스템 산세리프, 여백 넉넉하게, 모서리 부드럽게.
```

## 5. 배포 직전 체크리스트

```
배포 전에 점검:
- console.log 남은 거 있나?
- VITE_* 환경변수에 시크릿 들어간 거 있나? (위험)
- public/ 에 안 쓰는 이미지 있나?
- 빌드 잘 되나? (npm run build)
```
