#!/usr/bin/env node
/**
 * design/ 의 정본을 세 템플릿에 뿌려요.
 *
 *   node scripts/sync-design.mjs          반영
 *   node scripts/sync-design.mjs --check  다른 곳이 있으면 실패 (CI 용)
 *
 * bootstrap 은 템플릿 폴더 하나만 복사하므로 세 템플릿이 각자 사본을 가져야 해요.
 * 손으로 고치면 갈라지니, 항상 design/ 만 고치고 이 스크립트를 돌리세요.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

/** 정본 → 템플릿별 사본 위치. astro 는 Tailwind 를 안 써서 CSS 만 받아요. */
const TARGETS = [
  { src: "design/tokens.css", dest: "vite-react-axhub/src/styles/tokens.css" },
  { src: "design/tokens.css", dest: "nextjs-axhub/app/tokens.css" },
  { src: "design/tokens.css", dest: "astro-axhub/src/styles/tokens.css" },
  { src: "design/tailwind-preset.js", dest: "vite-react-axhub/tailwind-preset.js" },
  { src: "design/tailwind-preset.js", dest: "nextjs-axhub/tailwind-preset.js" },
  { src: "scripts/check-design.sh", dest: "vite-react-axhub/scripts/check-design.sh" },
  { src: "scripts/check-design.sh", dest: "nextjs-axhub/scripts/check-design.sh" },
  { src: "scripts/check-design.sh", dest: "astro-axhub/scripts/check-design.sh" },
];

let failed = 0;

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
    console.error(`✗ ${dest} 가 design/${src.split("/")[1]} 와 달라요.`);
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
  console.log("✓ 세 템플릿의 디자인 파일이 정본과 같아요.");
} else {
  console.log("\n완료.");
}
