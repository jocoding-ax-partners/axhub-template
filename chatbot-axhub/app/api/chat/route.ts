import Anthropic from '@anthropic-ai/sdk'
import { ASSISTANT } from '@/config/assistant'
import { AI_MODEL, isAiConfigured, isViaAxrouter, makeAi, supportsFallback, type ChatTurn } from '@/lib/ai'

// 대화 한 번 = POST /api/chat. 받은 대화 전체를 Claude 에 보내고 답을 조금씩 흘려 보내요.
// 브라우저는 lib/chat-client.ts 의 streamChat() 이 이 응답을 읽어 화면에 이어 붙여요.
//
// 응답 형식 (NDJSON — 한 줄에 JSON 하나)
//   {"t":"text","v":"안녕"}      답의 조각. 오는 대로 이어 붙여요.
//   {"t":"notice","v":"…"}       답 끝에 붙일 안내 (거절·길이 초과)
//   {"t":"error","v":"…"}        실패. 화면이 오류 상자와 "다시 시도" 를 보여줘요.
// 새 종류(예: 도구 호출 진행 상황)가 필요하면 t 를 하나 더 만들고 streamChat() 에서 받아요.

const MAX_TURNS = 40 // 너무 긴 대화는 최근 것만 보내요 (비용·속도)
const MAX_CHARS = 20_000 // 한 메시지 최대 글자 수

export async function POST(req: Request) {
  if (!isAiConfigured()) {
    return Response.json({ error: 'ANTHROPIC_API_KEY 가 설정되지 않았어요.' }, { status: 503 })
  }

  const body = (await req.json().catch(() => null)) as { messages?: ChatTurn[] } | null
  const turns = sanitize(body?.messages)
  if (!turns) {
    return Response.json({ error: '대화 형식이 올바르지 않아요.' }, { status: 400 })
  }

  const model = AI_MODEL
  const stream = makeAi().beta.messages.stream({
    model,
    max_tokens: 64000,
    system: ASSISTANT.systemPrompt,
    messages: turns,
    // 채팅은 빠른 답이 중요해서 생각 깊이를 낮춰요. Haiku 는 이 옵션을 받지 않아요.
    ...(model.startsWith('claude-haiku') ? {} : { output_config: { effort: 'low' as const } }),
    ...(supportsFallback(model)
      ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
      : {}),
  })

  const encoder = new TextEncoder()
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (t: 'text' | 'notice' | 'error', v: string) =>
        controller.enqueue(encoder.encode(JSON.stringify({ t, v }) + '\n'))
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            send('text', event.delta.text)
          }
        }
        const final = await stream.finalMessage()
        if (final.stop_reason === 'refusal') {
          send('notice', '이 질문에는 답할 수 없어요. 다르게 물어봐 주세요.')
        } else if (final.stop_reason === 'max_tokens') {
          send('notice', '답이 너무 길어 중간에 끊겼어요.')
        }
      } catch (err) {
        send('error', describeError(err))
      } finally {
        controller.close()
      }
    },
    cancel() {
      stream.abort() // 사용자가 창을 닫거나 멈추면 Claude 호출도 끊어요
    },
  })

  return new Response(body$, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

/** 브라우저가 보낸 대화를 믿지 않고 모양을 확인해요. */
function sanitize(input: unknown): ChatTurn[] | null {
  if (!Array.isArray(input) || input.length === 0) return null
  const turns: ChatTurn[] = []
  for (const t of input.slice(-MAX_TURNS)) {
    if (!t || (t.role !== 'user' && t.role !== 'assistant') || typeof t.content !== 'string') return null
    const content = t.content.slice(0, MAX_CHARS)
    if (content.trim()) turns.push({ role: t.role, content })
  }
  // Claude 는 첫 메시지가 user, 마지막도 user 여야 해요.
  while (turns.length && turns[0].role !== 'user') turns.shift()
  if (!turns.length || turns[turns.length - 1].role !== 'user') return null
  return turns
}

/** 오류를 사람이 읽을 말로. 메시지 문자열이 아니라 오류 종류로 나눠요. */
function describeError(err: unknown): string {
  const axr = isViaAxrouter()
  if (err instanceof Anthropic.AuthenticationError)
    return axr
      ? 'AXRouter 키가 올바르지 않거나 폐기됐어요. `axhub axrouter keys list` 로 확인해 주세요.'
      : 'API 키가 올바르지 않아요. ANTHROPIC_API_KEY 를 확인해 주세요.'
  if (err instanceof Anthropic.PermissionDeniedError)
    return axr
      ? `AXRouter 가드레일이 이 요청을 막았어요 (허용 모델·한도). 관리자에게 ${AI_MODEL} 허용 여부를 확인해 주세요.`
      : '이 API 키로는 이 모델을 쓸 수 없어요.'
  if (err instanceof Anthropic.NotFoundError) return `모델(${AI_MODEL})을 찾을 수 없어요. AI_MODEL 을 확인해 주세요.`
  if (err instanceof Anthropic.RateLimitError) return '요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.'
  if (err instanceof Anthropic.BadRequestError) return '요청이 거절됐어요. 대화를 새로 시작해 보세요.'
  if (err instanceof Anthropic.APIConnectionError) return 'AI 서버에 연결하지 못했어요.'
  if (err instanceof Anthropic.APIError) return `AI 서버 오류 (${err.status ?? '알 수 없음'})`
  return '알 수 없는 오류가 났어요.'
}
