'use client'

// 아이콘(@phosphor-icons/react)이 브라우저 쪽 모듈이라 이 파일도 브라우저 쪽이에요. 서버 페이지에서 import 하지 마세요.
// 사이드바 메뉴. 화면을 추가하면 여기에 한 줄 더하면 돼요.
//
//   { label: "할 일", href: "/todos", icon: ListChecks }
//
// 아이콘은 @phosphor-icons/react 에서 골라요 (https://phosphoricons.com — 이름 그대로 import).
// href 가 http(s):// 로 시작하면 새 탭으로 열려요.
import { ClipboardText, Wrench, type Icon } from "@phosphor-icons/react";

export type NavItem = {
  label: string;
  href: string;
  icon: Icon;
};

export const NAVIGATION: NavItem[] = [
  { label: "고장 신고", href: "/", icon: Wrench },
  // 담당자(관리자)만 쓸 수 있는 화면이에요. 다른 사람이 눌러도 화면에서 막혀요 (app/admin/page.tsx).
  { label: "신고 관리", href: "/admin", icon: ClipboardText },
];
