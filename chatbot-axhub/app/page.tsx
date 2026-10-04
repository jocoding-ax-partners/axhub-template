import { ChatApp } from '@/components/chat/ChatApp'
import { SetupGuide } from '@/components/chat/SetupGuide'
import { ASSISTANT } from '@/config/assistant'
import { AI_MODEL, isAiConfigured, isViaAxrouter } from '@/lib/ai'
import { APP_NAME, isAxhubConfigured, loginUrl, logoutUrl, me } from '@/lib/axhub-server'

/**
 * 챗봇 첫 화면. 서버에서 필요한 값(로그인 정보·모델·키 여부)만 모아 ChatApp 에 넘겨요.
 * 화면과 대화 상태는 전부 components/chat/ChatApp.tsx 에 있어요.
 */
export default async function Home() {
  const configured = isAxhubConfigured()
  const visitor = await me()

  return (
    <ChatApp
      appName={APP_NAME}
      assistantName={ASSISTANT.name}
      greeting={ASSISTANT.greeting}
      suggestions={ASSISTANT.suggestions}
      modelLabel={`${AI_MODEL}${isViaAxrouter() ? ' · AXRouter' : ''}`}
      userKey={visitor.user_id || visitor.email || (configured ? 'anonymous' : 'local-dev')}
      visitor={{
        configured,
        authenticated: visitor.authenticated,
        name: visitor.name || visitor.email,
        loginHref: configured ? await loginUrl('/') : '',
        logoutHref: configured ? await logoutUrl('/') : null,
      }}
      setup={isAiConfigured() ? undefined : <SetupGuide />}
    />
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 🤖 Claude Code / AI 에이전트 — 이 챗봇 고치는 법 (지우지 말 것)
 *
 * 【어디를 고치나】
 *   - 챗봇 성격·말투·금지 주제·예시 질문 → config/assistant.ts 만 고친다.
 *   - 화면 뼈대·대화 상태(보내기·다시 생성·대화 목록) → components/chat/ChatApp.tsx
 *   - 말 한 줄 모양(말풍선·마크다운·복사) → components/chat/Message.tsx
 *   - 입력창 → components/chat/Composer.tsx · 스크롤 규칙 → components/chat/MessageList.tsx
 *   - 사이드바 → components/chat/Sidebar.tsx · 모양(크기·간격) → app/chat.css
 *   - Claude 호출(모델·길이·옵션) → app/api/chat/route.ts, 키·모델 상수는 lib/ai.ts
 *   - 브라우저 저장·스트림 읽기 → lib/chat-client.ts
 *
 * 【규칙】
 *   - lib/ai.ts 와 @anthropic-ai/sdk 는 서버에서만 import. "use client" 파일에서 import 하면
 *     API 키가 브라우저로 샌다.
 *   - 키는 코드에 적지 않는다. 로컬은 .env.local, 배포는 axhub env (secret).
 *   - 색·크기는 토큰만 쓴다 (AGENTS.md 디자인 절). 채팅 전용 모양은 app/chat.css 에 모아 둔다.
 * ───────────────────────────────────────────────────────────────────────────── */
