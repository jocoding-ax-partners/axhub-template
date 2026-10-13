'use client'

import { useRef, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Alert, Button } from '@heroui/react'
import { ArrowClockwise, ChatCircle, Check, Copy } from '@phosphor-icons/react'
import type { Turn } from '@/lib/chat-client'

/**
 * 말 한 줄. 내 말은 오른쪽 말풍선, AI 답은 왼쪽에 마크다운(굵게·목록·표·코드)으로 그려요.
 * AI 답 아래에는 복사 · 다시 생성 버튼이 붙어요. 마크다운 모양은 app/chat.css 의 .chat-md 예요.
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
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-muted px-4 py-2.5">{turn.content}</div>
      </div>
    )
  }

  const waiting = streaming && !turn.content
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-primary" aria-hidden="true">
        <ChatCircle size={15} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {waiting ? (
          // 답을 기다리는 점 세 개
          <span className="inline-flex gap-1 py-2 text-subtle" role="status" aria-label="답을 쓰는 중">
            {[0, 150, 300].map((delay) => (
              <span key={delay} className="size-1.5 animate-pulse rounded-full bg-current" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </span>
        ) : (
          <div className="chat-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock, a: ExternalLink }}>
              {turn.content}
            </ReactMarkdown>
          </div>
        )}

        {turn.notice && <p className="t-small mt-2">{turn.notice}</p>}

        {turn.error && (
          <Alert status="danger" className="mt-2 items-center" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{turn.error}</Alert.Description>
            </Alert.Content>
            {isLast && (
              <Button size="sm" variant="outline" data-color="danger" onPress={onRegenerate}>
                <ArrowClockwise />
                다시 시도
              </Button>
            )}
          </Alert>
        )}

        {!streaming && !turn.error && turn.content && (
          <div className="-ml-2 mt-1.5 flex gap-0.5">
            <CopyButton text={turn.content} />
            {isLast && (
              <Button size="sm" variant="ghost" className="text-muted" onPress={onRegenerate} aria-label="다시 생성 — 같은 질문으로 다시 답하기">
                <ArrowClockwise />
                다시 생성
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** text 는 문자열 또는 누를 때 읽을 함수예요 (코드 블록은 화면에 그려진 글을 읽어요). */
function CopyButton({ text, label = '복사', className }: { text: string | (() => string); label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      size="sm"
      variant="ghost"
      className={className ?? 'text-muted'}
      onPress={async () => {
        try {
          await navigator.clipboard.writeText(typeof text === 'function' ? text() : text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          // 클립보드 권한이 없으면 조용히 넘어가요
        }
      }}
    >
      {done ? <Check /> : <Copy />}
      {done ? '복사됨' : label}
    </Button>
  )
}

/** 코드 블록 — 오른쪽 위에 복사 버튼을 붙여요 (마우스를 올리면 보여요. 터치 화면은 늘 보여요). */
function CodeBlock({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null)
  return (
    <div className="group relative">
      <pre ref={ref}>{children}</pre>
      <CopyButton
        text={() => ref.current?.textContent ?? ''}
        label="코드 복사"
        className="absolute top-1.5 right-1.5 bg-content opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
      />
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
