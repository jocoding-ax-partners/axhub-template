'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Button, Drawer, buttonVariants } from '@heroui/react'
import { Plus, SidebarSimple, Trash } from '@phosphor-icons/react'
import { NavItem, NavList, Sidebar as SidebarFrame, useConfirm, type NavLinkRenderer, type NavSection } from '@/components/ax'
import type { Conversation } from '@/lib/chat-client'
import { NAVIGATION } from '@/config/navigation'

/**
 * 왼쪽 사이드바 — 새 대화 · 지난 대화 목록 · (있으면) 다른 화면 메뉴 · 로그인 정보.
 * 넓은 화면(768px 이상)에선 옆에 붙어 있고(접기 가능), 좁은 화면에선 서랍(Drawer)으로 열려요.
 * 틀은 콘솔과 같은 @jocoding-ax-partners/react 의 Sidebar · NavItem · NavList 예요.
 */

export type Visitor = {
  configured: boolean
  authenticated: boolean
  name: string
  loginHref: string
  logoutHref: string | null
}

type Props = {
  appName: string
  /** 넓은 화면에서 펼쳐져 있는지 */
  desktopOpen: boolean
  /** 좁은 화면에서 서랍이 열려 있는지 */
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
  conversations: Conversation[]
  activeId: string | null
  visitor: Visitor
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function Sidebar({ appName, desktopOpen, mobileOpen, onMobileOpenChange, visitor, onClose, onNew, ...list }: Props) {
  const header = (
    <>
      <div className="flex h-[var(--topbar-height)] items-center gap-2.5 pr-2 pl-4">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-caption-01 font-bold text-on-primary">ax</span>
        <span className="t-card-title min-w-0 flex-1 truncate">{appName}</span>
        <Button isIconOnly variant="ghost" size="sm" onPress={onClose} aria-label="사이드바 닫기">
          <SidebarSimple size={18} />
        </Button>
      </div>
      <div className="px-3 pt-1 pb-1">
        <Button variant="ghost" fullWidth className="justify-start" onPress={onNew}>
          <Plus weight="bold" />
          새 대화
        </Button>
      </div>
    </>
  )
  const footer = (
    <>
      <OtherScreens />
      <div className="flex items-center justify-between gap-2 border-t border-default px-4 py-3">
        <Account visitor={visitor} />
      </div>
    </>
  )
  const conversations = <ConversationList {...list} />

  return (
    <>
      {/* 넓은 화면 — 접으면 사라져요 */}
      <SidebarFrame className={`bg-surface ${desktopOpen ? 'md:flex' : 'lg:hidden'}`} header={header} footer={footer}>
        {conversations}
      </SidebarFrame>

      {/* 좁은 화면 — 위에 덮이는 서랍. 바깥 누르기 · Esc 로 닫혀요. */}
      <Drawer isOpen={mobileOpen} onOpenChange={onMobileOpenChange}>
        <Drawer.Backdrop>
          <Drawer.Content placement="left">
            <Drawer.Dialog aria-label="대화 목록" className="flex w-[var(--sidebar-width)] max-w-[85vw] flex-col gap-0 bg-surface p-0">
              {header}
              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">{conversations}</div>
              {footer}
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </>
  )
}

function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
}: Pick<Props, 'conversations' | 'activeId' | 'onSelect' | 'onDelete'>) {
  const confirm = useConfirm()
  if (conversations.length === 0) return <p className="t-small m-2">아직 대화가 없어요.</p>

  return (
    <nav aria-label="지난 대화" className="flex flex-col gap-0.5">
      {conversations.map((c) => (
        <div key={c.id} className="group flex items-center gap-1">
          <NavItem
            className="min-w-0 flex-1"
            label={<span title={c.title}>{c.title}</span>}
            active={c.id === activeId}
            onSelect={() => onSelect(c.id)}
          />
          {/* 마우스를 올리면 보여요. 터치 화면엔 hover 가 없어서 늘 보여요. */}
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            data-color="danger"
            className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
            aria-label={`대화 삭제: ${c.title}`}
            onPress={async () => {
              const ok = await confirm({
                title: '대화를 삭제할까요?',
                description: `"${c.title}" 대화가 이 브라우저에서 지워져요. 되돌릴 수 없어요.`,
                confirmLabel: '삭제',
                variant: 'danger',
              })
              if (ok) onDelete(c.id)
            }}
          >
            <Trash />
          </Button>
        </div>
      ))}
    </nav>
  )
}

/** 다른 화면으로 가는 메뉴 — 챗봇("/") 말고 config/navigation.ts 에 더한 것만 보여줘요. */
function OtherScreens() {
  const links = NAVIGATION.filter((item) => item.href !== '/')
  if (links.length === 0) return null
  const sections: NavSection[] = [
    { key: 'other', items: links.map((item) => ({ key: item.href, href: item.href, icon: item.icon, label: item.label })) },
  ]
  return (
    <div className="border-t border-default p-2">
      <NavList sections={sections} renderLink={renderLink} aria-label="다른 화면" />
    </div>
  )
}

function Account({ visitor }: { visitor: Visitor }): ReactNode {
  if (!visitor.configured) return <span className="t-caption">로컬 실행 중 · 대화는 이 브라우저에만 저장돼요</span>
  if (!visitor.authenticated) {
    // 로그인은 플랫폼 경로(/__axhub/auth/*)로 페이지째 이동해야 해서 <a> 에 버튼 모양만 입혀요.
    return (
      <a className={buttonVariants({ variant: 'primary', size: 'sm' })} href={visitor.loginHref}>
        axhub 로 로그인
      </a>
    )
  }
  return (
    <>
      {/* 회사 앱은 logoutHref 가 null — 버튼처럼 보이는 문구 대신 이름에 설명만 붙여요. */}
      <span
        className="t-small min-w-0 truncate"
        title={visitor.logoutHref ? undefined : '이 앱은 axhub 콘솔 로그인을 그대로 써요. 로그아웃은 콘솔에서 하세요.'}
      >
        {visitor.name}
      </span>
      {visitor.logoutHref && (
        <a className={buttonVariants({ variant: 'outline', size: 'sm' })} href={visitor.logoutHref}>
          로그아웃
        </a>
      )}
    </>
  )
}

/** 메뉴 링크 — 앱 안은 Next 의 Link, http(s) 주소는 새 탭. */
const renderLink: NavLinkRenderer = ({ href, children, ...rest }) =>
  /^https?:\/\//.test(href) ? (
    <a href={href} target="_blank" rel="noreferrer" {...rest}>
      {children}
    </a>
  ) : (
    <Link href={href} {...rest}>
      {children}
    </Link>
  )
