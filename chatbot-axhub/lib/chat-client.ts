'use client'

/**
 * 브라우저 쪽 채팅 도우미 — 대화 저장(이 브라우저)과 /api/chat 스트리밍 읽기.
 *
 * 대화는 localStorage 에 저장돼요. 같은 브라우저에서는 새로고침해도 남지만,
 * 다른 기기·브라우저와는 공유되지 않아요. 여러 기기에서 이어 보려면 DB 저장으로 바꿔요
 * (AGENTS.md "대화 저장하기").
 */

export type Turn = {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** 답 끝에 붙는 안내 (거절·길이 초과) */
  notice?: string
  /** 실패했을 때의 이유. 있으면 화면이 "다시 시도" 를 보여줘요. */
  error?: string
}

export type Conversation = {
  id: string
  title: string
  turns: Turn[]
  updatedAt: number
}

const MAX_CONVERSATIONS = 50

/** 로그인한 사람마다 따로 저장해요. 같은 브라우저를 여러 사람이 써도 섞이지 않게. */
export function storageKey(userKey: string): string {
  return `chatbot-axhub:conversations:v1:${userKey || 'anonymous'}`
}

export function loadConversations(key: string): Conversation[] {
  try {
    const raw = window.localStorage.getItem(key)
    const list: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    return list.filter(
      (c): c is Conversation => !!c && typeof c.id === 'string' && Array.isArray(c.turns),
    )
  } catch {
    return [] // 사생활 보호 모드 등에서 저장소를 못 쓰면 빈 목록으로 시작해요
  }
}

export function saveConversations(key: string, list: Conversation[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(list.slice(0, MAX_CONVERSATIONS)))
  } catch {
    // 저장 공간이 꽉 찼거나 막혀 있어도 대화는 계속돼요
  }
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** 첫 질문으로 대화 제목을 만들어요. */
export function titleFrom(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > 30 ? `${t.slice(0, 30)}…` : t || '새 대화'
}

type StreamHandlers = {
  onText: (chunk: string) => void
  onNotice: (message: string) => void
  onError: (message: string) => void
}

/**
 * /api/chat 을 부르고 답을 조각마다 넘겨줘요. 응답 형식은 app/api/chat/route.ts 머리말 참고.
 * signal 로 멈추면(AbortController) 조용히 끝나요.
 */
export async function streamChat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  signal: AbortSignal,
  on: StreamHandlers,
): Promise<void> {
  let res: Response
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    })
  } catch {
    if (!signal.aborted) on.onError('서버에 연결하지 못했어요.')
    return
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null)
    on.onError(data?.error || `서버 오류 (${res.status})`)
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const handle = (line: string) => {
    if (!line.trim()) return
    try {
      const ev = JSON.parse(line) as { t: string; v: string }
      if (ev.t === 'text') on.onText(ev.v)
      else if (ev.t === 'notice') on.onNotice(ev.v)
      else if (ev.t === 'error') on.onError(ev.v)
    } catch {
      // 형식이 깨진 줄은 건너뛰어요
    }
  }
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      lines.forEach(handle)
    }
    handle(buffer + decoder.decode())
  } catch {
    if (!signal.aborted) on.onError('답을 받는 중에 연결이 끊겼어요.')
  }
}
