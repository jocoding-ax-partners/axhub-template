// 사이드바 메뉴. 화면을 추가하면 여기에 한 줄 더하면 돼요.
//
//   { label: "할 일", href: "/todos", icon: ICONS.list }
//
// 바깥 사이트로 나가는 링크는 external: true 를 붙여요.
// icon 은 24×24 SVG 의 path 예요. 새 아이콘이 필요하면 path 문자열만 추가하세요.

export const ICONS = {
  home: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5",
  book: "M4 4.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4zM20 4.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h6z",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  code: "M9 18 3 12l6-6M15 6l6 6-6 6",
} as const;

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  /** 바깥 사이트로 나가는 링크면 true */
  external?: boolean;
};

export const NAVIGATION: NavItem[] = [
  { label: "홈", href: "/", icon: ICONS.home },
  { label: "SSR 데모", href: "/ssr", icon: ICONS.code },
];
