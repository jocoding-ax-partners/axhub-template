// axhub Hub API 헬퍼 (Next.js 서버 전용 — Server Component / Route Handler / Server Action).
// 클라이언트 컴포넌트에서 import 하지 말 것 (next/headers 는 server-only).
//
// 인증: 들어온 요청의 axhub 세션 쿠키(_hub_access)를 백엔드로 Bearer 포워딩해요 — 사용자 자격으로.
// (예전의 정적 APPHUB_API_KEY 모델은 폐기 — per-user 가 아니라 axhub 인증과 안 맞았어요.)
// 사용자 식별 정보는 ingress L2 게이트가 주입한 X-AxHub-* 헤더(next/headers 의 headers())로 읽을 수 있어요.
//
// 설정값은 axhub bootstrap 이 배포 시 {{...}} placeholder 를 치환해 박아요.
// 로컬에서 직접 돌릴 땐 .env 의 APPHUB_* 가 우선해요.
import { cookies } from "next/headers";

const API_BASE = process.env.APPHUB_API_URL || "{{API_BASE}}";
const APP_SLUG = process.env.APPHUB_APP_SLUG || "{{APP_SLUG}}";
const TENANT = process.env.APPHUB_TENANT || "{{TENANT}}";

const isSet = (v: string): boolean => Boolean(v) && !v.includes("{{");
const DATA_BASE = `${API_BASE}/data/${TENANT}/${APP_SLUG}`;

export type AxhubFetchInit = RequestInit & {
  revalidate?: number | false;
  // 들어온 요청의 Cookie 헤더를 직접 넘길 때 (Route Handler 등 cookies() 가 없는 곳).
  cookie?: string;
};

function buildUrl(base: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const trimmedBase = base.replace(/\/+$/, "");
  const trimmedPath = path.replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedPath}`;
}

function hubAccessFrom(cookieHeader: string): string {
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === "_hub_access") return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return "";
}

// _hub_access 토큰을 꺼내 사용자 자격 헤더로. 요청 스코프 밖(빌드 등)이면 빈 헤더.
async function authHeader(cookieOverride?: string): Promise<Record<string, string>> {
  let token = "";
  if (cookieOverride) {
    token = hubAccessFrom(cookieOverride);
  } else {
    try {
      token = (await cookies()).get("_hub_access")?.value ?? "";
    } catch {
      // cookies() 가 요청 스코프 밖에서 호출됨 — 자격 없이 진행.
    }
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(url: string, init: AxhubFetchInit): Promise<Response> {
  const { revalidate, cookie, headers, ...rest } = init;
  const auth = await authHeader(cookie);
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...auth,
    ...(headers as Record<string, string> | undefined),
  };
  const next = revalidate !== undefined ? { revalidate } : undefined;
  return fetch(url, { ...rest, headers: finalHeaders, ...(next ? { next } : {}) });
}

// 일반 Hub API 호출. path 예: "/api/v1/me"
export async function axhubFetch(path: string, init: AxhubFetchInit = {}): Promise<Response> {
  if (!isSet(API_BASE)) throw new Error("axhub API base 가 설정되지 않았어요. axhub 로 배포하거나 .env 의 APPHUB_API_URL 을 확인해 주세요.");
  return request(buildUrl(API_BASE, path), init);
}

// 데이터 API 호출. resource 예: "todos" → {API_BASE}/data/{tenant}/{app}/todos
export async function axhubData(resource: string, init: AxhubFetchInit = {}): Promise<Response> {
  if (!isSet(API_BASE)) throw new Error("axhub API base 가 설정되지 않았어요.");
  return request(buildUrl(DATA_BASE, resource), init);
}

export const axhub = {
  fetch: axhubFetch,
  data: axhubData,
  slug: isSet(APP_SLUG) ? APP_SLUG : "",
  isConfigured: isSet(API_BASE) && isSet(APP_SLUG),
};
