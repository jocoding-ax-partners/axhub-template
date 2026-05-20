// axhub Hub API 헬퍼 (Astro 서버 전용 — frontmatter / API endpoint / getStaticPaths).
//
// 인증: 들어온 요청의 axhub 세션 쿠키(_hub_access)를 백엔드로 Bearer 포워딩해요 — 사용자 자격으로.
// (예전의 정적 APPHUB_API_KEY 모델은 폐기.) Astro 는 전역 cookies() 가 없어서, 호출 시 ctx 로
// 쿠키를 넘겨요:  axhub.fetch("/api/v1/me", {}, { cookie: Astro.request.headers.get("cookie") })
//
// 설정값은 axhub bootstrap 이 배포 시 {{...}} placeholder 를 치환해 박아요.
// 로컬에서 직접 돌릴 땐 .env 의 APPHUB_* 가 우선해요.
const API_BASE = import.meta.env.APPHUB_API_URL ?? process.env.APPHUB_API_URL ?? "{{API_BASE}}";
const APP_SLUG = import.meta.env.APPHUB_APP_SLUG ?? process.env.APPHUB_APP_SLUG ?? "{{APP_SLUG}}";
const TENANT = import.meta.env.APPHUB_TENANT ?? process.env.APPHUB_TENANT ?? "{{TENANT}}";

const isSet = (v: string): boolean => Boolean(v) && !v.includes("{{");
const DATA_BASE = `${API_BASE}/data/${TENANT}/${APP_SLUG}`;

export type AxhubCtx = { cookie?: string | null };

function buildUrl(base: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const trimmedBase = base.replace(/\/+$/, "");
  const trimmedPath = path.replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedPath}`;
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

async function request(url: string, init: RequestInit, ctx?: AxhubCtx): Promise<Response> {
  const token = hubAccessFrom(ctx?.cookie);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };
  return fetch(url, { ...init, headers });
}

// 일반 Hub API 호출. path 예: "/api/v1/me"
export async function axhubFetch(path: string, init: RequestInit = {}, ctx?: AxhubCtx): Promise<Response> {
  if (!isSet(API_BASE)) throw new Error("axhub API base 가 설정되지 않았어요. axhub 로 배포하거나 .env 의 APPHUB_API_URL 을 확인해 주세요.");
  return request(buildUrl(API_BASE, path), init, ctx);
}

// 데이터 API 호출. resource 예: "todos" → {API_BASE}/data/{tenant}/{app}/todos
export async function axhubData(resource: string, init: RequestInit = {}, ctx?: AxhubCtx): Promise<Response> {
  if (!isSet(API_BASE)) throw new Error("axhub API base 가 설정되지 않았어요.");
  return request(buildUrl(DATA_BASE, resource), init, ctx);
}

export const axhub = {
  fetch: axhubFetch,
  data: axhubData,
  slug: isSet(APP_SLUG) ? APP_SLUG : "",
  isConfigured: isSet(API_BASE) && isSet(APP_SLUG),
};
