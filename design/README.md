# 디자인 정본

모든 템플릿(`nextjs-axhub` · `chatbot-axhub`)이 axhub 콘솔과 같은 모양으로 보이게 하는 파일들이에요.
**여기만 고치고 스크립트를 돌리세요.**

```bash
node scripts/sync-design.mjs          # 모든 템플릿에 반영
node scripts/sync-design.mjs --check  # 다르거나 옛 파일이 남아 있으면 실패 (CI)
bash scripts/check-design.sh          # 생색·생크기·다른 UI 키트 사용 검사
```

## 스택 (콘솔과 같음)

| 층 | 패키지 | 하는 일 |
|---|---|---|
| CSS 엔진 | `tailwindcss` ^4 + `@tailwindcss/postcss` | 유틸리티 클래스. 설정 파일(`tailwind.config.*`) 없음 |
| 컴포넌트 | `@heroui/react` ^3.2.4 (+ `@heroui/styles`) | Button · TextField · Select · Checkbox · Modal · Table · Card · Chip · Toast … |
| 모양·토큰 | `@jocoding-ax-partners/design-system` ^4.2.0 | CSS 만. HeroUI 를 콘솔처럼 다시 칠하고 의미 토큰(`bg-content` `text-muted` `t-small` …)을 등록 |
| 콘솔 조각 | `@jocoding-ax-partners/react` ^2.1.1 | TopBar · Sidebar · NavList · PageContainer · PageHeader · StatusDot · CodeBlock · `useConfirm` |
| 아이콘 | `@phosphor-icons/react` ^2 | 콘솔과 같은 아이콘 |

ag-grid(`@jocoding-ax-partners/react/ag-grid`)는 넣지 않았어요 — 표는 HeroUI `Table` 로 충분해요.

## 뿌리는 파일

| 정본 | 템플릿 안 위치 | 내용 |
|---|---|---|
| `design/axhub.css` | `app/axhub.css` | Tailwind 진입점. `@import "tailwindcss"` → `@import "@jocoding-ax-partners/design-system/styles"` → `@source` (react 패키지) + 폰트 + 바탕색 |
| `scripts/check-design.sh` | `scripts/check-design.sh` | 규칙 검사 (`axhub.yaml` 의 `ci.commands` 로 배포 전에 돌아요) |
| `shared/AXHUB.md` | `AXHUB.md` | axhub 기능 켜는 법 |

템플릿마다 **직접 갖는**(뿌리지 않는) 파일 — `nextjs-axhub` 것을 그대로 복사해서 시작해요.

| 파일 | 내용 |
|---|---|
| `app/globals.css` | `@import "./axhub.css";` 한 줄 + 그 템플릿에만 필요한 CSS |
| `postcss.config.mjs` | `@tailwindcss/postcss` 플러그인 하나 |
| `components/Providers.tsx` | `'use client'` — IconContext · I18nProvider(ko-KR) · ConfirmProvider · Toast.Provider |
| `components/ax.ts` | `'use client'` — `@jocoding-ax-partners/react` 재수출 (서버 컴포넌트에서 쓰려고) |
| `components/AppShell.tsx` · `components/Shell.tsx` | 셸 — 서버(로그인 정보) / 브라우저(TopBar·Sidebar·서랍) |
| `config/navigation.ts` | 사이드바 메뉴 (아이콘은 phosphor 컴포넌트) |

`--check` 는 Tailwind 3 시절 파일(`app/tokens.css` · `tailwind-preset.js` · `tailwind.config.*`)이 남아 있어도 실패해요.
스크립트는 지우지 않으니 옮길 때 손으로 지워요.

## 정한 것과 이유

- **`@heroui/styles` 를 따로 import 하지 않아요.** design-system 4.2.0 의 `styles` 가 맨 첫 줄에서 가져와요.
  콘솔 `globals.css` 는 4.1.0 시절이라 따로 적혀 있는데, 4.2.0 에서 두 번 쓰면 HeroUI CSS 가 두 번 들어가요.
- **`@source` 가 필요해요.** `@jocoding-ax-partners/react` 는 소스에 Tailwind 클래스를 써서 그려요.
  Tailwind 4 는 `node_modules` 를 훑지 않아 이 줄이 없으면 셸이 스타일 없이 나와요. HeroUI 는 미리 컴파일된 CSS 라 필요 없어요.
- **`@jocoding-ax-partners/react` 는 `@/components/ax` 를 거쳐 가져와요.** 그 패키지와 `@phosphor-icons/react` 는
  `'use client'` 표시가 없어서 서버 컴포넌트에서 import 하면 빌드가 깨져요(`createContext is not a function`).
  `components/ax.ts` 가 `'use client'` 경계예요. 서버 파일의 아이콘은 `@phosphor-icons/react/ssr` 에서 가져와요.
  `@heroui/react` 는 컴포넌트마다 `'use client'` 가 있어 서버 파일에서 그대로 써도 돼요 (`Card.Header` 같은 점 표기 포함).
- **버튼 모양의 링크는 `buttonVariants`.** HeroUI `Button` 은 `<button>` 이에요. 페이지 이동은
  `<Link className={buttonVariants({ variant: 'primary' })}>` — 서버 파일에서도 돼요.
- **카드·토스트 배경 교정 한 줄.** design-system 이 HeroUI `Card`·`Toast` 를 `bg-surface` 유틸로 칠하는데,
  그 이름이 페이지 바탕 토큰(`--bg-surface`)과 겹쳐 카드가 바탕과 같은 회색이 되고 토스트 글자가 안 보여요.
  콘솔 `globals.css` 와 같은 `.card--default, .toast { background-color: var(--surface) }` 를 `axhub.css` 에 둬요.
  패키지가 고쳐지면 지워요.
- **다크 모드는 `<html data-theme="dark">`.** design-system·HeroUI 둘 다 이 속성(또는 `.dark`)만 봐요.
  `app/layout.tsx` 의 한 줄 스크립트가 처음 그리기 전에 시스템 설정을 보고 붙여요. (켜 둔 채 OS 설정을 바꾸면 새로고침 후 반영)
- **셸은 콘솔 컴포넌트 그대로.** 상단바 60px · 사이드바 244px · 본문 최대 1280px · 반응형 좌우 여백은
  design-system 의 `--topbar-height` `--sidebar-width` `px-container` 와 `PageContainer` 가 정해요. 템플릿이 값을 따로 갖지 않아요.
- **폰트는 Pretendard CDN** (`app/layout.tsx`). 콘솔은 `pretendard` 패키지로 번들하지만, 템플릿은 의존성을 늘리지 않으려고 CDN 을 유지해요.

## 값의 출처

색·글자·모서리·간격 값은 전부 `node_modules/@jocoding-ax-partners/design-system/dist/styles/index.css` 에 있어요.
에이전트용 요약은 같은 패키지의 `llms.txt`. 이 레포에 값을 복사해 두지 않아요 (복사본은 갈라져요).
패키지 버전을 올리면 새로 만들어지는 앱이 그 시점 값을 받아요. 이미 배포된 앱까지 따라가게 할 필요는 없어요.

## 알아 둘 함정

- `.card--default` 바탕은 `@layer` 밖 규칙이라 유틸 클래스를 이겨요. `<Card className="bg-muted">` 는 바탕이 바뀌지 않아요 — 다른 바탕이 필요하면 `Card` 대신 `div` 에 의미 클래스를 쓰거나 `variant` 를 고르세요. 콘솔도 같아요.
- 서버 파일의 아이콘(`@phosphor-icons/react/ssr`)은 `IconContext` 를 못 읽어요. `size={16} weight="fill"` 을 직접 넘기세요.
