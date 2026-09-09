'use client'

import { useState } from 'react'
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

/** 좁은 화면용 메뉴 버튼 + 서랍. */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const path = usePathname()
  return (
    <>
      <button type="button" className="ax-menu-btn" aria-label="메뉴 열기" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <div className="ax-drawer" data-open={open}>
        <div className="ax-drawer-backdrop" onClick={() => setOpen(false)} />
        <nav className="ax-drawer-panel" aria-label="주 메뉴">
          {NAVIGATION.map((item) => (
            <NavLink key={item.href} item={item} path={path} onClick={() => setOpen(false)} />
          ))}
        </nav>
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
