# ADR-0002: 방문자 신원은 허브에 묻지 않고 문(게이트) 헤더를 읽는다

**상태:** Accepted (2026-09-08)
**의사결정자:** ksro0128 · 근거 spec: axhub-backend `specs/597-app-host-session-identity` (C4·C6 계약, `template-handoff.md`), spec 298 (user info headers)
**대체:** ADR-0001 §부트스트랩 인증·설정 모델의 "자격: 사용자 세션 JWT 통일" 중 **신원 확인** 부분

## 배경

퍼블릭 워크스페이스 앱(`{앱}.axhub.app`)과 커스텀 도메인 앱에서 템플릿 3종이 "로그인 정보를 불러오지 못했어요" 를 띄웠다.
원인은 템플릿이 방문자 신원을 **허브에 다시 묻는** 구조였기 때문이다.

- vite: 브라우저가 `{{API_BASE}}/api/v1/me` 를 `credentials:"include"` 로 호출 → 401 → silent SSO → 실패
- nextjs / astro: 서버가 요청 쿠키 `_hub_access` 를 꺼내 `sdk.identity.me()` → 401

허브 세션 쿠키는 `axhub.ai`(staging `axhub.dev`) 계열에만 발급된다. 퍼블릭·커스텀 도메인은 다른 등록 도메인이라 브라우저가 쿠키를 **절대 보내지 않는다.** 허브가 거절하는 게 아니라 브라우저 쿠키 규칙이 막는 것이므로, CORS/SameSite 완화나 SDK 경유로는 해결되지 않는다(BE 에서 기각된 대안 — 허브 토큰이 모든 앱 origin 에 노출됨). 회사 앱 주소에서 옛 방식이 통한 것은 같은 도메인 계열이라는 우연이었고, 그마저 로그인 직후 일시적 401 같은 간헐 실패가 있었다(#14 재시도 땜질).

한편 앱 앞의 문(ingress 게이트, spec 298)은 통과시킨 모든 요청에 사용자 정보 헤더 7종(`X-AxHub-User-ID` / `-User-Email` / `-User-Name` / `-App-Role` / `-Is-Admin` / `-Tenant-Slug` / `-Surface`)을 이미 싣고 있고, 회사·apex·커스텀 세션 경로가 같은 함수로 채운다. spec 597 이 이를 **앱이 사용자를 아는 유일한 계약(C4)** 으로 확정했다.

## 결정

1. **신원은 헤더에서만 읽는다.** 허브 `/api/v1/me` 호출, silent SSO, 사용자 쿠키 전달로 방문자를 알아내는 코드는 제거한다.
   - nextjs: `lib/axhub-server.ts` `me()` — `next/headers` `headers()` 에서 읽음
   - astro: `src/lib/axhub-server.ts` `me(Astro.request)` — `request.headers` 에서 읽음
   - vite: 브라우저는 요청 헤더를 볼 수 없으므로 파드 nginx 가 `location = /__axhub/me` 에서 헤더를 JSON 으로 되돌려 주고(`nginx.conf`), `src/lib/axhub.ts` `me()` 가 same-origin 으로 읽음. 플랫폼 same-origin 엔드포인트는 BE 에 없다(앱마다 k8s 객체가 늘어 기각) — 앱 소유.
   - 응답 모양(C6): `{ authenticated, user_id, email, name, app_role, is_admin, tenant_slug, surface }`. `authenticated = user_id !== ''`.
2. **익명은 오류가 아니다.** 헤더가 전부 빈 값이면 `authenticated:false` 를 돌려주고 UI 는 로그인 버튼을 보여준다. "불러오지 못했어요" 문구는 없앤다.
3. **로그인/로그아웃은 플랫폼 주소를 조립만 한다.** `loginUrl()` = `{{API_BASE}}/custom-domain-auth/start?target=<현재 주소 전체>`(시작점이 주소 종류 판정). `logoutUrl()` = `/__axhub/auth/logout?return_to=/`(이 앱 주소 세션만 끊음, 콘솔 로그인 유지). 회사 앱(허브 등록 도메인 계열)은 끊을 앱 세션이 없어 `null`.
4. **개발자 안내(FR-016 ①~⑥)를 README 3종에 싣는다.** 헤더 표 + base64 디코드, 로그인 버튼→시작점, 앱 로그아웃 범위, 콘솔 로그아웃 지연(최대 12h)·권한은 즉시, 익명은 정상, `/__axhub/auth/` 예약. 템플릿을 쓰지 않는 개발자도 같은 헤더를 읽으면 되므로 이 안내가 유일한 공개 경로다.
5. **`{{APP_ORIGIN}}` placeholder 는 템플릿에서 더 이상 쓰지 않는다.** silent SSO 전용이었다. bootstrap 이 치환 대상을 못 찾아도 무해하다.

## 이번에 바꾸지 않은 것 — connector(gateway) 조회

nextjs `queryConnector()` / `makeGateway()` 와 astro `makeAxhub` / `makeTenant` 는 **사용자 쿠키를 SDK JWT 로 전달하는 방식을 유지**한다.
spec 597 인계 문서는 "허브 API 가 꼭 필요한 곳은 앱 토큰(spec 134)" 이라 했지만, 확인 결과 gateway 핸들러는 사용자 Bearer 전용이고 connector 목록도 사용자별 grant 기준이라 **앱 토큰을 받지 않는다**(`AXHUB_APP_TOKEN` 검증기는 notifications·aiproxy·sandboxes 에만 있음). 따라서 쿠키 전달을 없애면 회사 앱에서도 connector 조회가 멈춘다.

- 결정: 신원과 connector 는 다른 문제로 분리. connector 는 지금도 퍼블릭·커스텀 도메인에서 안 되던 기능이므로 **"회사 앱 주소에서만 동작"** 을 코드 주석·README·AGENTS 에 명시하고 그대로 둔다.
- 후속(이 레포 밖): gateway 가 앱 토큰을 받게 하는 BE 작업 → 그 뒤 템플릿의 쿠키 전달 제거. SDK 에 헤더 파싱 순수 함수(`parseAppUser(headers)` 류)를 추가하면 세 템플릿의 디코드 중복이 사라진다.

## 결과

- 회사·퍼블릭·커스텀 도메인에서 `me()` 가 같은 모양으로 동작하고 허브 왕복이 0 이 된다. 옛 방식의 간헐 401 도 사라진다.
- UX 변화(회사 앱, 로그인 요구 OFF): 옛 vite 헬퍼는 콘솔 미로그인 방문자를 silent SSO 로 자동 로그인시키려 했으나, 이제 익명 상태를 보여주고 로그인 버튼을 눌러야 한다. 로그인 요구 ON 앱은 문이 먼저 막으므로 차이가 없다.
- 기존 배포 앱은 **재부트스트랩 또는 재배포**해야 새 헬퍼가 들어간다.

## 검증 (staging)

- 퍼블릭 앱 `public-test-9kkc.stage.axhub.app`(nextjs) · `app-2rhw.stage.axhub.app`(vite) 재배포 → 익명 표시(오류 아님) → 로그인 버튼 → 시작점 → 콜백 → 이름·이메일 → 로그아웃 → 익명.
- 로그인 요구 ON: 콘솔 로그인된 브라우저는 클릭 0회로 진입 + 이름·이메일.
- 회사 앱에 같은 템플릿 배포 → `me()` 같은 모양, `logoutUrl()` null.
