// axhub 서버 전용 헬퍼 (Astro frontmatter / endpoint / SSR). 브라우저 번들에서 import 금지.
// 앱 데이터는 표준 PostgreSQL — src/lib/db.ts 사용.
//
// ① 사용자 신원 — 허브에 다시 묻지 않아요.
//    axhub 문(ingress 게이트)이 이 앱으로 통과시킨 요청마다 사용자 정보를 X-AxHub-* 헤더로 실어 줘요.
//    me(Astro.request) 는 그 헤더를 읽기만 해요 — 회사·퍼블릭(axhub.app)·커스텀 도메인 어디서든 똑같아요.
//    (허브 SDK identity.me 를 사용자 쿠키로 부르던 옛 방식은 허브 쿠키가 안 실리는 퍼블릭·커스텀 도메인에서
//    구조적으로 안 돼서 폐기했어요.)
//    loginUrl()/logoutUrl() 은 플랫폼이 정한 주소를 조립만 해요.
//
// ② 허브 SDK (tenant 스코프 API 등) — 사용자 자격으로 허브 API 를 불러야 할 때만.
//    ⚠️ 사용자 쿠키(_hub_access)를 SDK JWT 로 넘기는데, 브라우저는 그 쿠키를 회사 앱 주소({앱}.{회사}.axhub.ai)에만
//    보내요 → makeAxhub/makeTenant 는 **회사 앱에서만** 동작해요. 방문자 신원은 여기가 아니라 ① me() 예요.
//
// 사용:
//   const visitor = await me(Astro.request)   // { authenticated, user_id, email, name, ... }
//
// 설정값은 axhub bootstrap 이 배포 시 {{...}} placeholder 를 치환해 박아요.
// 로컬에서 직접 돌릴 땐 .env 의 APPHUB_* 가 우선해요.
import { AxHubClient, type TenantScopedClient } from "@ax-hub/sdk";

const API_BASE = import.meta.env.APPHUB_API_URL ?? process.env.APPHUB_API_URL ?? "{{API_BASE}}";
export const APP_SLUG = import.meta.env.APPHUB_APP_SLUG ?? process.env.APPHUB_APP_SLUG ?? "{{APP_SLUG}}";
export const TENANT = import.meta.env.APPHUB_TENANT ?? process.env.APPHUB_TENANT ?? "{{TENANT}}";

export type AxhubCtx = { cookie?: string | null };

const isSet = (v: string): boolean => Boolean(v) && !v.includes("{{");

export function isAxhubConfigured(): boolean {
  return isSet(API_BASE) && isSet(APP_SLUG) && isSet(TENANT);
}

// ── ① 사용자 신원 ─────────────────────────────────────────────────────────────

// 문이 넘기는 헤더를 그대로 옮긴 모양. authenticated=false 는 "로그인 안 됨" 정상 상태예요 (오류 아님).
export type AxhubMe = {
  authenticated: boolean;
  user_id: string;
  email: string;
  name: string;
  // owner / platform_admin / tenant_admin / app_member / tenant_member / guest (모르는 값은 최소 권한으로 취급)
  app_role: string;
  is_admin: boolean;
  // 앱을 소유한 워크스페이스 슬러그
  tenant_slug: string;
  // tenant(회사·퍼블릭·커스텀 도메인 모두) / admin / public
  surface: string;
};

export const ANONYMOUS: AxhubMe = {
  authenticated: false,
  user_id: "",
  email: "",
  name: "",
  app_role: "",
  is_admin: false,
  tenant_slug: "",
  surface: "",
};

// email/name 은 UTF-8 → base64 로 실려요.
function decodeBase64Utf8(v: string | null): string {
  if (!v) return "";
  try {
    return Buffer.from(v, "base64").toString("utf8");
  } catch {
    return "";
  }
}

// 현재 방문자. 로컬 dev(문이 없음)면 항상 익명이에요. 값은 문이 매 요청 덮어쓰므로 클라이언트가 위조할 수 없어요.
export async function me(request: Request): Promise<AxhubMe> {
  const h = request.headers;
  const user_id = h.get("x-axhub-user-id") ?? "";
  return {
    authenticated: user_id !== "",
    user_id,
    email: decodeBase64Utf8(h.get("x-axhub-user-email")),
    name: decodeBase64Utf8(h.get("x-axhub-user-name")),
    app_role: h.get("x-axhub-app-role") ?? "",
    is_admin: h.get("x-axhub-is-admin") === "true",
    tenant_slug: h.get("x-axhub-tenant-slug") ?? "",
    surface: h.get("x-axhub-surface") ?? "",
  };
}

// 이 요청이 들어온 앱 origin (https://{host}). 프록시 뒤라 x-forwarded-* 를 우선 봐요.
function requestOrigin(request: Request): string {
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

// 로그인 버튼 href. 시작점이 회사·퍼블릭·커스텀 주소를 알아서 판정하고 로그인 뒤 target 으로 돌려보내요.
// 기본 target 은 현재 요청 URL 전체 — 로그인 후 보던 화면으로 그대로 돌아와요.
export function loginUrl(request: Request, target?: string): string {
  let t = target ?? "";
  if (!t) {
    try {
      const u = new URL(request.url);
      t = `${requestOrigin(request)}${u.pathname}${u.search}`;
    } catch {
      t = `${requestOrigin(request)}/`;
    }
  }
  return `${API_BASE.replace(/\/+$/, "")}/custom-domain-auth/start?target=${encodeURIComponent(t)}`;
}

// 허브의 등록 도메인 (api.axhub.ai → axhub.ai). 회사 앱 주소({앱}.{회사}.axhub.ai)는 이 계열이에요.
function hubBaseDomain(): string {
  try {
    return new URL(API_BASE).hostname.split(".").slice(-2).join(".");
  } catch {
    return "";
  }
}

// 회사 앱(허브 도메인 계열)인지. 회사 앱은 허브 세션을 그대로 쓰므로 끊을 앱 세션이 없어요.
export function isTenantHostApp(request: Request): boolean {
  const base = hubBaseDomain();
  if (!base) return false;
  let hostname = "";
  try {
    hostname = new URL(requestOrigin(request)).hostname;
  } catch {
    return false;
  }
  return hostname === base || hostname.endsWith(`.${base}`);
}

// 로그아웃 링크. 이 앱 주소의 세션만 끊고 콘솔 로그인은 유지돼요 — "들어올 때 로그인 요구" 가 켜진 앱이면
// 콘솔에 로그인된 사용자는 다시 자동으로 들어와요(정상). 회사 앱은 null — 버튼을 숨기고 콘솔 로그아웃을 안내하세요.
// returnTo 는 이 앱 안의 상대 경로만 받아요.
export function logoutUrl(request: Request, returnTo: string = "/"): string | null {
  if (isTenantHostApp(request)) return null;
  return `/__axhub/auth/logout?return_to=${encodeURIComponent(returnTo)}`;
}

// ── ② 허브 SDK (회사 앱 전용) ─────────────────────────────────────────────────

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

// 요청별 SDK 인스턴스 (모듈 레벨 싱글톤 금지: 사용자 JWT 가 섞임).
// 방문자 신원은 여기가 아니라 me() 예요 — identity.me 를 이걸로 부르지 마세요 (퍼블릭·커스텀 도메인에선 401).
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

export const axhub = {
  me,
  loginUrl,
  logoutUrl,
  isTenantHostApp,
  slug: isSet(APP_SLUG) ? APP_SLUG : "",
  isConfigured: isAxhubConfigured(),
};
