/** @type {import('tailwindcss').Config} */
export default {
  // axhub 디자인 토큰 → Tailwind 매핑. `text-muted` `bg-content` `rounded-card` 같은
  // 클래스가 여기서 나와요. 색·크기는 항상 이 클래스로 쓰고 생값을 넣지 마세요.
  presets: [require("./tailwind-preset.js")],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  plugins: [],
};
