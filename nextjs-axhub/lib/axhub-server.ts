// axhub SDK 서버 전용 factory (Next.js Server Component / Route Handler / Server Action).
// 클라이언트 컴포넌트에서 import 금지 — next/headers 는 server-only.
//
// 모델:
//   - 요청별 새 AxHubClient 인스턴스 (모듈 레벨 싱글톤 금지: 사용자 JWT 가 섞임).
//   - 들어온 요청의 axhub 세션 쿠키(_hub_access) 를 JWT 로 사용 → SDK 가 Authorization: Bearer 처리.
//   - defaultTenantSlug 자동 주입 → sdk.apps / sdk.identity / sdk.app() 가 슬러그 자동 인지.
//
// 사용:
//   const sdk = await makeAxhub()
//   const me  = await sdk.identity.me               // GET /api/v1/me, 사용자 자격
//   const app = await makeApp()                     // sdk.tenant(TENANT).app(APP_SLUG)
//   const orders = await app.data.discover('orders')
//
// 설정값은 axhub bootstrap 이 배포 시 {{...}} placeholder 를 치환해 박아요.
// 로컬에서 직접 돌릴 땐 .env 의 APPHUB_* 가 우선해요.
import { cookies } from 'next/headers'
import { AxHubClient, type TenantScopedClient, type AppScopedClient } from '@ax-hub/sdk'

const API_BASE = process.env.APPHUB_API_URL || '{{API_BASE}}'
export const APP_SLUG = process.env.APPHUB_APP_SLUG || '{{APP_SLUG}}'
export const TENANT = process.env.APPHUB_TENANT || '{{TENANT}}'

const isSet = (v: string): boolean => Boolean(v) && !v.includes('{{')

// 환경값 + tenant/app slug 가 모두 placeholder 치환됐는지 확인.
// false 면 SDK 호출 직전에 명시적 에러로 끊고 사용자에게 axhub 배포 / .env 안내.
export function isAxhubConfigured(): boolean {
  return isSet(API_BASE) && isSet(APP_SLUG) && isSet(TENANT)
}

// 들어온 요청의 _hub_access 쿠키 → JWT. 요청 스코프 밖(빌드 등)에서는 빈 문자열.
async function readHubAccessToken(): Promise<string> {
  try {
    return (await cookies()).get('_hub_access')?.value ?? ''
  } catch {
    return ''
  }
}

// per-user 응답이 Next.js fetch cache 에 묻혀 다른 요청과 섞이지 않도록 모든 호출을 no-store 로.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...(init ?? {}), cache: 'no-store' })

// 요청별 SDK 인스턴스. 절대 모듈 레벨에 캐싱 금지 (사용자 자격 혼선).
export async function makeAxhub(): Promise<AxHubClient> {
  if (!isAxhubConfigured()) {
    throw new Error(
      'axhub SDK 가 설정되지 않았어요. axhub 로 배포하면 자동 주입돼요. ' +
        '로컬에서 직접 실행 중이라면 .env.local 의 APPHUB_API_URL / APPHUB_APP_SLUG / APPHUB_TENANT 를 채워 주세요.',
    )
  }
  const token = await readHubAccessToken()
  return new AxHubClient({
    baseUrl: API_BASE,
    // 토큰이 없으면 NoAuth 로 떨어져 401 이 자연스럽게 surface 돼요.
    ...(token ? { token, tokenType: 'jwt' as const } : {}),
    defaultTenantSlug: TENANT,
    fetch: noStoreFetch,
  })
}

// tenant + app 스코프까지 한 줄로 잡아주는 편의 helper.
// vibe coder 가 가장 자주 쓰는 패턴: makeApp().data.discover('todos') 식.
export async function makeApp(): Promise<AppScopedClient> {
  const sdk = await makeAxhub()
  return sdk.tenant(TENANT).app(APP_SLUG)
}

// tenant 만 잡힌 클라이언트가 필요할 때 (apps.list, tenants.* 등).
export async function makeTenant(): Promise<TenantScopedClient> {
  const sdk = await makeAxhub()
  return sdk.tenant(TENANT)
}
