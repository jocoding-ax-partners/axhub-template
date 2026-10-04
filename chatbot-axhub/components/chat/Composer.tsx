'use client'

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

/**
 * 입력창. 글이 길어지면 위로 늘어나고(최대 8줄쯤), Enter 로 보내고 Shift+Enter 로 줄을 바꿔요.
 * 답을 받는 중에는 보내기 버튼이 "멈추기" 로 바뀌어요.
 */

const MAX_HEIGHT = 200 // 8줄쯤

export type ComposerHandle = { focus: () => void; fill: (text: string) => void }

type Props = {
  busy: boolean
  disabled?: boolean
  placeholder?: string
  onSend: (text: string) => void
  onStop: () => void
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { busy, disabled, placeholder, onSend, onStop },
  ref,
) {
  const [value, setValue] = useState('')
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => areaRef.current?.focus(),
    fill: (text) => {
      setValue(text)
      areaRef.current?.focus()
    },
  }))

  // 내용에 맞춰 높이를 다시 재요. MAX_HEIGHT 를 넘을 때만 입력창 안에서 스크롤해요.
  // (늘 스크롤 가능으로 두면 1px 반올림 오차에도 스크롤바가 생겨 빈 입력창이 깨져 보여요.)
  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    const full = el.scrollHeight
    el.style.height = `${Math.min(full, MAX_HEIGHT)}px`
    el.style.overflowY = full > MAX_HEIGHT ? 'auto' : 'hidden'
  }, [value])

  function submit() {
    const text = value.trim()
    if (!text || busy || disabled) return
    onSend(text)
    setValue('')
  }

  return (
    <form
      className="chat-composer"
      data-disabled={disabled || undefined}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <textarea
        ref={areaRef}
        className="chat-input"
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? '메시지를 입력하세요'}
        aria-label="메시지 입력"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // 한글 조합 중 Enter 는 글자 확정이라 보내지 않아요.
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
      />
      {busy ? (
        <button type="button" className="chat-send" onClick={onStop} aria-label="답 멈추기" title="멈추기">
          <Icon name="stop" size={16} />
        </button>
      ) : (
        <button type="submit" className="chat-send" disabled={disabled || !value.trim()} aria-label="보내기" title="보내기 (Enter)">
          <Icon name="send" size={18} />
        </button>
      )}
    </form>
  )
})
