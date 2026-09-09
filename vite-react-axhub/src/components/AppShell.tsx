import { useEffect, useState, type ReactNode } from "react";
import { axhub, type AxhubMe } from "../lib/axhub";
import { NAVIGATION, type NavItem } from "../config/navigation";

/**
 * 앱 전체 뼈대 — 상단바 + 사이드바 + 본문. axhub 콘솔과 같은 골격이에요.
 *
 * 화면을 추가할 땐 이 파일이 아니라 <AppShell> 안에 내용을 넣으세요.
 * 메뉴를 늘리려면 src/config/navigation.ts 를 고치세요.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AxhubMe | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const path = window.location.pathname;

  useEffect(() => {
    if (!axhub.isConfigured) return;
    // 방문자 신원 — axhub 문이 실어 준 헤더를 nginx 가 돌려준 결과예요 (허브 호출 없음).
    axhub.me().then(setMe).catch(() => setMe(null));
  }, []);

  return (
    <div className="ax-shell">
      <header className="ax-topbar">
        <button
          type="button"
          className="ax-menu-btn"
          aria-label="메뉴 열기"
          onClick={() => setDrawerOpen(true)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <a className="ax-brand" href="/">
          <span className="ax-brand-mark">ax</span>
          <span className="ax-brand-name">{axhub.name}</span>
        </a>

        <div className="ax-topbar-main">
          {/* 메뉴·검색을 상단에 두고 싶으면 여기에 넣으세요. */}
          <div className="ax-topbar-center" />
          <div className="ax-topbar-right">
            <UserArea me={me} />
          </div>
        </div>
      </header>

      <div className="ax-body">
        <nav className="ax-sidebar" aria-label="주 메뉴">
          {NAVIGATION.map((item) => (
            <NavLink key={item.href} item={item} path={path} />
          ))}
        </nav>

        <main className="ax-main">
          <div className="ax-container">{children}</div>
        </main>
      </div>

      {/* 좁은 화면용 서랍 */}
      <div className="ax-drawer" data-open={drawerOpen}>
        <div className="ax-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
        <nav className="ax-drawer-panel" aria-label="주 메뉴">
          {NAVIGATION.map((item) => (
            <NavLink key={item.href} item={item} path={path} />
          ))}
        </nav>
      </div>
    </div>
  );
}

function NavLink({ item, path }: { item: NavItem; path: string }) {
  const active = !item.external && item.href === path;
  return (
    <a
      className="ax-nav-item"
      href={item.href}
      aria-current={active ? "page" : undefined}
      {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={item.icon} />
      </svg>
      {item.label}
    </a>
  );
}

/** 상단바 오른쪽 — 익명이면 로그인, 로그인 상태면 이름과 로그아웃. */
function UserArea({ me }: { me: AxhubMe | null }) {
  if (!axhub.isConfigured) {
    return <span className="ax-caption ax-subtle">로컬 실행 중</span>;
  }
  if (!me) return null;

  if (!me.authenticated) {
    return (
      <a className="ax-btn ax-btn-primary ax-btn-sm" href={axhub.loginUrl()}>
        axhub 로 로그인
      </a>
    );
  }

  // 회사 앱은 끊을 앱 세션이 없어 null 이에요.
  // 그땐 버튼처럼 보이는 문구를 두지 않고 이름에 설명만 붙여요.
  const logout = axhub.logoutUrl("/");
  return (
    <>
      <span className="ax-small" title={logout ? undefined : "이 앱은 axhub 콘솔 로그인을 그대로 써요. 로그아웃은 콘솔에서 하세요."}>
        {me.name || me.email}
      </span>
      {logout && (
        <a className="ax-btn ax-btn-ghost ax-btn-sm" href={logout}>
          로그아웃
        </a>
      )}
    </>
  );
}
