#!/usr/bin/env node
/**
 * design/ · shared/ 의 정본을 모든 템플릿에 뿌려요.
 *
 *   node scripts/sync-design.mjs          반영
 *   node scripts/sync-design.mjs --check  다른 곳이 있으면 실패 (CI 용)
 *
 * bootstrap 은 템플릿 폴더 하나만 복사하므로 템플릿마다 각자 사본을 가져야 해요.
 * 손으로 고치면 갈라지니, 항상 design/ 만 고치고 이 스크립트를 돌리세요.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

// 템플릿 폴더
const TEMPLATES = ["nextjs-axhub", "chatbot-axhub"];

/**
 * 정본 → 템플릿별 사본 위치.
 * design/axhub.css = Tailwind 4 + HeroUI v3 + axhub design-system 진입점. 각 템플릿의
 * app/globals.css 가 `@import "./axhub.css";` 로 가져와요 (globals.css 자체는 템플릿 소유).
 */
const TARGETS = TEMPLATES.flatMap((t) => [
  { src: "design/axhub.css", dest: `${t}/app/axhub.css` },
  { src: "scripts/check-design.sh", dest: `${t}/scripts/check-design.sh` },
  // axhub 활용 안내 — 템플릿마다 같은 내용 (README · AGENTS.md 가 링크해요)
  { src: "shared/AXHUB.md", dest: `${t}/AXHUB.md` },
]);

/** Tailwind 3 시절 파일 — 남아 있으면 옮기기가 덜 끝난 거예요 (스크립트는 지우지 않아요). */
const STALE = ["app/tokens.css", "tailwind-preset.js", "tailwind.config.ts", "tailwind.config.js"];

let failed = 0;

for (const t of TEMPLATES) {
  for (const f of STALE) {
    if (existsSync(join(root, t, f))) {
      console.error(`✗ ${t}/${f} 는 이제 안 써요 — 지우세요 (Tailwind 4 로 옮기기, design/README.md).`);
      failed += 1;
    }
  }
}

for (const { src, dest } of TARGETS) {
  const from = join(root, src);
  const to = join(root, dest);
  const want = readFileSync(from, "utf8");

  let have = null;
  try {
    have = readFileSync(to, "utf8");
  } catch {
    /* 아직 없음 */
  }

  if (have === want) {
    if (!check) console.log(`  = ${dest}`);
    continue;
  }

  if (check) {
    console.error(`✗ ${dest} 가 ${src} 와 달라요.`);
    failed += 1;
    continue;
  }

  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, want);
  console.log(`  → ${dest}`);
}

if (check) {
  if (failed > 0) {
    console.error(`\n디자인 정본과 다른 파일이 ${failed}개 있어요. node scripts/sync-design.mjs 를 실행하세요.`);
    process.exit(1);
  }
  console.log("✓ 모든 템플릿의 디자인 파일이 정본과 같아요.");
} else {
  console.log("\n완료.");
}
