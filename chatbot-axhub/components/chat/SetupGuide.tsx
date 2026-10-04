/**
 * AI 키가 없을 때 대화 자리에 보이는 안내. 키를 넣고 서버를 다시 띄우면 자동으로 채팅 화면이 돼요.
 * 서버 컴포넌트예요 — app/page.tsx 가 ChatApp 의 setup 으로 넘겨요.
 */
export function SetupGuide() {
  return (
    <section className="ax-card chat-setup">
      <h2 className="ax-card-title">AI 키 넣기</h2>
      <p className="ax-card-desc">
        이 챗봇은 Claude 를 불러요. 먼저{' '}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
          console.anthropic.com
        </a>{' '}
        에서 API 키를 발급받으세요.
      </p>

      <h3 className="ax-section-title mt-6">내 컴퓨터에서</h3>
      <p className="ax-small ax-muted m-0">
        <code className="ax-tag">.env.local</code> 에 한 줄 넣고 <code className="ax-tag">npm run dev</code> 를 다시 띄워요.
      </p>
      <code className="ax-code">ANTHROPIC_API_KEY=sk-ant-...</code>

      <h3 className="ax-section-title mt-6">회사 AXRouter 를 쓰려면 (선택)</h3>
      <p className="ax-small ax-muted m-0">
        회사가 AXRouter 를 켜 두었다면 개인 Anthropic 키 대신 회사 키를 쓸 수 있어요. 사용량과 한도는 회사 콘솔에서 관리돼요. 키 값은 발급할 때 한 번만 보여요.
      </p>
      <code className="ax-code">{`axhub axrouter keys issue --name "내 챗봇"

ANTHROPIC_API_KEY=ax-...
ANTHROPIC_BASE_URL=https://axrouter.ai`}</code>

      <h3 className="ax-section-title mt-6">axhub 에 배포한 앱에서</h3>
      <p className="ax-small ax-muted m-0">
        Claude Code 에 &quot;ANTHROPIC_API_KEY 등록하고 다시 배포해줘&quot; 라고 부탁하거나, 직접 아래 명령을 써요. 키는 비밀값으로 저장돼요. AXRouter 를 쓰면 ANTHROPIC_BASE_URL 도 같은 방법으로 넣어요 (비밀값 아님).
      </p>
      <code className="ax-code">{`printf %s "$ANTHROPIC_API_KEY" | axhub env set ANTHROPIC_API_KEY --app <앱 슬러그> --secret --from-stdin --stage runtime
axhub deploy create --app <앱 슬러그> --execute`}</code>
    </section>
  )
}
