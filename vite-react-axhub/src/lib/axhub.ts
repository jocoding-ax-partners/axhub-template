// axhub Hub API 헬퍼 (브라우저 SPA 용)
//
// 인증: axhub 세션 쿠키(_hub_access, apex 도메인)를 credentials:"include" 로 자동 전송해요.
// 401(미인증/만료)이면 axhub silent SSO 로 보내 재인증해요. 별도 API key 안 써요.
//
// 설정값은 axhub bootstrap 이 배포 시 {{...}} placeholder 를 실제 값으로 치환해 박아요.
// 로컬에서 템플릿을 직접 돌릴 땐 .env.local 의 VITE_APPHUB_* 가 우선해요.
const API_BASE = import.meta.env.VITE_APPHUB_API_URL || "{{API_BASE}}";
const APP_SLUG = import.meta.env.VITE_APPHUB_APP_SLUG || "{{APP_SLUG}}";
const APP_ORIGIN = import.meta.env.VITE_APPHUB_APP_ORIGIN || "{{APP_ORIGIN}}";

// placeholder 가 치환됐거나 env 로 채워졌으면 configured.
const isSet = (v: string): boolean => Boolean(v) && !v.includes("{{");

function buildUrl(base: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const trimmedBase = base.replace(/\/+$/, "");
  const trimmedPath = path.replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedPath}`;
}

// silent SSO 재인증은 세션당 1회만 — 무한 redirect 루프 방지.
// (backend 의 ax_silent_attempt 는 한 왕복만 보호하므로 클라이언트도 가드를 둔다.)
const SILENT_TRIED_KEY = "axhub_silent_tried";

function silentAlreadyTried(): boolean {
  try {
    // 직전 silent 시도가 실패해 ?silent=failed 로 돌아왔거나, 이번 세션에 이미 시도함.
    if (new URLSearchParams(window.location.search).get("silent") === "failed") return true;
    return sessionStorage.getItem(SILENT_TRIED_KEY) === "1";
  } catch {
    return true; // storage 불가 시엔 redirect 안 함 (루프 회피 우선).
  }
}

async function request(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 401) {
    if (isSet(APP_ORIGIN) && !silentAlreadyTried()) {
      try { sessionStorage.setItem(SILENT_TRIED_KEY, "1"); } catch { /* noop */ }
      // axhub silent SSO 로 재인증 (return_origin = 이 앱). backend 가 _hub_hint 로 prompt=none 시도.
      window.location.href = `${API_BASE}/auth/silent/start?return_origin=${encodeURIComponent(APP_ORIGIN)}`;
    }
  } else if (res.status < 400) {
    // 인증 정상 — 다음 만료 시 다시 1회 시도할 수 있게 가드 해제.
    try { sessionStorage.removeItem(SILENT_TRIED_KEY); } catch { /* noop */ }
  }
  return res;
}

// 일반 Hub API 호출. path 예: "/api/v1/me"
export async function axhubFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!isSet(API_BASE)) throw new Error("axhub API base 가 설정되지 않았어요. axhub 로 배포하거나 .env.local 의 VITE_APPHUB_API_URL 을 확인해 주세요.");
  return request(buildUrl(API_BASE, path), init);
}

export const axhub = {
  fetch: axhubFetch,
  slug: isSet(APP_SLUG) ? APP_SLUG : "",
  isConfigured: isSet(API_BASE) && isSet(APP_SLUG),
};
