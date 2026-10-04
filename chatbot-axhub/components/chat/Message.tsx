'use client'

import { useRef, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Turn } from '@/lib/chat-client'
import { Icon } from './Icon'

/**
 * 말 한 줄. 내 말은 오른쪽 말풍선, AI 답은 왼쪽에 마크다운(굵게·목록·표·코드)으로 그려요.
 * AI 답 아래에는 복사 · 다시 생성 버튼이 붙어요.
 */

type Props = {
  turn: Turn
  streaming: boolean
  isLast: boolean
  onRegenerate: () => void
}

export function Message({ turn, streaming, isLast, onRegenerate }: Props) {
  if (turn.role === 'user') {
    return (
      <div className="chat-msg-user">
        <div className="chat-bubble">{turn.content}</div>
      </div>
    )
  }

  const waiting = streaming && !turn.content
  return (
    <div className="chat-msg-ai">
      <div className="chat-avatar" aria-hidden="true">
        <Icon name="chat" size={15} />
      </div>
      <div className="chat-ai-body">
        {waiting ? (
          <span className="chat-typing" aria-label="답을 쓰는 중">
            <span />
            <span />
            <span />
          </span>
        ) : (
          <div className="chat-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock, a: ExternalLink }}>
              {turn.content}
            </ReactMarkdown>
          </div>
        )}

        {turn.notice && <p className="chat-notice">{turn.notice}</p>}

        {turn.error && (
          <div className="chat-error" role="alert">
            <span>{turn.error}</span>
            {isLast && (
              <button type="button" className="chat-action" onClick={onRegenerate}>
                <Icon name="retry" size={14} /> 다시 시도
              </button>
            )}
          </div>
        )}

        {!streaming && !turn.error && turn.content && (
          <div className="chat-actions">
            <CopyButton text={turn.content} />
            {isLast && (
              <button type="button" className="chat-action" onClick={onRegenerate} title="같은 질문으로 다시 답하기">
                <Icon name="retry" size={14} /> 다시 생성
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** text 는 문자열 또는 누를 때 읽을 함수예요 (코드 블록은 화면에 그려진 글을 읽어요). */
function CopyButton({ text, label = '복사' }: { text: string | (() => string); label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="chat-action"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(typeof text === 'function' ? text() : text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          // 클립보드 권한이 없으면 조용히 넘어가요
        }
      }}
    >
      <Icon name={done ? 'check' : 'copy'} size={14} /> {done ? '복사됨' : label}
    </button>
  )
}

/** 코드 블록 — 오른쪽 위에 복사 버튼을 붙여요. */
function CodeBlock({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null)
  return (
    <div className="chat-code">
      <pre ref={ref}>{children}</pre>
      <div className="chat-code-copy">
        <CopyButton text={() => ref.current?.textContent ?? ''} label="코드 복사" />
      </div>
    </div>
  )
}

/** 답 속 링크는 새 탭으로 열어요 (대화가 사라지지 않게). */
function ExternalLink({ href, children }: { href?: string; children?: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}
