'use client'

// 아이콘(@phosphor-icons/react)이 브라우저 쪽 모듈이라 이 파일도 브라우저 쪽이에요. 서버 페이지에서 import 하지 마세요.
// 메뉴. 챗봇 화면("/")은 왼쪽 사이드바가 대화 목록이라, 여기에 더한 다른 화면은
// 그 사이드바 아래쪽 "다른 화면" 에 보여요 (components/chat/Sidebar.tsx).
// 화면을 추가하면 여기에 한 줄 더하면 돼요.
//
//   { label: "자료실", href: "/docs", icon: BookOpen }
//
// 아이콘은 @phosphor-icons/react 에서 골라요 (https://phosphoricons.com — 이름 그대로 import).
// href 가 http(s):// 로 시작하면 새 탭으로 열려요.
import { ChatCircle, type Icon } from "@phosphor-icons/react";

export type NavItem = {
  label: string;
  href: string;
  icon: Icon;
};

export const NAVIGATION: NavItem[] = [
  { label: "대화", href: "/", icon: ChatCircle },
];
