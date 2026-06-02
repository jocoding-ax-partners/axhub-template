# jocoding-ax-partners / axhub-template

조코딩 AX 파트너스 **axhub** 위에서 바로 굴러가는 바이브코딩 템플릿 모음이에요.
비전공자, 비개발자, 사무직, 기획자가 **Claude Code** 로 자연어로 부탁만 해도
배포까지 굴러가도록 디자인됐어요.

## 어떤 걸 골라야 하나

뇌 아프지 않게 한 줄로:

| 템플릿 | 언제 쓰면 좋아요 | Stack | 분류 |
|--------|-----------------|-------|------|
| [**nextjs-axhub**](./nextjs-axhub) | 풀스택 웹앱 (가장 흔한 선택) | Next 16 + React 19 + Tailwind 3 | 서버 (SSR) |
| [**vite-react-axhub**](./vite-react-axhub) | 정적 SPA (랜딩, 계산기, 도구) | Vite 7 + React 19 + Tailwind 3 | 브라우저 (정적) |
| [**astro-axhub**](./astro-axhub) | 콘텐츠 사이트 (블로그, 문서, 랜딩) | Astro 5 SSR + Node | 서버 (SSR) |

> 3종 모두 각자 **Dockerfile** 로 빌드돼요. axhub backend 는 repo 루트의 `Dockerfile` 로 이미지를 만들고, `axhub.yaml` 로 포트·헬스체크와 Dockerfile 우선순위를 고정해요. `apphub.yaml` 은 구버전 CLI 호환용으로만 남겨요.

처음이면 **`nextjs-axhub`** 부터 시작하세요. 가장 보편적이고 LLM 도 가장 잘 짜요.

## 5분 안에 시작

```bash
# 1) 원하는 템플릿만 내 컴퓨터로 가져오기
npx degit jocoding-ax-partners/axhub-template/nextjs-axhub my-app
cd my-app

# 2) 의존성 설치 (Node 20+ 필요)
npm install

# 3) (로컬 테스트용) 환경변수 채우기
cp .env.example .env.local    # vite / nextjs
# 또는
cp .env.example .env          # astro
# axhub 로 배포하면 이 값들은 자동 주입돼요 (아래 "설정 주입" 참고)

# 4) 로컬 서버 띄우기
npm run dev
```

`degit` 은 git 히스토리 없이 폴더만 가져와요 (`npm i -g degit` 으로 미리 설치하면 더 빨라요).

> 보통은 직접 가져올 필요 없이 axhub 웹에서 **[템플릿 + 앱 이름] 선택 → 한 클릭**이면 GitHub repo 생성 + 배포까지 끝나요.

## 바이브코딩 흐름

1. Claude Code 를 열어요.
2. "메인 페이지에 입력 폼이랑 결과 카드 넣어줘" 같은 자연어 요청을 던져요.
3. AI 가 적절한 파일을 고쳐요 (각 템플릿의 `prompts/getting-started.md` 참고).
4. 저장하면 브라우저가 자동 새로고침 → 결과 확인.
5. 마음에 들면 다음 기능, 안 들면 다시 부탁.

각 템플릿엔 다음이 미리 들어 있어요:

- **`Dockerfile`** — axhub 가 이걸로 빌드해요
- **`axhub.yaml`** — 포트·헬스체크, Dockerfile, 배포 방식 설정
- **`apphub.yaml`** — 구버전 CLI 호환용 legacy 설정
- **`.env.example`** — 로컬 테스트용 환경변수 템플릿
- **`lib/axhub.*`** — Hub API 호출 헬퍼 (Server / 브라우저 변형)
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

## 설정 주입 (axhub 가 알아서 채워줘요)

axhub bootstrap 으로 앱을 만들면, 템플릿 소스의 `{{...}}` placeholder 가 **빌드 시점에 실제 값으로 치환**돼요:

| placeholder | 치환값 | 용도 |
|------|--------|------|
| `{{API_BASE}}` | `https://axhub-api...` | Hub API origin |
| `{{APP_SLUG}}` | 내 앱 슬러그 | 앱 식별자 |
| `{{TENANT}}` | 내 테넌트 슬러그 | data API 경로 |
| `{{APP_ORIGIN}}` | `https://{앱}.{테넌트}...` | silent SSO return origin (브라우저) |

로컬에서 직접 돌릴 땐 `.env`(server) / `.env.local`(vite, `VITE_APPHUB_*`) 로 우선 채울 수 있어요.

> **인증엔 별도 API key 가 필요 없어요.** axhub 로그인 세션 쿠키(`_hub_access`)로 인증해요 — 아래 "신뢰 모델" 참고. `VITE_*` 변수는 빌드 결과물에 박히니 시크릿은 절대 넣지 마세요.

## 기여하기

새 템플릿을 추가하고 싶으세요?

1. repo 루트에 **`Dockerfile`** 이 있어 `docker build` 로 떠야 해요 (axhub 는 framework 자동생성 안 함 — Dockerfile 필수).
2. 다음 파일이 모두 있어야 해요:
   - `Dockerfile`, `axhub.yaml`, `.env.example`, `lib/axhub.*` (또는 동등 위치)
   - `CLAUDE.md`, `AGENTS.md`
   - `prompts/getting-started.md`
   - 한국어 `README.md`
3. 모든 문서는 한국어, vibe coder 친화적인 톤으로.
4. PR 보내주세요.

## FAQ

**Q. 템플릿이 왜 3개뿐?**
입문 vibe coder 가 헷갈리지 않게 가장 보편적인 3종(풀스택 Next / 정적 Vite SPA / 콘텐츠 Astro)만 유지해요. 초기엔 express/hono/remix 도 있었지만 정리했어요.

**Q. 다른 framework 도 axhub 에 올릴 수 있나요?**
네. repo 루트에 `Dockerfile` 만 있으면 돼요. axhub 가 그걸로 빌드해요. (`axhub.yaml` 로 포트/헬스체크와 Dockerfile 우선순위 조정)

**Q. Tailwind 4 가 있는데 왜 3?**
입문 vibe coder 에게 v3 자료가 더 많고, AI 가 v3 클래스를 더 정확히 짜요. (자세히는 [ADR-0001](./docs/adr/0001-version-floors.md))

**Q. AI 가 자꾸 server 전용 헬퍼를 클라이언트에서 쓰려 해요.**
각 템플릿의 `CLAUDE.md` / `AGENTS.md` 에 명확히 금지돼 있어요.
AI 가 무시하면 그 규칙을 다시 보여주면서 "이거 어겼다" 라고 알려주세요.

## axhub.ts 신뢰 모델 (3종 공통)

각 템플릿의 `axhub.ts` 헬퍼는 3종 모두 **동일한 외부 API** 를 노출해요:
`axhub.fetch(path)`, `axhub.data(resource)`, `axhub.slug`, `axhub.isConfigured`.
**다른 템플릿 코드를 복사해도 호환돼요.** (server 변형은 사용자 쿠키 전달용 인자를 더 받아요.)

**자격은 3종 모두 axhub 로그인 세션 JWT(`_hub_access` 쿠키)로 통일** — 정적 API key 안 써요.
차이는 그 자격을 *어떻게 싣느냐*뿐 (구조적 차이, 게으름 아님):

| 템플릿 | 위치 | 분류 | 인증 transport |
|--------|------|------|----------------|
| nextjs-axhub | `lib/axhub.ts` | server | 들어온 `_hub_access` 를 `Bearer` 로 포워딩 (`next/headers` `cookies()`) |
| astro-axhub | `src/lib/axhub.ts` | server | 들어온 `_hub_access` 를 `Bearer` 로 포워딩 (`Astro.request` 쿠키 전달) |
| **vite-react-axhub** | `src/lib/axhub.ts` | browser | `credentials:"include"` 쿠키 자동 전송 + 401 → silent SSO 재인증 |

**규칙:** 빌드 결과물엔 어떤 시크릿도 박지 않아요. 브라우저(`vite-react`)는 axhub 세션 쿠키로 직접 인증하므로 **별도 backend 가 필요 없어요**. 서버(`nextjs`/`astro`)는 진입 요청의 사용자 쿠키를 그대로 백엔드에 포워딩해 *그 사용자 자격*으로 호출해요.

## 라이선스

MIT — 자유롭게 쓰세요. 자세한 건 [LICENSE](./LICENSE).

---

조코딩 AX 파트너스 — 누구나 AI 로 만들 수 있는 세상.
