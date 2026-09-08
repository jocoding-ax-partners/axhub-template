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

## 4. 로그인 사용자 알기 (axhub 신원 계약)

axhub 에 배포된 앱은 **허브에 "이 사람 누구야?" 라고 다시 묻지 않아요.** 앱 앞의 문(ingress 게이트)이 통과시킨 요청마다 사용자 정보를 헤더로 실어 주고, 앱은 그걸 **읽기만** 해요. 회사 앱(`{앱}.{회사}.axhub.ai`) · 퍼블릭 앱(`{앱}.axhub.app`) · 커스텀 도메인 모두 같은 계약이에요.

> 왜 허브에 묻지 않나요? 허브 로그인 쿠키는 `axhub.ai` 계열 주소에만 실려요. 퍼블릭·커스텀 도메인은 다른 주소라 브라우저가 쿠키를 안 보내니, 허브 `/api/v1/me` 나 `sdk.identity.me` 로 방문자를 알아내는 방식은 **구조적으로 안 돼요.** 문이 넘기는 헤더는 주소 종류와 무관해요.

### ① 문이 넘기는 헤더 (앱이 사용자를 아는 계약)

| 헤더 | 값 |
|---|---|
| `X-AxHub-User-ID` | 사용자 UUID. **빈 문자열 = 익명 = 정상 상태** |
| `X-AxHub-User-Email` | 이메일 — **base64(UTF-8)**, 디코드해서 써요 |
| `X-AxHub-User-Name` | 이름 — **base64(UTF-8)**, 디코드해서 써요 |
| `X-AxHub-App-Role` | `owner` / `platform_admin` / `tenant_admin` / `app_member` / `tenant_member` / `guest` (모르는 값은 최소 권한으로) |
| `X-AxHub-Is-Admin` | `true` / `false` |
| `X-AxHub-Tenant-Slug` | 앱을 소유한 워크스페이스 슬러그 |
| `X-AxHub-Surface` | `tenant`(회사·퍼블릭·커스텀 모두) / `admin` / `public` |

값은 문이 **매 요청 덮어써요** — 클라이언트가 헤더를 흉내 내도 지워져요. 그래서 앱은 검증 없이 믿고 읽으면 돼요.

### 이 템플릿에서는

브라우저는 자기한테 들어온 요청 헤더를 볼 수 없어요. 그래서 이 앱을 서빙하는 nginx 가 `/__axhub/me` 에서 헤더를 JSON 으로 되돌려 주고(`nginx.conf`), `src/lib/axhub.ts` 의 `me()` 가 그걸 읽어요. 파드 안에서 끝나는 same-origin 호출이라 쿠키·CORS 설정이 없어요. (`/__axhub/me` 는 이 앱 소유예요 — 플랫폼이 가로채지 않아요.)

```tsx
// src/components/Welcome.tsx
import { useEffect, useState } from "react";
import { axhub, type AxhubMe } from "../lib/axhub";

export function Welcome() {
  const [me, setMe] = useState<AxhubMe | null>(null);
  useEffect(() => {
    axhub.me().then(setMe);
  }, []);
  if (!me) return <p>확인하는 중…</p>;
  if (!me.authenticated) return <a href={axhub.loginUrl()}>axhub 로 로그인</a>;   // 익명 = 정상 상태
  const logout = axhub.logoutUrl("/");                                            // 회사 앱이면 null
  return (
    <p>
      환영합니다, {me.name || me.email}님 {logout ? <a href={logout}>로그아웃</a> : "(콘솔에서 로그아웃)"}
    </p>
  );
}
```

`me()` 결과: `{ authenticated, user_id, email, name, app_role, is_admin, tenant_slug, surface }` — email/name 은 헬퍼가 디코드해 줘요.

### ② 로그인 버튼은 시작점으로

로그인 버튼 href 는 `{API_BASE}/custom-domain-auth/start?target=<현재 주소 전체>` 예요 (헬퍼 `loginUrl()`). 시작점이 주소가 회사·퍼블릭·커스텀 중 어느 것인지 알아서 판정하고, 로그인이 끝나면 `target` 으로 돌려보내요. 앱은 주소 종류를 몰라도 돼요.

### ③ 앱 로그아웃은 이 앱 주소의 세션만 끊어요

로그아웃 href 는 앱 주소의 `/__axhub/auth/logout?return_to=/` 예요 (헬퍼 `logoutUrl()`). **이 앱 주소의 세션만** 끊고 axhub 콘솔 로그인은 유지돼요. 그래서 "들어올 때 axhub 로그인 요구" 가 켜진 앱은 콘솔에 로그인된 사용자가 다시 자동으로 들어와요 — 정상이에요. 회사 앱에는 끊을 앱 세션이 없어서 헬퍼가 `null` 을 돌려줘요 → 버튼을 숨기고 "콘솔에서 로그아웃하세요" 로 안내해요.

### ④ 콘솔 로그아웃은 앱 세션을 즉시 끊지 않아요

콘솔에서 로그아웃해도 이미 열린 앱 주소의 세션은 최대 12시간 남아 있을 수 있어요. 반면 **접근 권한**(앱 비활성화·계정 정지·공개 범위 변경)은 문이 매 요청 판정하므로 즉시 반영돼요.

### ⑤ 익명은 오류가 아니에요

"들어올 때 로그인 요구" 가 꺼진 앱은 로그인 안 한 방문자도 들어와요. 그때 헤더는 전부 빈 값이고 헬퍼는 `authenticated: false` 를 돌려줘요. 이건 **"로그인 안 됨" 이라는 정상 상태**예요 — 오류 문구 대신 로그인 버튼을 보여주세요.

### ⑥ 예약 경로

`/__axhub/auth/*` 는 플랫폼이 가로채는 예약 경로예요 (콜백·로그아웃). **앱 라우트로 쓸 수 없어요.**

> 🟡 이 템플릿은 **정적 SPA** 라 자체 데이터베이스가 없어요. 데이터 저장/조회가 필요하면
> 서버 템플릿(`nextjs-axhub` / `astro-axhub`)을 쓰세요 — 거기선 표준 Postgres 를 써요.
> 이 템플릿이 제공하는 건 **인증/식별**(누가 로그인했는지)뿐이에요.

> ⚠️ Vite 의 `VITE_*` 환경변수는 **빌드 결과물에 그대로 박혀요.** 절대 시크릿 넣지 마요.
> 신원은 위 헤더로 알아요 — API key 가 필요 없어요. 이 정적 SPA 는 `@ax-hub/sdk` 같은 서버용 SDK 를 브라우저 번들에 넣지 않습니다.
> `axhub.fetch()` 로 허브 API 를 직접 부르는 건 **회사 앱 주소에서만** 쿠키가 실려 동작해요 — 퍼블릭·커스텀 도메인은 401.

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

axhub 로 배포하면 위 값들은 소스의 `{{...}}` placeholder 치환으로 **자동 주입**돼요. `.env.local` 은 로컬 테스트용 override 일 뿐. API key 는 없어요 — 신원은 문이 넘기는 헤더로(§4).

## 7. 자주 막히는 곳

| 증상 | 해결 |
|------|------|
| `npm install` 실패 | Node 20+ 인지 `node -v` 확인 |
| 저장해도 화면에 반영이 안 됨 | dev 서버 끄고 `node_modules/.vite` 삭제 후 `npm run dev` 재시작 (§3-1) |
| Tailwind class 가 안 먹음 | `tailwind.config.js` 의 `content` 경로 확인 |
| 배포했는데 항상 "로그인하지 않았어요" | 정상일 수 있어요(§4-⑤). 로그인 버튼을 눌러 시작점으로 가 보세요. 로그인 뒤에도 그대로면 `nginx.conf` 의 `/__axhub/me` location 이 있는지 확인 |
| `me()` 가 "JSON 을 돌려주지 않아요" 에러 | 배포본의 `nginx.conf` 에 `location = /__axhub/me` 가 빠짐. 로컬 dev 에선 nginx 가 없어 정상 |
| `axhub.fetch()` 가 401 | 허브 API 직접 호출은 회사 앱 주소에서만 쿠키가 실려요. 퍼블릭·커스텀 도메인에선 안 돼요 — 방문자 신원은 `axhub.me()` |
| 화면이 빈 흰색 | 콘솔 열어서 에러 확인. 보통 import 경로 오타 |

## 8. 관련 자료

- [axhub 가이드](https://github.com/jocoding-ax-partners/axhub)
- [Vite docs](https://vitejs.dev)
- [Tailwind 3 docs](https://v3.tailwindcss.com)

## axhub.ts 신뢰 모델 (이 템플릿)

이 (Vite + React) 템플릿은 **browser-side**. axhub 헬퍼는 브라우저 전용으로
`axhub.me / loginUrl / logoutUrl / fetch / slug / isConfigured` 를 노출해요. **자체 DB 없음(정적 SPA)** — 데이터가 필요하면 서버 템플릿(nextjs/astro, 표준 Postgres)을 써요.
방문자 신원은 axhub 문이 요청마다 실어 주는 `X-AxHub-*` 헤더 → `nginx.conf` 의 `/__axhub/me` → `axhub.me()` 로 읽어요 (§4). 허브 API 에 다시 묻지 않아요.
**시크릿 키 미주입** — 브라우저라 별도 backend 없이 동작해요.
풀 비교 표는 [axhub-template README](../README.md#axhubts-신뢰-모델-3종-공통) 참고.

## 9. 라이선스

MIT
