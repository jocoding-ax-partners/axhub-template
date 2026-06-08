// axhub SDK 서버 전용 factory (Astro frontmatter / endpoint / SSR).
// 브라우저 번들에서 import 금지 — 이 파일은 사용자 요청의 _hub_access 쿠키를 SDK JWT 로 포워딩해요.
//
// 모델:
//   - 요청별 새 AxHubClient 인스턴스 (모듈 레벨 싱글톤 금지: 사용자 JWT 가 섞임).
//   - 들어온 요청의 axhub 세션 쿠키(_hub_access) 를 JWT 로 사용 → SDK 가 Authorization: Bearer 처리.
//   - defaultTenantSlug 자동 주입 → sdk.identity / sdk.tenant(TENANT).app(APP_SLUG) 가 환경별 슬러그를 사용.
//
// 사용:
//   const sdk = makeAxhub({ cookie: Astro.request.headers.get("cookie") })
//   const me  = await sdk.identity.me()
//   const app = makeApp({ cookie: Astro.request.headers.get("cookie") })
//   const todos = await table<{ id: string; title: string }>('todos', { cookie: Astro.request.headers.get("cookie") })
//
// 설정값은 axhub bootstrap 이 배포 시 {{...}} placeholder 를 치환해 박아요.
// 로컬에서 직접 돌릴 땐 .env 의 APPHUB_* 가 우선해요.
import { AxHubClient, type AppScopedClient, type TenantScopedClient } from "@ax-hub/sdk";

const API_BASE = import.meta.env.APPHUB_API_URL ?? process.env.APPHUB_API_URL ?? "{{API_BASE}}";
export const APP_SLUG = import.meta.env.APPHUB_APP_SLUG ?? process.env.APPHUB_APP_SLUG ?? "{{APP_SLUG}}";
export const TENANT = import.meta.env.APPHUB_TENANT ?? process.env.APPHUB_TENANT ?? "{{TENANT}}";

export type AxhubCtx = { cookie?: string | null };

const isSet = (v: string): boolean => Boolean(v) && !v.includes("{{");

export function isAxhubConfigured(): boolean {
  return isSet(API_BASE) && isSet(APP_SLUG) && isSet(TENANT);
}

function hubAccessFrom(cookieHeader?: string | null): string {
  if (!cookieHeader) return "";
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === "_hub_access") return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return "";
}

const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...(init ?? {}), cache: "no-store" });

export function makeAxhub(ctx: AxhubCtx = {}): AxHubClient {
  if (!isAxhubConfigured()) {
    throw new Error(
      "axhub SDK 가 설정되지 않았어요. axhub 로 배포하면 자동 주입돼요. " +
        "로컬에서 직접 실행 중이라면 .env 의 APPHUB_API_URL / APPHUB_APP_SLUG / APPHUB_TENANT 를 채워 주세요.",
    );
  }
  const token = hubAccessFrom(ctx.cookie);
  return new AxHubClient({
    baseUrl: API_BASE,
    ...(token ? { token, tokenType: "jwt" as const } : {}),
    defaultTenantSlug: TENANT,
    fetch: noStoreFetch,
  });
}

export function makeTenant(ctx: AxhubCtx = {}): TenantScopedClient {
  return makeAxhub(ctx).tenant(TENANT);
}

export function makeApp(ctx: AxhubCtx = {}): AppScopedClient {
  return makeAxhub(ctx).tenant(TENANT).app(APP_SLUG);
}

export async function table<Row extends Record<string, unknown>>(name: string, ctx: AxhubCtx = {}) {
  const app = makeApp(ctx);
  return app.data.discover<Row>(name);
}

export const axhub = {
  slug: isSet(APP_SLUG) ? APP_SLUG : "",
  isConfigured: isAxhubConfigured(),
};
