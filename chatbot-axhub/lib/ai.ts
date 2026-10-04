import Anthropic from '@anthropic-ai/sdk'

/**
 * AI(Claude) 호출 경계 — 서버에서만 import 해요. API 키가 브라우저로 새면 안 돼요.
 *
 * ── 키를 넣는 두 가지 방법 ────────────────────────────────────────────────────
 *
 * ① 기본: Anthropic 키를 그대로 넣기
 *    https://console.anthropic.com/settings/keys 에서 발급한 `sk-ant-…` 키를 넣으면 끝이에요.
 *      ANTHROPIC_API_KEY=sk-ant-...
 *
 * ② 선택: 회사 AXRouter 를 거치기
 *    AXRouter 는 axhub 의 "회사 AI 통로" 예요. 회사가 산 AI 공급사 키(BYOK)로 대신 호출해 주고,
 *    누가 얼마를 썼는지 · 한도(가드레일) · 허용 모델 · 민감정보 탐지를 관리자 콘솔에서 한곳에 모아 봐요.
 *    개인이 각자 Anthropic 키를 사지 않아도 되고, 비용은 회사 AXRouter 한도 안에서 나가요.
 *    - 회사 관리자가 AXRouter 를 켜고 Anthropic 공급사 키를 연결해 둬야 써요.
 *    - 키 발급 (axhub CLI, 키 값은 발급할 때 한 번만 보여요 — 바로 복사):
 *        axhub axrouter keys issue --name "내 챗봇" --purpose "chatbot-axhub"
 *        axhub axrouter keys list                       # 내 키 목록
 *        axhub axrouter keys revoke <key_id> --execute  # 폐기
 *      회사(워크스페이스)에 여러 곳 속해 있으면 `--tenant <회사 슬러그>` 를 붙여요.
 *      콘솔에서도 발급할 수 있어요 (관리자 콘솔 › AXRouter › API 키).
 *    - 넣는 법: 같은 변수에 `ax-…` 키를 넣고 주소만 AXRouter 로 바꿔요. 코드는 그대로예요.
 *        ANTHROPIC_API_KEY=ax-...
 *        ANTHROPIC_BASE_URL=https://axrouter.ai
 *    - AXRouter 의 가드레일이 이 모델을 허용하지 않거나 한도를 넘으면 호출이 거절돼요.
 *      그땐 관리자에게 허용 모델·한도를 확인해 달라고 하거나 AI_MODEL 을 허용된 모델로 바꿔요.
 *
 * ── 나머지 환경변수 ─────────────────────────────────────────────────────────
 *   AI_MODEL           (선택) 기본 claude-sonnet-5-5
 *   ANTHROPIC_BASE_URL (선택) 위 ② 를 쓸 때만. SDK 가 알아서 읽어요.
 *
 * 로컬은 .env.local 에, 배포는 `axhub env set` 으로 넣어요 (README 참고).
 */

export const AI_MODEL = process.env.AI_MODEL || 'claude-sonnet-5-5'

/** 키가 있어야 대화가 돼요. 없으면 화면이 설정 안내를 보여줘요. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

/** AXRouter(②)를 거치는 중인지. 화면 안내와 오류 문구에만 써요. */
export function isViaAxrouter(): boolean {
  return (process.env.ANTHROPIC_BASE_URL || '').includes('axrouter')
}

/** 요청마다 새로 만들어도 가벼워요. 키·주소는 ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL 에서 자동으로 읽어요. */
export function makeAi(): Anthropic {
  return new Anthropic()
}

/**
 * 안전 필터가 답을 거절하면 다른 모델로 자동으로 다시 답하게 하는 옵션이에요.
 * 이 옵션을 받는 모델에만 붙여요. AI_MODEL 을 다른 모델로 바꾸면 자동으로 빠져요.
 */
const FALLBACK_MODELS = ['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']

export function supportsFallback(model: string): boolean {
  return FALLBACK_MODELS.includes(model)
}

/** 대화 한 줄. 브라우저와 서버가 주고받는 모양이에요. */
export type ChatTurn = { role: 'user' | 'assistant'; content: string }
