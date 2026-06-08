// Transitional re-export for the old import path.
// New code should import from "../lib/axhub-server" so agents see the server-only boundary.
// The old raw axhub.fetch/data helpers were intentionally removed in favor of SDK 2.x.
export * from "./axhub-server";
