# vite-react-axhub

axhub 위에서 바로 굴러가는 **Vite + React 18 + Tailwind 3** 정적 SPA 템플릿이에요.
**Claude Code** 로 바이브코딩하면서 axhub 에 한 줄 명령으로 배포할 수 있게 미리 세팅돼 있어요.

## 0. 누가 쓰면 좋아요

비전공자, 비개발자, 기획자, 사무직, 디자이너. 서버 없는 **정적 클라이언트 SPA** 가 필요할 때.
랜딩 페이지, 계산기, 작은 도구, 데모 같은 거. 백엔드 시크릿이 필요한 작업은
[express-axhub](../express-axhub) 같은 server-side 템플릿을 같이 써요.

## 1. 5분 안에 시작

```bash
npx degit jocoding-ax-partners/examples/vite-react-axhub my-app
cd my-app
npm install
cp .env.example .env.local
# .env.local 의 VITE_APPHUB_* 값을 채워요.
npm run dev
# http://localhost:5173 에 접속
```

## 2. 바이브코딩 흐름

1. Claude Code 를 열어요.
2. "메인 페이지에 입력 폼이랑 결과 카드 넣어줘" 같은 자연어 요청.
3. AI 가 `src/App.tsx` 같은 파일을 고쳐요.
4. 저장 → HMR 자동 새로고침.

## 3. axhub Hub API 쓰기

```ts
// src/components/UserList.tsx
import { useEffect, useState } from "react";
import { axhub } from "../lib/axhub";

export function UserList() {
  const [users, setUsers] = useState<unknown[]>([]);
  useEffect(() => {
    axhub.data("/users").then((r) => r.json()).then(setUsers);
  }, []);
  return <pre>{JSON.stringify(users, null, 2)}</pre>;
}
```

> ⚠️ Vite 의 `VITE_*` 환경변수는 **빌드 결과물에 그대로 박혀요.** 절대 시크릿(API_KEY) 넣지 마요.
> 시크릿이 필요하면 [express-axhub](../express-axhub) 같은 backend 를 두고 거기서 호출해요.

## 4. axhub 에 배포

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

빌드된 `dist/` 가 axhub 에서 nginx 로 정적 서빙돼요.

## 5. 환경변수

| 변수 | 용도 |
|------|------|
| `VITE_APPHUB_API_URL` | Hub API endpoint (브라우저 노출됨) |
| `VITE_APPHUB_APP_SLUG` | 내 앱 슬러그 |
| `VITE_APPHUB_DATA_BASE_URL` | Data plane base URL |

`API_KEY` 는 의도적으로 빠져 있어요. 정적 SPA 에 시크릿을 박지 않는 게 원칙.

## 6. 자주 막히는 곳

| 증상 | 해결 |
|------|------|
| `npm install` 실패 | Node 20+ 인지 `node -v` 확인 |
| Tailwind class 가 안 먹음 | `tailwind.config.js` 의 `content` 경로 확인 |
| 배포 후 axhub 호출이 CORS 에러 | axhub backend CORS 설정 또는 같은 도메인 reverse proxy 필요 |
| 화면이 빈 흰색 | 콘솔 열어서 에러 확인. 보통 import 경로 오타 |

## 7. 관련 자료

- [axhub 가이드](https://github.com/jocoding-ax-partners/axhub)
- [Vite docs](https://vitejs.dev)
- [Tailwind 3 docs](https://v3.tailwindcss.com)

## axhub.ts 신뢰 모델 (이 템플릿)

이 (Vite + React) 템플릿은 **browser-side**. axhub 헬퍼는 6개 템플릿 모두 동일한 외부 API
(`axhub.fetch / data / slug / isConfigured`) 를 노출해요. Transport 만 달라요:
이 템플릿은 `credentials: "include"` (cookie auth) — **API_KEY 미주입** (브라우저 노출 위험).
인증 필요 시 `express-axhub` / `hono-axhub` 백엔드 경유.
풀 비교 표는 [examples README](../README.md#axhubts-신뢰-모델-모든-템플릿) 참고.

## 8. 라이선스

MIT
