# 시작용 프롬프트 모음

## 1. 새 페이지 만들기

```
src/pages/about.astro 만들어줘.
- Layout 사용
- 회사 소개 본문 (h1, p, ul)
- 모바일 친화 scoped CSS
- meta description 명시
```

## 2. 동적 SSR 페이지

```
src/pages/users/[id].astro 만들어줘.
- frontmatter 에서 `table<User>("users", { cookie }).list({ where: where("id").eq(Astro.params.id!), limit: 1 })` 패턴으로 SDK 호출
- 결과 없으면 404 반환
- 있으면 카드 형태 렌더
```

## 3. API endpoint

```
src/pages/api/feedback.ts 만들어줘.
- POST: 본문 검증 후 `table("feedback", { cookie: request.headers.get("cookie") }).insert(...)` 로 저장, JSON 응답
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
