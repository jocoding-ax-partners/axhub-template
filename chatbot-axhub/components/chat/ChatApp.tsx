'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  loadConversations,
  newId,
  nowMs,
  saveConversations,
  storageKey,
  streamChat,
  titleFrom,
  type Conversation,
  type Turn,
} from '@/lib/chat-client'
import { Composer, type ComposerHandle } from './Composer'
import { Icon } from './Icon'
import { MessageList } from './MessageList'
import { Sidebar, type Visitor } from './Sidebar'

/**
 * 챗봇 화면 전체 — 상태는 전부 여기 있어요.
 *
 *   ┌ Sidebar ─┐┌ 상단바 (메뉴 · 대화 제목 · 모델) ──────────┐
 *   │ 새 대화   ││ MessageList  ← 이 영역만 스크롤돼요         │
 *   │ 지난 대화 ││                                           │
 *   │ …        ││ Composer     ← 늘 아래에 붙어 있어요        │
 *   └──────────┘└───────────────────────────────────────────┘
 *
 * 흐름: send() → 내 말 + 빈 AI 답을 붙이고 → streamChat() 이 조각을 받을 때마다 AI 답에 이어 붙여요.
 * 대화 목록은 이 브라우저(localStorage)에 저장돼요 (lib/chat-client.ts).
 */

type Props = {
  appName: string
  assistantName: string
  greeting: string
  suggestions: readonly string[]
  modelLabel: string
  /** 로그인한 사람마다 대화를 따로 저장할 때 쓰는 열쇠 (이메일·user_id) */
  userKey: string
  visitor: Visitor
  /** 키가 없을 때 보여줄 설정 안내. 있으면 입력창이 잠겨요. */
  setup?: ReactNode
}

const subscribeNothing = () => () => {}

export function ChatApp(props: Props) {
  // 서버가 그린 첫 화면과 브라우저의 첫 화면이 같아야 해서(hydration), 저장된 대화는
  // 브라우저에서 다시 그릴 때 읽어요. inBrowser 가 true 로 바뀌면 ChatScreen 을 새로 만들어
  // 그때 localStorage 의 대화 목록으로 시작해요.
  const inBrowser = useSyncExternalStore(subscribeNothing, () => true, () => false)
  const key = storageKey(props.userKey)
  return <ChatScreen key={inBrowser ? key : 'server'} storage={inBrowser ? key : null} {...props} />
}

function ChatScreen({
  appName,
  assistantName,
  greeting,
  suggestions,
  modelLabel,
  visitor,
  setup,
  storage,
}: Props & { storage: string | null }) {
  // storage 가 null 이면 서버에서 그리는 중 — 저장소를 읽지도 쓰지도 않아요.
  const [conversations, setConversations] = useState<Conversation[]>(() => (storage ? loadConversations(storage) : []))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [followKey, setFollowKey] = useState('init')
  // 사이드바: 'auto' 는 넓은 화면에선 열림, 좁은 화면에선 닫힘 (CSS 가 정해요). 누르면 true/false 로 고정.
  const [sidebar, setSidebar] = useState<'auto' | boolean>('auto')
  const abortRef = useRef<AbortController | null>(null)
  const composerRef = useRef<ComposerHandle>(null)

  const active = conversations.find((c) => c.id === activeId) ?? null
  const turns = active?.turns ?? []

  // ── 저장소 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!storage) return
    // 답을 받는 중엔 조각마다 저장하지 않고, 잠깐 멈췄을 때 한 번에 저장해요.
    const timer = setTimeout(() => saveConversations(storage, conversations), busy ? 1000 : 150)
    return () => clearTimeout(timer)
  }, [conversations, storage, busy])

  // ── 대화 조작 ─────────────────────────────────────────────────────────────
  const updateConversation = useCallback((id: string, fn: (c: Conversation) => Conversation) => {
    setConversations((list) => {
      const next = list.map((c) => (c.id === id ? fn(c) : c))
      // 방금 바뀐 대화를 목록 맨 위로
      next.sort((a, b) => b.updatedAt - a.updatedAt)
      return next
    })
  }, [])

  const updateTurn = useCallback(
    (convId: string, turnId: string, fn: (t: Turn) => Turn) =>
      updateConversation(convId, (c) => ({ ...c, turns: c.turns.map((t) => (t.id === turnId ? fn(t) : t)) })),
    [updateConversation],
  )

  /** history 를 보내고, 그 뒤에 붙인 빈 AI 답(answerId)에 결과를 채워요. */
  async function run(convId: string, history: Turn[], answerId: string) {
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    await streamChat(
      history.map((t) => ({ role: t.role, content: t.content })),
      controller.signal,
      {
        onText: (chunk) => updateTurn(convId, answerId, (t) => ({ ...t, content: t.content + chunk })),
        onNotice: (message) => updateTurn(convId, answerId, (t) => ({ ...t, notice: message })),
        onError: (message) => updateTurn(convId, answerId, (t) => ({ ...t, error: message })),
      },
    )
    // 사용자가 멈췄으면 끊긴 답 끝에 표시를 남겨요 (이어서 "다시 생성" 할 수 있어요).
    if (controller.signal.aborted) {
      updateTurn(convId, answerId, (t) => (t.content ? { ...t, notice: '답을 멈췄어요.' } : { ...t, error: '답을 멈췄어요.' }))
    }
    if (abortRef.current === controller) abortRef.current = null
    setBusy(false)
    composerRef.current?.focus()
  }

  function send(text: string) {
    if (busy) return
    const now = nowMs()
    const userTurn: Turn = { id: newId(), role: 'user', content: text }
    const answer: Turn = { id: newId(), role: 'assistant', content: '' }

    let convId = activeId
    let history: Turn[]
    if (!active) {
      convId = newId()
      history = [userTurn]
      setConversations((list) => [{ id: convId!, title: titleFrom(text), turns: [userTurn, answer], updatedAt: now }, ...list])
      setActiveId(convId)
    } else {
      // 실패했던 마지막 답은 보내지 않아요 (빈 답이 대화에 섞이면 안 돼요).
      history = [...active.turns.filter((t) => !(t.role === 'assistant' && (t.error || !t.content))), userTurn]
      updateConversation(active.id, (c) => ({ ...c, turns: [...c.turns, userTurn, answer], updatedAt: now }))
    }
    setFollowKey(userTurn.id)
    void run(convId!, history, answer.id)
  }

  /** 마지막 AI 답을 지우고 같은 질문으로 다시 받아요 ("다시 생성" · "다시 시도"). */
  function regenerate() {
    if (busy || !active) return
    const lastUser = active.turns.map((t) => t.role).lastIndexOf('user')
    if (lastUser < 0) return
    const history = active.turns.slice(0, lastUser + 1).filter((t) => !(t.role === 'assistant' && (t.error || !t.content)))
    const answer: Turn = { id: newId(), role: 'assistant', content: '' }
    updateConversation(active.id, (c) => ({ ...c, turns: [...c.turns.slice(0, lastUser + 1), answer], updatedAt: nowMs() }))
    setFollowKey(answer.id)
    void run(active.id, history, answer.id)
  }

  function stop() {
    abortRef.current?.abort()
  }

  function closeSidebarOnMobile() {
    if (window.matchMedia('(max-width: 767px)').matches) setSidebar(false)
  }

  function startNew() {
    stop()
    setActiveId(null)
    setFollowKey(newId())
    closeSidebarOnMobile()
    composerRef.current?.focus()
  }

  function select(id: string) {
    if (id === activeId) return closeSidebarOnMobile()
    stop()
    setActiveId(id)
    setFollowKey(id)
    closeSidebarOnMobile()
  }

  function remove(id: string) {
    if (id === activeId) startNew()
    setConversations((list) => list.filter((c) => c.id !== id))
  }

  function toggleSidebar() {
    const desktop = window.matchMedia('(min-width: 768px)').matches
    setSidebar((s) => (s === 'auto' ? !desktop : !s))
  }

  // Esc 로 답 멈추기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && abortRef.current) abortRef.current.abort()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const empty = (
    <div className="chat-column chat-empty">
      {setup ?? (
        <>
          <div className="chat-empty-mark" aria-hidden="true">
            <Icon name="chat" size={26} />
          </div>
          <h1 className="chat-empty-title">{greeting}</h1>
          <div className="chat-suggestions">
            {suggestions.map((s) => (
              <button key={s} type="button" className="chat-suggestion" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="chat-app">
      <Sidebar
        appName={appName}
        open={sidebar}
        conversations={conversations}
        activeId={activeId}
        visitor={visitor}
        onNew={startNew}
        onSelect={select}
        onDelete={remove}
        onClose={toggleSidebar}
      />

      <main className="chat-main">
        <header className="chat-topbar">
          <button
            type="button"
            className="chat-icon-btn chat-sidebar-toggle"
            data-sidebar={String(sidebar)}
            onClick={toggleSidebar}
            aria-label="사이드바 열기"
            title="사이드바"
          >
            <Icon name="menu" />
          </button>
          <span className="chat-topbar-title">{active?.title ?? assistantName}</span>
          <span className="chat-model" title="쓰는 AI 모델">
            {modelLabel}
          </span>
          <button type="button" className="chat-icon-btn" onClick={startNew} aria-label="새 대화" title="새 대화">
            <Icon name="plus" />
          </button>
        </header>

        <MessageList turns={turns} streaming={busy} followKey={followKey} empty={empty} onRegenerate={regenerate} />

        <div className="chat-composer-wrap">
          <Composer
            ref={composerRef}
            busy={busy}
            disabled={Boolean(setup)}
            placeholder={setup ? 'AI 키를 넣으면 대화할 수 있어요' : `${assistantName}에게 메시지 보내기`}
            onSend={send}
            onStop={stop}
          />
          <p className="chat-hint">
            AI 답은 틀릴 수 있어요. 중요한 내용은 꼭 확인하세요.
            <span className="chat-hint-keys"> · Enter 보내기 · Shift+Enter 줄바꿈 · Esc 멈추기</span>
          </p>
        </div>
      </main>
    </div>
  )
}
