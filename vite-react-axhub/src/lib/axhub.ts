// axhub Hub API 헬퍼 (브라우저 SPA 용)
//
// 인증: axhub 세션 쿠키(_hub_access, apex 도메인)를 credentials:"include" 로 자동 전송해요.
// 401(미인증/만료)이면 axhub silent SSO 로 보내 재인증해요. 별도 API key 안 써요.
//
// 설정값은 axhub bootstrap 이 배포 시 {{...}} placeholder 를 실제 값으로 치환해 박아요.
// 로컬에서 템플릿을 직접 돌릴 땐 .env.local 의 VITE_APPHUB_* 가 우선해요.
const API_BASE = import.meta.env.VITE_APPHUB_API_URL || "{{API_BASE}}";
const APP_SLUG = import.meta.env.VITE_APPHUB_APP_SLUG || "{{APP_SLUG}}";
const TENANT = import.meta.env.VITE_APPHUB_TENANT || "{{TENANT}}";
const APP_ORIGIN = import.meta.env.VITE_APPHUB_APP_ORIGIN || "{{APP_ORIGIN}}";

// placeholder 가 치환됐거나 env 로 채워졌으면 configured.
const isSet = (v: string): boolean => Boolean(v) && !v.includes("{{");

// 데이터 API: {API_BASE}/data/{tenant}/{app}/{table}
const DATA_BASE = `${API_BASE}/data/${TENANT}/${APP_SLUG}`;

function buildUrl(base: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const trimmedBase = base.replace(/\/+$/, "");
  const trimmedPath = path.replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedPath}`;
}

async function request(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 401 && isSet(APP_ORIGIN)) {
    // axhub silent SSO 로 재인증 (return_origin = 이 앱). backend 가 _hub_hint 로 prompt=none 시도.
    window.location.href = `${API_BASE}/auth/silent/start?return_origin=${encodeURIComponent(APP_ORIGIN)}`;
  }
  return res;
}

// 일반 Hub API 호출. path 예: "/api/v1/me"
export async function axhubFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!isSet(API_BASE)) throw new Error("axhub API base 가 설정되지 않았어요. axhub 로 배포하거나 .env.local 의 VITE_APPHUB_API_URL 을 확인해 주세요.");
  return request(buildUrl(API_BASE, path), init);
}

// 데이터 API 호출. resource 예: "todos" → {API_BASE}/data/{tenant}/{app}/todos
export async function axhubData(resource: string, init: RequestInit = {}): Promise<Response> {
  if (!isSet(API_BASE)) throw new Error("axhub API base 가 설정되지 않았어요.");
  return request(buildUrl(DATA_BASE, resource), init);
}

export const axhub = {
  fetch: axhubFetch,
  data: axhubData,
  slug: isSet(APP_SLUG) ? APP_SLUG : "",
  isConfigured: isSet(API_BASE) && isSet(APP_SLUG),
};
