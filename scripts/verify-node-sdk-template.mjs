import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const json = (path) => JSON.parse(read(path))
const failures = []
const requireIncludes = (path, needle, reason) => {
  const text = read(path)
  if (!text.includes(needle)) failures.push(`${path}: missing ${JSON.stringify(needle)} (${reason})`)
}
const requireNotIncludes = (path, needle, reason) => {
  const text = read(path)
  if (text.includes(needle)) failures.push(`${path}: still contains ${JSON.stringify(needle)} (${reason})`)
}
const requireDep = (path, dep, expected) => {
  const pkg = json(path)
  const actual = pkg.dependencies?.[dep]
  if (actual !== expected) failures.push(`${path}: ${dep} expected ${expected}, got ${actual ?? 'missing'}`)
}

requireDep('nextjs-axhub/package.json', '@ax-hub/sdk', '^3.0.0')
requireDep('astro-axhub/package.json', '@ax-hub/sdk', '^3.0.0')

// 2.1.x data contract — guides must teach what the live backend actually accepts.
// (verified by live-prod E2E against api.axhub.ai: where_required guard, or/not
// non-pushable, offset-only pagination.)
for (const doc of [
  'nextjs-axhub/README.md', 'nextjs-axhub/AGENTS.md', 'nextjs-axhub/app/page.tsx',
  'astro-axhub/README.md', 'astro-axhub/AGENTS.md', 'astro-axhub/src/pages/index.astro',
]) {
  requireNotIncludes(doc, 'or(where', 'or() is non-pushable — live backend rejects it with ValidationError')
  requireNotIncludes(doc, 'not(where', 'not() is non-pushable — live backend rejects it with ValidationError')
  requireNotIncludes(doc, 'after: first.nextCursor', 'after/before keyset cursors are deprecated — LegacyCursorError on 2.1.x')
  requireNotIncludes(doc, '.list({ limit:', 'data list() requires at least one where filter (mass-scan guard)')
  requireNotIncludes(doc, '.list({ limit ', 'data list() requires at least one where filter (mass-scan guard)')
}
requireIncludes('nextjs-axhub/AGENTS.md', 'where_required', 'agent guide must document the where-required guard')
requireIncludes('astro-axhub/AGENTS.md', 'where_required', 'agent guide must document the where-required guard')

requireIncludes('nextjs-axhub/lib/axhub-server.ts', "import { AxHubClient", 'Next server helper must use SDK')
requireIncludes('nextjs-axhub/lib/axhub-server.ts', "defaultTenantSlug: TENANT", 'Next helper must scope tenant by injected slug')
requireIncludes('nextjs-axhub/lib/data.ts', 'app.data.discover<Row>(name)', 'Next data helper must use SDK discover for runtime schema')

if (!existsSync(join(root, 'astro-axhub/src/lib/axhub-server.ts'))) {
  failures.push('astro-axhub/src/lib/axhub-server.ts: missing SDK server factory')
} else {
  requireIncludes('astro-axhub/src/lib/axhub-server.ts', "import { AxHubClient", 'Astro server helper must use SDK')
  requireIncludes('astro-axhub/src/lib/axhub-server.ts', 'makeApp', 'Astro helper must expose app scope')
  requireIncludes('astro-axhub/src/lib/axhub-server.ts', 'table<Row', 'Astro helper must expose dynamic table helper')
}
requireNotIncludes('astro-axhub/src/lib/axhub.ts', 'fetch(url', 'Astro must not keep raw fetch helper once SDK server factory exists')
requireIncludes('astro-axhub/src/pages/index.astro', 'makeAxhub', 'Astro index must demonstrate SDK identity call')
requireIncludes('astro-axhub/src/pages/ssr.astro', 'makeAxhub', 'Astro SSR demo must demonstrate SDK identity call')

// SDK 3.x gateway model — grant-based sessions replace the removed catalog/engines surface
// and the in-band allowed flag (verified against backend 15fd5a2 + live prod E2E).
requireIncludes('nextjs-axhub/lib/axhub-server.ts', 'gw.me.connectors()', 'gateway helper must resolve connectors via me.connectors() (SDK 3.x)')
requireIncludes('nextjs-axhub/lib/axhub-server.ts', 'gw.sessions.create', 'gateway helper must open a grant-based session (SDK 3.x)')
requireIncludes('nextjs-axhub/lib/axhub-server.ts', 'gw.sessions.end', 'gateway helper must close the session in finally (SDK 3.x)')
for (const doc of [
  'nextjs-axhub/lib/axhub-server.ts', 'nextjs-axhub/AGENTS.md', 'nextjs-axhub/README.md',
  'nextjs-axhub/app/page.tsx', 'nextjs-axhub/prompts/getting-started.md',
]) {
  requireNotIncludes(doc, 'catalog.listConnectors', 'gateway catalog surface removed in SDK 3.x — use me.connectors()')
  requireNotIncludes(doc, 'connectors.list()', 'gateway connectors.list() removed in SDK 3.x — use me.connectors()')
  requireNotIncludes(doc, 'engines.list', 'gateway engines surface removed in SDK 3.x')
  requireNotIncludes(doc, 'res.allowed === false', 'in-band allowed flag removed — policy deny throws PermissionDeniedError (SDK 3.x)')
  requireNotIncludes(doc, 'PoolStaleError', 'gateway expiry surfaces as UnauthenticatedError in SDK 3.x, not PoolStaleError')
}

requireNotIncludes('vite-react-axhub/AGENTS.md', '@ax-hub/sdk', 'Vite browser template must not instruct agents to use the Node SDK in client bundles')
requireIncludes('vite-react-axhub/AGENTS.md', '브라우저 전용 세션 fetch 헬퍼', 'Vite docs must state browser-only helper boundary')
requireIncludes('README.md', '@ax-hub/sdk 3.x', 'root README must document Node SDK version boundary')
requireIncludes('docs/bootstrap-prep.md', '@ax-hub/sdk 3.x', 'bootstrap docs must document Node SDK version boundary')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('node sdk template verification passed')
