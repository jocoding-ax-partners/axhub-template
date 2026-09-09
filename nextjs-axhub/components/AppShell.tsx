import type { ReactNode } from 'react'
import Link from 'next/link'
import { APP_NAME, isAxhubConfigured, loginUrl, logoutUrl, me } from '@/lib/axhub-server'
import { MobileNav, SideNav } from './Nav'

/**
 * 앱 전체 뼈대 — 상단바 + 사이드바 + 본문. axhub 콘솔과 같은 골격이에요.
 *
 * 화면을 추가할 땐 이 파일이 아니라 <AppShell> 안에 내용을 넣으세요.
 * 메뉴를 늘리려면 config/navigation.ts 를 고치세요.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  // 방문자 신원 — axhub 문이 요청마다 실어 주는 헤더를 읽어요 (허브 호출 없음).
  const visitor = await me()
  const configured = isAxhubConfigured()
  const loginHref = configured ? await loginUrl('/') : ''
  // 회사 앱은 끊을 앱 세션이 없어 null 이에요. 그땐 콘솔 로그아웃을 안내해요.
  const logoutHref = configured ? await logoutUrl('/') : null

  return (
    <div className="ax-shell">
      <header className="ax-topbar">
        <MobileNav />

        <Link className="ax-brand" href="/">
          <span className="ax-brand-mark">ax</span>
          <span className="ax-brand-name">{APP_NAME}</span>
        </Link>

        <div className="ax-topbar-main">
          {/* 메뉴·검색을 상단에 두고 싶으면 여기에 넣으세요. */}
          <div className="ax-topbar-center" />
          <div className="ax-topbar-right">
            {!configured ? (
              <span className="ax-caption ax-subtle">로컬 실행 중</span>
            ) : visitor.authenticated ? (
              <>
                <span className="ax-small">{visitor.name || visitor.email}</span>
                {logoutHref ? (
                  <a className="ax-btn ax-btn-ghost ax-btn-sm" href={logoutHref}>
                    로그아웃
                  </a>
                ) : (
                  <span className="ax-caption ax-subtle">콘솔에서 로그아웃</span>
                )}
              </>
            ) : (
              <a className="ax-btn ax-btn-primary ax-btn-sm" href={loginHref}>
                axhub 로 로그인
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="ax-body">
        <SideNav />
        <main className="ax-main">
          <div className="ax-container">{children}</div>
        </main>
      </div>
    </div>
  )
}
