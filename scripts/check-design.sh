#!/usr/bin/env bash
# 디자인 토큰 회귀 검사.
#
#   bash scripts/check-design.sh              레포 전체 (세 템플릿)
#   bash scripts/check-design.sh <템플릿폴더>  한 템플릿만 (배포 전 ci 용)
#
# 잡는 것
#   1) 생색  — #hex, bg-[#...], style="color:#..."
#   2) 생크기 — text-[15px] 같은 arbitrary 크기
#   3) Tailwind 기본 팔레트 — text-gray-500, bg-white 등 (토큰 대신 쓰면 색이 안 따라옴)
#
# 예외가 필요하면 같은 줄에 `design-token-allow` 주석을 다세요.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCOPE="${1:-}"
cd "$ROOT"

if [ -n "$SCOPE" ]; then
  DIRS=("$SCOPE")
elif [ -d vite-react-axhub ] && [ -d nextjs-axhub ]; then
  # 템플릿 레포 — 세 템플릿을 모두 검사
  DIRS=(vite-react-axhub nextjs-axhub astro-axhub)
else
  # 앱 안 — 자기 소스만 검사
  DIRS=(.)
fi

# tokens.css 는 값을 정의하는 곳이라 당연히 hex 가 있어요. 검사 대상에서 뺍니다.
COMMON=(--include=*.tsx --include=*.ts --include=*.astro --include=*.jsx --include=*.js
        --exclude=tokens.css --exclude=tailwind-preset.js
        --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next --exclude-dir=prompts)

found=0

scan() {
  local title="$1" pattern="$2" hint="$3"
  local hits=""
  for d in "${DIRS[@]}"; do
    [ -d "$d" ] || continue
    local out
    out=$(grep -rnE "$pattern" "${COMMON[@]}" "$d" 2>/dev/null \
          | grep -v "design-token-allow" \
          | grep -vE ":[[:space:]]*(\*|//|<!--)" || true)
    [ -n "$out" ] && hits+="$out"$'\n'
  done
  if [ -n "$hits" ]; then
    echo
    echo "✗ $title"
    echo "$hits" | sed '/^$/d' | head -30
    echo "  → $hint"
    found=1
  fi
}

scan "생색(hex) 사용" \
  "(#[0-9a-fA-F]{3,8}\b|(bg|text|border|fill|stroke)-\[#[0-9a-fA-F]+\])" \
  "var(--primary) 같은 토큰이나 text-muted / bg-content 클래스를 쓰세요."

scan "생크기 사용" \
  "(text|w|h|p|m|gap|rounded)-\[[0-9]+(\.[0-9]+)?(px|rem)\]" \
  "text-body / text-small / rounded-card 처럼 토큰 클래스를 쓰거나 var(--text-small) 을 쓰세요."

scan "Tailwind 기본 팔레트 사용" \
  "(text|bg|border|ring|divide)-(gray|slate|zinc|neutral|stone|blue|red|green|yellow|indigo|violet)-[0-9]{2,3}\b|(bg|text)-(white|black)\b" \
  "토큰 클래스(text-muted, bg-content, border-default, text-danger)를 쓰세요. 색이 다크 모드를 따라가야 해요."

if [ "$found" -eq 0 ]; then
  echo "✓ 디자인 토큰 규칙 통과."
fi
exit "$found"
