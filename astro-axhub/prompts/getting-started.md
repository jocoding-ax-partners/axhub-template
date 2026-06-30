# 시작용 프롬프트 모음

## 1. 새 페이지 만들기

```
src/pages/about.astro 만들어줘.
- Layout 사용
- 회사 소개 본문 (h1, p, ul)
- 모바일 친화 scoped CSS
- meta description 명시
```

## 2. 데이터 저장 SSR 페이지 (표준 Postgres)

```
src/pages/guestbook.astro 만들어줘.
- src/lib/db.ts 의 ensureSchema() 에 guestbook 테이블(user_key, message) 추가
- frontmatter 에서 Astro.request.method === "POST" 면 formData → db()`INSERT ...` → Astro.redirect("/guestbook") (PRG)
- GET 이면 db()`SELECT ... WHERE user_key = ${userKey}` 로 내 글 목록 조회 후 카드 렌더
- 로그인 사용자는 makeAxhub({ cookie }).identity.me() 로 (없으면 'local-dev')
```

## 3. API endpoint

```
src/pages/api/feedback.ts 만들어줘.
- POST: request.formData()(또는 JSON) 검증 후 src/lib/db.ts 의 db()`INSERT INTO feedback ...` 로 저장, JSON 응답
  (먼저 ensureSchema() 에 feedback 테이블 추가)
- GET: 405 Method Not Allowed
```

## 4. 마크다운 블로그

```
src/content/blog 폴더 + content collection 셋업해줘.
src/pages/blog/[...slug].astro 가 글 본문 렌더.
src/pages/blog/index.astro 가 목록.
모두 정적(prerender) 으로 빌드.
```

## 5. 배포 직전 체크리스트

```
배포 전 점검:
- output: "server" 인지
- adapter: node({ mode: "standalone" }) 인지
- 모든 axhub SDK 호출이 `src/lib/axhub-server.ts` 를 통해 frontmatter / API endpoint 안에서만 일어나는지
- console.log 남은 거
- npm run build 가 dist/server/entry.mjs 만드는지 확인
```
