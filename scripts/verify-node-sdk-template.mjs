// 템플릿이 지금의 axhub 계약을 지키는지 검사해요. 레포 template/ 에서 실행:
//   node scripts/verify-node-sdk-template.mjs
//
// 지금 계약 (2026-10)
//   - 데이터: 앱 전용 PostgreSQL — lib/db.ts 의 db() tagged-template (SDK data API 아님)
//   - 신원: axhub 문이 실어 주는 X-AxHub-* 헤더 — lib/axhub-server.ts 의 me() (허브 재조회 없음)
//   - gateway·조직도: @ax-hub/sdk 6.x, 요청마다 makeAxhub() — 회사 앱 주소에서만
//   - 서버 전용 파일(lib/db · lib/axhub-server · lib/ai)은 "use client" 파일에서 import 금지
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const TEMPLATES = ['nextjs-axhub', 'chatbot-axhub']
const failures = []

const read = (path) => readFileSync(join(root, path), 'utf8')
const requireIncludes = (path, needle, reason) => {
  if (!read(path).includes(needle)) failures.push(`${path}: missing ${JSON.stringify(needle)} (${reason})`)
}
const requireNotIncludes = (path, needle, reason) => {
  if (read(path).includes(needle)) failures.push(`${path}: still contains ${JSON.stringify(needle)} (${reason})`)
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

for (const t of TEMPLATES) {
  // SDK 메이저 버전 — 6.x (gateway grant 세션 · tenants 디렉터리)
  const sdk = JSON.parse(read(`${t}/package.json`)).dependencies?.['@ax-hub/sdk'] ?? ''
  if (!/^\^6\./.test(sdk)) failures.push(`${t}/package.json: @ax-hub/sdk expected ^6.x, got ${sdk || 'missing'}`)

  // 데이터 = PostgreSQL
  requireIncludes(`${t}/lib/db.ts`, "import postgres from 'postgres'", 'data must go through the app PostgreSQL helper')
  requireIncludes(`${t}/lib/db.ts`, 'prepare: false', 'runtime pool must disable prepared statements (pooler)')
  requireIncludes(`${t}/AGENTS.md`, 'ensureSchema()', 'agent guide must teach the schema helper')

  // 신원 = 문이 넘긴 헤더
  requireIncludes(`${t}/lib/axhub-server.ts`, "h.get('x-axhub-user-id')", 'identity must come from gate headers')

  // gateway = SDK 6.x grant 세션
  requireIncludes(`${t}/lib/axhub-server.ts`, "import { AxHubClient", 'server helper must use the SDK')
  requireIncludes(`${t}/lib/axhub-server.ts`, 'defaultTenantSlug: TENANT', 'SDK client must be scoped by the injected tenant slug')
  requireIncludes(`${t}/lib/axhub-server.ts`, 'gw.me.connectors()', 'connectors resolve via me.connectors()')
  requireIncludes(`${t}/lib/axhub-server.ts`, 'gw.sessions.create', 'gateway opens a grant-based session')
  requireIncludes(`${t}/lib/axhub-server.ts`, 'gw.sessions.end', 'gateway closes the session in finally')

  // 문서 예시가 없는 API 를 가르치지 않게
  for (const doc of [`${t}/AGENTS.md`, `${t}/README.md`, `${t}/prompts/getting-started.md`]) {
    requireNotIncludes(doc, 'me.tenants', '`me` is a function in this template — use TENANT with makeAxhub()')
    requireNotIncludes(doc, 'catalog.listConnectors', 'gateway catalog surface was removed — use me.connectors()')
    requireNotIncludes(doc, 'app.data.', 'app data lives in PostgreSQL (lib/db.ts), not the SDK data API')
    requireNotIncludes(doc, '--branch', '`axhub deploy create` has no --branch flag — use --app <slug> --execute')
  }

  // axhub 기능 안내 — shared/AXHUB.md 사본이 있고 README·AGENTS 가 가리켜야 해요
  if (!existsSync(join(root, `${t}/AXHUB.md`))) failures.push(`${t}/AXHUB.md: missing (run node scripts/sync-design.mjs)`)
  requireIncludes(`${t}/README.md`, 'AXHUB.md', 'README must point users to the axhub feature guide')
  requireIncludes(`${t}/AGENTS.md`, 'AXHUB.md', 'agent guide must point agents to the axhub feature guide')

  // 서버 전용 파일을 브라우저 코드에서 import 하지 않기 (키·DB 주소 유출)
  for (const file of walk(join(root, t))) {
    const src = readFileSync(file, 'utf8')
    if (!/^\s*['"]use client['"]/.test(src)) continue
    for (const banned of ['@/lib/db', '@/lib/axhub-server', '@/lib/ai', '@anthropic-ai/sdk']) {
      if (src.includes(`'${banned}'`) || src.includes(`"${banned}"`)) {
        failures.push(`${relative(root, file)}: "use client" file imports server-only ${banned}`)
      }
    }
  }
}

if (!existsSync(join(root, 'chatbot-axhub/lib/ai.ts'))) failures.push('chatbot-axhub/lib/ai.ts: missing Claude boundary')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`template verification passed (${TEMPLATES.join(', ')})`)
