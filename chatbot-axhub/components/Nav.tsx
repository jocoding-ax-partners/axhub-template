'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAVIGATION, type NavItem } from '@/config/navigation'

/** 사이드바 (넓은 화면). 메뉴는 config/navigation.ts 에서 고쳐요. */
export function SideNav() {
  const path = usePathname()
  return (
    <nav className="ax-sidebar" aria-label="주 메뉴">
      {NAVIGATION.map((item) => (
        <NavLink key={item.href} item={item} path={path} />
      ))}
    </nav>
  )
}

/**
 * 좁은 화면용 메뉴 버튼 + 서랍.
 * 서랍 = 위(앱 이름·닫기) · 가운데(메뉴) · 아래(로그인 정보, AppShell 이 넘겨줘요).
 * 열려 있는 동안 뒤 화면은 스크롤되지 않고, 바깥 누르기 · Esc · 메뉴 이동으로 닫혀요.
 */
export function MobileNav({ appName, account }: { appName: string; account?: ReactNode }) {
  const path = usePathname()
  // 서랍을 연 화면의 주소를 기억해요. 다른 화면으로 이동하면 주소가 달라져 저절로 닫혀요.
  const [openedAt, setOpenedAt] = useState<string | null>(null)
  const open = openedAt === path
  const setOpen = (next: boolean) => setOpenedAt(next ? path : null)

  // 열려 있는 동안: 뒤 화면 스크롤 막기 + Esc 로 닫기
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenedAt(null)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button type="button" className="ax-menu-btn" aria-label="메뉴 열기" aria-expanded={open} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <div className="ax-drawer" data-open={open}>
        <div className="ax-drawer-backdrop" onClick={() => setOpen(false)} />
        <div className="ax-drawer-panel" role="dialog" aria-modal="true" aria-label="메뉴">
          <div className="ax-drawer-head">
            <span className="ax-brand-mark">ax</span>
            <span className="ax-brand-name">{appName}</span>
            <button type="button" className="ax-icon-btn" aria-label="메뉴 닫기" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <nav className="ax-drawer-nav" aria-label="주 메뉴">
            {NAVIGATION.map((item) => (
              <NavLink key={item.href} item={item} path={path} onClick={() => setOpen(false)} />
            ))}
          </nav>
          {account && <div className="ax-drawer-foot">{account}</div>}
        </div>
      </div>
    </>
  )
}

function NavLink({ item, path, onClick }: { item: NavItem; path: string; onClick?: () => void }) {
  const active = !item.external && item.href === path
  const inner = (
    <>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={item.icon} />
      </svg>
      {item.label}
    </>
  )

  if (item.external) {
    return (
      <a className="ax-nav-item" href={item.href} target="_blank" rel="noreferrer" onClick={onClick}>
        {inner}
      </a>
    )
  }
  return (
    <Link className="ax-nav-item" href={item.href} aria-current={active ? 'page' : undefined} onClick={onClick}>
      {inner}
    </Link>
  )
}
