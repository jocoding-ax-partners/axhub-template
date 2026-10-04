/* ══════════════════════════════════════════════════════════════════════════
 * axhub 디자인 토큰 → Tailwind 매핑
 *
 * ⚠️ 이 파일은 자동 생성돼요. 직접 고치지 마세요.
 *    정본: axhub-template 레포의 design/tailwind-preset.js
 *    반영: node scripts/sync-design.mjs
 *
 * 이게 있어서 `text-muted` `bg-content` `rounded-card` 같은 클래스를 바로 쓸 수 있어요.
 * 색과 크기는 tokens.css 의 변수를 가리키므로, 다크 모드에서 클래스는 그대로 두고
 * 색만 바뀌어요.
 *
 * 쓰면 안 되는 것: text-gray-500, bg-white, #hex, text-[15px] 같은 생값.
 * ══════════════════════════════════════════════════════════════════════════ */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          soft: "var(--primary-soft)",
          fg: "var(--primary-fg)",
        },
        surface: "var(--bg-surface)",
        content: "var(--bg-content)",
        muted: "var(--bg-muted)",

        default: "var(--fg-default)",
        secondary: "var(--fg-secondary)",
        subtle: "var(--fg-subtle)",

        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
      },
      textColor: {
        default: "var(--fg-default)",
        secondary: "var(--fg-secondary)",
        muted: "var(--fg-muted)",
        subtle: "var(--fg-subtle)",
      },
      borderColor: {
        DEFAULT: "var(--border-default)",
        default: "var(--border-default)",
        strong: "var(--border-strong)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
      },
      fontSize: {
        "page-title": ["var(--text-page-title)", { lineHeight: "1.25", fontWeight: "700" }],
        section: ["var(--text-section)", { lineHeight: "1.4", fontWeight: "600" }],
        "card-title": ["var(--text-card-title)", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["var(--text-body)", { lineHeight: "1.6" }],
        small: ["var(--text-small)", { lineHeight: "1.6" }],
        caption: ["var(--text-caption)", { lineHeight: "1.5" }],
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      maxWidth: {
        content: "var(--content-max)",
      },
      spacing: {
        section: "var(--section-gap)",
      },
    },
  },
};
