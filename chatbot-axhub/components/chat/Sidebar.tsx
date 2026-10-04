'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Conversation } from '@/lib/chat-client'
import { NAVIGATION } from '@/config/navigation'
import { Icon } from './Icon'

/**
 * 왼쪽 사이드바 — 새 대화 · 지난 대화 목록 · (있으면) 다른 화면 메뉴 · 로그인 정보.
 * 넓은 화면에선 늘 붙어 있고(접기 가능), 좁은 화면에선 서랍처럼 열려요.
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
  /** 'auto' = 넓은 화면에선 열림·좁은 화면에선 닫힘 (CSS 가 정해요) */
  open: 'auto' | boolean
  conversations: Conversation[]
  activeId: string | null
  visitor: Visitor
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function Sidebar({ appName, open, conversations, activeId, visitor, onNew, onSelect, onDelete, onClose }: Props) {
  // 다른 화면으로 가는 메뉴 — 챗봇("/") 말고 config/navigation.ts 에 더한 것만 보여줘요.
  const links = NAVIGATION.filter((item) => item.href !== '/')

  return (
    <>
      <div className="chat-backdrop" data-open={String(open)} onClick={onClose} />
      <aside className="chat-sidebar" data-open={String(open)} aria-label="대화 목록">
        <div className="chat-sidebar-head">
          <span className="ax-brand-mark">ax</span>
          <span className="chat-sidebar-title">{appName}</span>
          <button type="button" className="chat-icon-btn" onClick={onClose} aria-label="사이드바 닫기" title="사이드바 닫기">
            <Icon name="sidebar" />
          </button>
        </div>

        <div className="chat-sidebar-new">
          <button type="button" className="ax-btn ax-btn-ghost chat-new-btn" onClick={onNew}>
            <Icon name="plus" size={16} /> 새 대화
          </button>
        </div>

        <nav className="chat-conv-list" aria-label="지난 대화">
          {conversations.length === 0 ? (
            <p className="chat-conv-empty">아직 대화가 없어요.</p>
          ) : (
            conversations.map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                active={c.id === activeId}
                onSelect={() => onSelect(c.id)}
                onDelete={() => onDelete(c.id)}
              />
            ))
          )}
        </nav>

        {links.length > 0 && (
          <nav className="chat-sidebar-links" aria-label="다른 화면">
            {links.map((item) => (
              <Link key={item.href} className="ax-nav-item" href={item.href} target={item.external ? '_blank' : undefined}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="chat-sidebar-foot">
          {!visitor.configured ? (
            <span className="ax-caption ax-subtle">로컬 실행 중 · 대화는 이 브라우저에만 저장돼요</span>
          ) : visitor.authenticated ? (
            <>
              <span className="chat-foot-name">{visitor.name}</span>
              {visitor.logoutHref && (
                <a className="ax-btn ax-btn-ghost ax-btn-sm" href={visitor.logoutHref}>
                  로그아웃
                </a>
              )}
            </>
          ) : (
            <a className="ax-btn ax-btn-primary ax-btn-sm" href={visitor.loginHref}>
              axhub 로 로그인
            </a>
          )}
        </div>
      </aside>
    </>
  )
}

function ConversationItem({
  conversation,
  active,
  onSelect,
  onDelete,
}: {
  conversation: Conversation
  active: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  // 삭제는 두 번 눌러야 돼요 (실수 방지). 한 번 누르면 "삭제?" 로 바뀌어요.
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="chat-conv" aria-current={active ? 'page' : undefined} onMouseLeave={() => setConfirming(false)}>
      <button type="button" className="chat-conv-title" onClick={onSelect} title={conversation.title}>
        {conversation.title}
      </button>
      <button
        type="button"
        className="chat-conv-del"
        data-confirm={confirming || undefined}
        onClick={() => (confirming ? onDelete() : setConfirming(true))}
        aria-label={confirming ? '정말 삭제' : '대화 삭제'}
        title={confirming ? '한 번 더 누르면 삭제돼요' : '대화 삭제'}
      >
        {confirming ? '삭제?' : <Icon name="trash" size={15} />}
      </button>
    </div>
  )
}
