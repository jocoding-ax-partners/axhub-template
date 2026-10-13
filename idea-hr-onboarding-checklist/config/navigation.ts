'use client'

// 아이콘(@phosphor-icons/react)이 브라우저 쪽 모듈이라 이 파일도 브라우저 쪽이에요. 서버 페이지에서 import 하지 마세요.
// 사이드바 메뉴. 화면을 추가하면 여기에 한 줄 더하면 돼요.
//
//   { label: "할 일", href: "/todos", icon: ListChecks }
//
// 아이콘은 @phosphor-icons/react 에서 골라요 (https://phosphoricons.com — 이름 그대로 import).
// href 가 http(s):// 로 시작하면 새 탭으로 열려요.
import { ListChecks, UsersThree, type Icon } from "@phosphor-icons/react";

export type NavItem = {
  label: string;
  href: string;
  icon: Icon;
};

export const NAVIGATION: NavItem[] = [
  // 입사자 상세(/hires/123)는 메뉴에 없어요 — 목록에서 눌러 들어가요.
  { label: "입사자 목록", href: "/", icon: UsersThree },
  // 누구나 볼 수 있고, 추가·삭제는 관리자만 해요 (app/settings/page.tsx · app/actions.ts).
  { label: "기본 체크리스트", href: "/settings", icon: ListChecks },
];
