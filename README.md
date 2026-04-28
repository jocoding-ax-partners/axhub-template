# jocoding-ax-partners / examples

조코딩 AX 파트너스 **axhub** 위에서 바로 굴러가는 바이브코딩 템플릿 모음이에요.
비전공자, 비개발자, 사무직, 기획자가 **Claude Code** 로 자연어로 부탁만 해도
배포까지 굴러가도록 디자인됐어요.

## 어떤 걸 골라야 하나

뇌 아프지 않게 한 줄로:

| 템플릿 | 언제 쓰면 좋아요 | Stack | 자동 감지 |
|--------|-----------------|-------|-----------|
| [**nextjs-axhub**](./nextjs-axhub) | 풀스택 웹앱 (가장 흔한 선택) | Next 16 + React 19 + Tailwind 3 | ✅ |
| [**vite-react-axhub**](./vite-react-axhub) | 정적 SPA (랜딩, 계산기, 도구) | Vite 5 + React 18 + Tailwind 3 | ✅ |
| [**express-axhub**](./express-axhub) | 가벼운 Node 서버 (순수 JS) | Express 5 + Node 20 | ✅ |
| [**remix-axhub**](./remix-axhub) | SSR + 폼 액션 풀스택 | Remix 2 + React 18 | apphub.yaml |
| [**astro-axhub**](./astro-axhub) | 콘텐츠 사이트 (블로그, 문서, 랜딩) | Astro 5 SSR + Node | apphub.yaml |
| [**hono-axhub**](./hono-axhub) | 가벼운 API 서버 (TypeScript) | Hono 4 + @hono/node-server | apphub.yaml |

> **자동 감지 ✅** = axhub backend 가 `package.json` 보고 자동으로 빌드 환경 잡아줘요.
> **apphub.yaml** = 템플릿에 명시적인 빌드/시작 설정이 들어 있어서 그대로 동작해요.

처음이면 **`nextjs-axhub`** 부터 시작하세요. 가장 보편적이고 LLM 도 가장 잘 짜요.

## 5분 안에 시작

```bash
# 1) 원하는 템플릿만 내 컴퓨터로 가져오기
npx degit jocoding-ax-partners/examples/nextjs-axhub my-app
cd my-app

# 2) 의존성 설치 (Node 20+ 필요)
npm install

# 3) 환경변수 채우기
cp .env.example .env.local   # nextjs/vite/remix/astro
# 또는
cp .env.example .env          # express/hono
# 파일 열어서 APPHUB_* 값을 axhub 콘솔에서 복사해 채워요

# 4) 로컬 서버 띄우기
npm run dev
```

`degit` 은 git 히스토리 없이 폴더만 가져와요 (`npm i -g degit` 으로 미리 설치하면 더 빨라요).

## 바이브코딩 흐름

1. Claude Code 를 열어요.
2. "메인 페이지에 입력 폼이랑 결과 카드 넣어줘" 같은 자연어 요청을 던져요.
3. AI 가 적절한 파일을 고쳐요 (각 템플릿의 `prompts/getting-started.md` 참고).
4. 저장하면 브라우저가 자동 새로고침 → 결과 확인.
5. 마음에 들면 다음 기능, 안 들면 다시 부탁.

각 템플릿엔 다음이 미리 들어 있어요:

- **`apphub.yaml`** — axhub 배포 설정
- **`.env.example`** — 환경변수 템플릿
- **`lib/axhub.*`** — Hub API 호출 헬퍼 (Server-side / 브라우저 변형)
- **`CLAUDE.md`** — Claude Code 가이드 / 행동 규칙
- **`AGENTS.md`** — AI 에이전트 공통 규칙
- **`prompts/`** — 시작용 프롬프트 모음 (한국어)

## axhub 에 배포

### A. Claude Code 사용자 (가장 쉬움)

```
/axhub:deploy
```

배포 미리보기 카드 → 동의 → 끝. 한국어로 진행 상황을 알려줘요.

### B. CLI 직접

```bash
# 한 번만: axhub 콘솔에서 앱 등록 후 슬러그 복사
axhub apps                                            # 내 앱 목록
axhub deploy create --app my-app-slug --branch main   # 배포
axhub deploy status dep_xxxxx --watch                 # 진행 상황 보기
```

자세한 건 [axhub 가이드](https://github.com/jocoding-ax-partners/axhub) 참고.

## 환경변수 규약

axhub 가 빌드 시 자동 주입해주는 값들:

| 변수 | 어디서 노출되나 | 용도 |
|------|----------------|------|
| `APPHUB_API_URL` | Server only | Hub API endpoint |
| `APPHUB_API_KEY` | Server only (절대 클라이언트 노출 금지) | Hub API 인증 |
| `APPHUB_APP_SLUG` | Server / 일부 클라이언트 | 내 앱 식별자 |
| `APPHUB_DATA_BASE_URL` | Server | Data plane base URL |
| `VITE_APPHUB_*` | 브라우저 노출됨 | Vite SPA 전용 (시크릿 절대 금지) |

> ⚠️ **`VITE_*` 변수는 빌드 결과물에 박혀요.** 시크릿(API_KEY) 절대 넣지 마세요.
> 시크릿이 필요하면 `express-axhub` 또는 `hono-axhub` 같은 server-side 템플릿을 같이 쓰세요.

## 기여하기

새 템플릿을 추가하고 싶으세요?

1. axhub backend 의 framework preset (`nextjs`/`vite`/`express`) 중 하나에 매칭되거나,
   `apphub.yaml` 로 명시적 build/start 설정이 가능해야 해요.
2. 다음 파일이 모두 있어야 해요:
   - `apphub.yaml`, `.env.example`, `lib/axhub.*` (또는 동등 위치)
   - `CLAUDE.md`, `AGENTS.md`
   - `prompts/getting-started.md`
   - 한국어 `README.md`
3. 모든 문서는 한국어, vibe coder 친화적인 톤으로.
4. PR 보내주세요.

## FAQ

**Q. 왜 7개 템플릿이 아니고 6개?**
nestjs 는 ① Vercel boilerplates 에 없고 ② 데코레이터/DI/모듈 같은 enterprise 패턴이라
사무원 vibe coder 한테 과잉이에요.

**Q. 다른 framework 도 axhub 에 올릴 수 있나요?**
네. axhub backend 가 `package.json` 의 `next`/`vite`/`express` 의존성을 자동 감지해요.
이 외엔 `apphub.yaml` 에 `build.start` 를 명시하면 돼요. (`remix`/`astro`/`hono` 가 그 예)

**Q. Tailwind 4 가 있는데 왜 3?**
Vercel 보일러플레이트 원본이 Tailwind 3 이고, vibe coder 입문자에게 v3 자료가 더 많아요.

**Q. AI 가 자꾸 "use client" 컴포넌트에서 axhub 호출하려 해요.**
각 템플릿의 `CLAUDE.md` / `AGENTS.md` 에 명확히 금지돼 있어요.
AI 가 무시하면 그 규칙을 다시 보여주면서 "이거 어겼다" 라고 알려주세요.

## 라이선스

MIT — 자유롭게 쓰세요. 자세한 건 [LICENSE](./LICENSE).

---

조코딩 AX 파트너스 — 누구나 AI 로 만들 수 있는 세상.
