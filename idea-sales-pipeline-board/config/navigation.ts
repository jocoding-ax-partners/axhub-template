'use client'

// 아이콘(@phosphor-icons/react)이 브라우저 쪽 모듈이라 이 파일도 브라우저 쪽이에요. 서버 페이지에서 import 하지 마세요.
// 사이드바 메뉴. 화면을 추가하면 여기에 한 줄 더하면 돼요.
//
//   { label: "할 일", href: "/todos", icon: ListChecks }
//
// 아이콘은 @phosphor-icons/react 에서 골라요 (https://phosphoricons.com — 이름 그대로 import).
// href 가 http(s):// 로 시작하면 새 탭으로 열려요.
import { Kanban, ListBullets, type Icon } from "@phosphor-icons/react";

export type NavItem = {
  label: string;
  href: string;
  icon: Icon;
};

export const NAVIGATION: NavItem[] = [
  { label: "보드", href: "/", icon: Kanban },
  // 보드 한 열에 다 안 보이는 거래까지 찾아보는 곳이에요. 새 거래 · 고치기 화면도 /deals 아래에 있어요.
  { label: "거래 목록", href: "/deals", icon: ListBullets },
];
