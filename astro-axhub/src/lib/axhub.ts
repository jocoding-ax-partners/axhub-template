// Transitional re-export for the old import path.
// New code should import from "../lib/axhub-server" so agents see the server-only boundary.
// 인증/식별만 — 앱 데이터는 표준 PostgreSQL(src/lib/db.ts).
export * from "./axhub-server";
