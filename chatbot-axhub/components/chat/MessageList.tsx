'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Turn } from '@/lib/chat-client'
import { Icon } from './Icon'
import { Message } from './Message'

/**
 * 대화가 쌓이는 스크롤 영역.
 *
 * 스크롤 규칙 (채팅 앱의 기본)
 *  - 맨 아래를 보고 있으면 답이 늘어날 때 따라 내려가요.
 *  - 위로 올려 지난 내용을 읽는 중이면 끌어내리지 않아요. 대신 "아래로" 버튼이 떠요.
 *  - 내가 새로 보내면 무조건 맨 아래로 가요 (followKey 가 바뀔 때).
 */

const STICK_GAP = 80 // 맨 아래에서 이만큼(px) 안이면 "맨 아래를 보는 중" 으로 쳐요

type Props = {
  turns: Turn[]
  streaming: boolean
  /** 바뀌면 맨 아래로 강제 이동 (새 대화 열기·보내기) */
  followKey: string
  empty: React.ReactNode
  onRegenerate: () => void
}

export function MessageList({ turns, streaming, followKey, empty, onRegenerate }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const [showDown, setShowDown] = useState(false)

  // 부드러운 스크롤(smooth)은 탭이 백그라운드면 멈춰 버려서 바로 이동해요.
  function toBottom() {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }

  // 새 대화를 열거나 내가 보냈을 때 → 맨 아래로
  useEffect(() => {
    stickRef.current = true
    toBottom()
  }, [followKey])

  // 답이 늘어날 때 → 맨 아래를 보고 있던 경우에만 따라가요
  useLayoutEffect(() => {
    if (stickRef.current) toBottom()
  }, [turns])

  return (
    <div className="chat-scroll-wrap">
      <div
        ref={scrollRef}
        className="chat-scroll"
        onScroll={(e) => {
          const el = e.currentTarget
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_GAP
          stickRef.current = atBottom
          setShowDown(!atBottom)
        }}
      >
        {turns.length === 0 ? (
          empty
        ) : (
          <div className="chat-column chat-thread" aria-live="polite">
            {turns.map((t, i) => (
              <Message
                key={t.id}
                turn={t}
                isLast={i === turns.length - 1}
                streaming={streaming && i === turns.length - 1}
                onRegenerate={onRegenerate}
              />
            ))}
          </div>
        )}
      </div>

      {showDown && turns.length > 0 && (
        <button
          type="button"
          className="chat-scroll-down"
          onClick={() => {
            stickRef.current = true
            toBottom()
          }}
          aria-label="맨 아래로"
        >
          <Icon name="down" size={16} />
        </button>
      )}
    </div>
  )
}
