// axhub 헬퍼 (브라우저 SPA 용)
//
// 사용자 신원 — 허브에 다시 묻지 않아요.
//   axhub 문(ingress 게이트)이 이 앱으로 통과시킨 요청마다 사용자 정보를 X-AxHub-* 헤더로 실어 줘요.
//   브라우저는 그 요청 헤더를 볼 수 없으니, 이 앱의 nginx 가 /__axhub/me 에서 JSON 으로 되돌려 줘요 (nginx.conf).
//   me() 는 그걸 읽기만 해요 — same-origin 이라 쿠키·CORS 설정이 필요 없고, 회사·퍼블릭(axhub.app)·커스텀
//   도메인 어디서든 똑같이 동작해요. (허브 /api/v1/me 를 부르는 옛 방식은 허브 쿠키가 안 실리는
//   퍼블릭·커스텀 도메인에서 구조적으로 안 돼서 폐기했어요.)
//
// 로그인/로그아웃 — 주소는 플랫폼이 정해요. 헬퍼는 링크만 만들어요.
//   loginUrl()  : 시작점(custom-domain-auth/start)에 현재 주소 전체를 넘겨요. 시작점이 주소 종류를 알아서 판정해요.
//   logoutUrl() : 이 앱 주소의 세션만 끊어요. 콘솔 로그인은 유지돼요. 회사 앱엔 끊을 앱 세션이 없어 null 이에요.
//
// 설정값은 axhub bootstrap 이 배포 시 {{...}} placeholder 를 실제 값으로 치환해 박아요.
// 로컬에서 템플릿을 직접 돌릴 땐 .env.local 의 VITE_APPHUB_* 가 우선해요.
const API_BASE = import.meta.env.VITE_APPHUB_API_URL || "{{API_BASE}}";
const APP_SLUG = import.meta.env.VITE_APPHUB_APP_SLUG || "{{APP_SLUG}}";
const APP_NAME = import.meta.env.VITE_APPHUB_APP_NAME || "{{APP_NAME}}";

// placeholder 가 치환됐거나 env 로 채워졌으면 configured.
const isSet = (v: string): boolean => Boolean(v) && !v.includes("{{");

function buildUrl(base: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const trimmedBase = base.replace(/\/+$/, "");
  const trimmedPath = path.replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedPath}`;
}

// ── 사용자 신원 ──────────────────────────────────────────────────────────────

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

// email/name 은 UTF-8 → base64 로 실려요. atob 만 쓰면 한글이 깨지니 바이트로 풀어 디코드해요.
function decodeBase64Utf8(v: string): string {
  if (!v) return "";
  try {
    const bin = atob(v);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

type MeWire = {
  user_id?: string;
  email_b64?: string;
  name_b64?: string;
  app_role?: string;
  is_admin?: string;
  tenant_slug?: string;
  surface?: string;
};

// 현재 방문자. 배포된 앱에서만 의미 있어요 — 로컬 vite dev 엔 nginx 가 없어 항상 익명이에요.
export async function me(): Promise<AxhubMe> {
  const res = await fetch("/__axhub/me", { cache: "no-store", headers: { Accept: "application/json" } });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.includes("application/json")) {
    // 로컬 dev 서버는 SPA fallback 으로 index.html 을 주고, 배포본에서 이게 나오면 nginx.conf 의 /__axhub/me 가 빠진 거예요.
    if (!isSet(API_BASE)) return ANONYMOUS;
    throw new Error("/__axhub/me 가 JSON 을 돌려주지 않아요. nginx.conf 의 location = /__axhub/me 를 확인해 주세요.");
  }
  const w = (await res.json()) as MeWire;
  const user_id = w.user_id ?? "";
  return {
    authenticated: user_id !== "",
    user_id,
    email: decodeBase64Utf8(w.email_b64 ?? ""),
    name: decodeBase64Utf8(w.name_b64 ?? ""),
    app_role: w.app_role ?? "",
    is_admin: w.is_admin === "true",
    tenant_slug: w.tenant_slug ?? "",
    surface: w.surface ?? "",
  };
}

// 로그인 버튼 href. 시작점이 회사·퍼블릭·커스텀 주소를 알아서 판정하고 로그인 뒤 target 으로 돌려보내요.
// target 은 현재 주소 전체 — 로그인 후 보던 화면으로 그대로 돌아와요.
export function loginUrl(target: string = window.location.href): string {
  return `${API_BASE.replace(/\/+$/, "")}/custom-domain-auth/start?target=${encodeURIComponent(target)}`;
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
export function isTenantHostApp(hostname: string = window.location.hostname): boolean {
  const base = hubBaseDomain();
  return base !== "" && (hostname === base || hostname.endsWith(`.${base}`));
}

// 로그아웃 링크. 이 앱 주소의 세션만 끊고 콘솔 로그인은 유지돼요 — "들어올 때 로그인 요구" 가 켜진 앱이면
// 콘솔에 로그인된 사용자는 다시 자동으로 들어와요(정상). 회사 앱은 null — 버튼을 숨기고 콘솔 로그아웃을 안내하세요.
// return_to 는 이 앱 안의 상대 경로만 받아요.
export function logoutUrl(returnTo: string = "/"): string | null {
  if (isTenantHostApp()) return null;
  return `/__axhub/auth/logout?return_to=${encodeURIComponent(returnTo)}`;
}

// ── 허브 API 호출 (회사 앱 전용) ───────────────────────────────────────────────

// 일시적 실패 흡수용 짧은 대기.
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function request(url: string, init: RequestInit): Promise<Response> {
  // 로그인 직후엔 세션이 안정되기 전이라 잠깐 401 을 줄 수 있고, 리다이렉트 중 취소된 fetch 는
  // "Failed to fetch" 로 reject 돼요. GET(멱등)만 몇 번 재시도해요. POST 등은 이중 실행 위험이라 재시도 안 함.
  const idempotent = (init.method ?? "GET").toUpperCase() === "GET";
  const maxAttempts = idempotent ? 3 : 1;

  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        credentials: "include",
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      });
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      await sleep(250 * attempt);
      continue;
    }
    if (res.status === 401 && attempt < maxAttempts) {
      await sleep(250 * attempt);
      continue;
    }
    return res;
  }
}

// 허브 API 직접 호출. path 예: "/api/v1/apps"
// ⚠️ 브라우저가 허브 쿠키를 실어 보내는 건 회사 앱 주소({앱}.{회사}.axhub.ai)에서만이에요.
//    퍼블릭(axhub.app)·커스텀 도메인에선 401 이 나요 — 방문자 신원은 위 me() 를 쓰세요.
export async function axhubFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!isSet(API_BASE)) throw new Error("axhub API base 가 설정되지 않았어요. axhub 로 배포하거나 .env.local 의 VITE_APPHUB_API_URL 을 확인해 주세요.");
  return request(buildUrl(API_BASE, path), init);
}

export const axhub = {
  me,
  loginUrl,
  logoutUrl,
  isTenantHostApp,
  fetch: axhubFetch,
  slug: isSet(APP_SLUG) ? APP_SLUG : "",
  // 상단바에 보여줄 앱 이름. 배포 시 실제 이름으로 치환돼요.
  name: isSet(APP_NAME) ? APP_NAME : "내 앱",
  isConfigured: isSet(API_BASE) && isSet(APP_SLUG),
};
