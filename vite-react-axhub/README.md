# vite-react-axhub

axhub 위에서 바로 굴러가는 **Vite 7 + React 19 + Tailwind 3** 정적 SPA 템플릿이에요.
**Claude Code** 로 바이브코딩하면서 axhub 에 한 줄 명령으로 배포할 수 있게 미리 세팅돼 있어요.

## 0. 누가 쓰면 좋아요

비전공자, 비개발자, 기획자, 사무직, 디자이너. 서버 없는 **정적 클라이언트 SPA** 가 필요할 때.
랜딩 페이지, 계산기, 작은 도구, 데모 같은 거. 인증된 axhub 호출도 로그인 세션 쿠키로
**직접 돼요** (별도 backend 불필요).

## 1. 5분 안에 시작

```bash
npx degit jocoding-ax-partners/axhub-template/vite-react-axhub my-app
cd my-app
npm install
npm run setup          # .env.local 없으면 예시 복사
# .env.local 의 VITE_APPHUB_* 값을 채워요. (axhub 로 배포하면 자동 주입돼요)
npm run dev
# http://localhost:5173 에 접속
```

## 2. 바이브코딩 흐름

1. Claude Code 를 열어요.
2. "메인 페이지에 입력 폼이랑 결과 카드 넣어줘" 같은 자연어 요청.
3. AI 가 `src/App.tsx` 같은 파일을 고쳐요.
4. 저장 → HMR 자동 새로고침.

## 3. 개발(dev) 환경

로컬에서 `npm run dev` 로 도는 환경 이야기예요. 배포(프로덕션)와 뭐가 다른지도 여기서 정리해요.

### 3-1. 핫리로드 (HMR)

`npm run dev` 는 Vite dev 서버예요. 파일을 저장하면 **재시작 없이 즉시** 브라우저에 반영돼요
(React Fast Refresh — 컴포넌트 상태도 대부분 유지). 별도 설정 필요 없어요.

- 반영이 안 되거나 화면이 이상하게 꼬이면: dev 서버 끄고 `node_modules/.vite` 폴더 삭제 후 `npm run dev` 재시작.

### 3-2. dev vs 프로덕션

| | 로컬 dev (`npm run dev`) | 배포 (axhub) |
|---|---|---|
| 실행 방식 | Vite dev 서버 + HMR (포트 5173) | `npm run build` → `dist/` 를 nginx 가 정적 서빙 |
| 환경변수 | `.env.local` 의 `VITE_*` 를 dev 서버가 읽음 | 소스의 `{{...}}` placeholder 치환 후 **빌드 시** 박힘 |
| 타입 체크 | HMR 은 타입 에러가 있어도 화면 반영됨 | `npm run build` 의 `tsc -b` 에서 실패 — 배포 전 꼭 한 번 돌려보세요 |

- 이 템플릿은 **정적 SPA 라 자체 DB 가 없어요** — 데이터 저장이 필요하면 서버 템플릿(`nextjs-axhub` / `astro-axhub`)을 쓰세요.
- `VITE_*` 값은 빌드 결과물에 그대로 박혀요 — dev 에서 `.env.local` 을 바꿨으면 dev 서버 재시작이 필요할 수 있어요.
- 배포 전에 프로덕션 빌드를 미리 확인하고 싶으면: `npm run build && npm run preview`.

## 4. axhub Hub API 쓰기 (브라우저 전용 세션 fetch 헬퍼)

```ts
// src/components/Welcome.tsx
import { useEffect, useState } from "react";
import { axhub } from "../lib/axhub";

export function Welcome() {
  const [me, setMe] = useState<{ user: { name: string; email: string } } | null>(null);
  useEffect(() => {
    axhub.fetch("/api/v1/me").then((r) => r.json()).then(setMe);
  }, []);
  return <p>{me ? `환영합니다, ${me.user.name}님` : "불러오는 중…"}</p>;
}
```

> 🟡 이 템플릿은 **정적 SPA** 라 자체 데이터베이스가 없어요. 데이터 저장/조회가 필요하면
> 서버 템플릿(`nextjs-axhub` / `astro-axhub`)을 쓰세요 — 거기선 표준 Postgres 를 써요.
> 이 템플릿이 제공하는 건 **인증/식별**(누가 로그인했는지)뿐이에요.

> ⚠️ Vite 의 `VITE_*` 환경변수는 **빌드 결과물에 그대로 박혀요.** 절대 시크릿 넣지 마요.
> 인증은 axhub 로그인 세션 쿠키(`credentials:"include"`)로 동작해요 — API key 가 필요 없어요. 이 정적 SPA 는 `@ax-hub/sdk` 같은 서버용 SDK 를 브라우저 번들에 넣지 않습니다.
> 401(미로그인/만료) 이면 헬퍼가 자동으로 silent SSO 로 재인증해요.

## 5. axhub 에 배포

### A. Claude Code 사용자

```
/axhub:deploy
```

### B. CLI 직접

```bash
axhub apps
axhub deploy create --app my-app-slug --branch main
axhub deploy status dep_xxxxx --watch
```

빌드된 `dist/` 가 axhub 에서 `Dockerfile` 의 nginx 로 정적 서빙돼요 (SPA fallback 포함).

`axhub.yaml` 을 새로 쓰거나 고칠 때는 `axhub.yaml.example` 에 axhub.yaml 에서 쓸 수 있는 필드와 제약을 모두 적어뒀으니 먼저 참고하세요.

## 6. 환경변수 / 설정

| 변수 | 용도 |
|------|------|
| `VITE_APPHUB_API_URL` | Hub API origin (`{{API_BASE}}`) |
| `VITE_APPHUB_APP_SLUG` | 내 앱 슬러그 (`{{APP_SLUG}}`) |
| `VITE_APPHUB_APP_ORIGIN` | 이 앱 origin — silent SSO return (`{{APP_ORIGIN}}`) |

axhub 로 배포하면 위 값들은 소스의 `{{...}}` placeholder 치환으로 **자동 주입**돼요. `.env.local` 은 로컬 테스트용 override 일 뿐. API key 는 없어요 — 인증은 세션 쿠키로.

## 7. 자주 막히는 곳

| 증상 | 해결 |
|------|------|
| `npm install` 실패 | Node 20+ 인지 `node -v` 확인 |
| 저장해도 화면에 반영이 안 됨 | dev 서버 끄고 `node_modules/.vite` 삭제 후 `npm run dev` 재시작 (§3-1) |
| Tailwind class 가 안 먹음 | `tailwind.config.js` 의 `content` 경로 확인 |
| axhub 호출이 계속 401 / 로그인 루프 | axhub 에 로그인됐는지 확인. 헬퍼가 silent SSO 로 자동 재인증 시도 |
| 화면이 빈 흰색 | 콘솔 열어서 에러 확인. 보통 import 경로 오타 |

## 8. 관련 자료

- [axhub 가이드](https://github.com/jocoding-ax-partners/axhub)
- [Vite docs](https://vitejs.dev)
- [Tailwind 3 docs](https://v3.tailwindcss.com)

## axhub.ts 신뢰 모델 (이 템플릿)

이 (Vite + React) 템플릿은 **browser-side**. axhub 헬퍼는 브라우저 전용 세션 fetch 헬퍼로
`axhub.fetch / slug / isConfigured` 를 노출해요. **자체 DB 없음(정적 SPA)** — 데이터가 필요하면 서버 템플릿(nextjs/astro, 표준 Postgres)을 써요. 인증은 axhub 로그인 세션 쿠키(`_hub_access`)로:
이 템플릿은 `credentials: "include"` 로 쿠키를 자동 전송하고, 401 이면 silent SSO 로 재인증해요.
**시크릿 키 미주입** — 브라우저라 별도 backend 없이 직접 인증돼요.
풀 비교 표는 [axhub-template README](../README.md#axhubts-신뢰-모델-3종-공통) 참고.

## 9. 라이선스

MIT
