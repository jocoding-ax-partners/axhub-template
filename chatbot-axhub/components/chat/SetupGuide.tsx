import type { ReactNode } from 'react'
import { Card } from '@heroui/react'
import { CodeBlock } from '@/components/ax'

/**
 * AI 키가 없을 때 대화 자리에 보이는 안내. 키를 넣고 서버를 다시 띄우면 자동으로 채팅 화면이 돼요.
 * 서버 컴포넌트예요 — app/page.tsx 가 ChatApp 의 setup 으로 넘겨요.
 */
export function SetupGuide() {
  return (
    <Card className="w-full text-left">
      <Card.Header>
        <Card.Title className="t-card-title">AI 키 넣기</Card.Title>
        <Card.Description>
          이 챗봇은 Claude 를 불러요. 먼저{' '}
          <a className="text-primary underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>{' '}
          에서 API 키를 발급받으세요.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-6">
        <Step
          title="내 컴퓨터에서"
          desc={
            <>
              <Code>.env.local</Code> 에 한 줄 넣고 <Code>npm run dev</Code> 를 다시 띄워요.
            </>
          }
          code="ANTHROPIC_API_KEY=sk-ant-..."
        />
        <Step
          title="회사 AXRouter 를 쓰려면 (선택)"
          desc="회사가 AXRouter 를 켜 두었다면 개인 Anthropic 키 대신 회사 키를 쓸 수 있어요. 사용량과 한도는 회사 콘솔에서 관리돼요. 키 값은 발급할 때 한 번만 보여요."
          code={`axhub axrouter keys issue --name "내 챗봇"

ANTHROPIC_API_KEY=ax-...
ANTHROPIC_BASE_URL=https://axrouter.ai`}
        />
        <Step
          title="axhub 에 배포한 앱에서"
          desc='Claude Code 에 "ANTHROPIC_API_KEY 등록하고 다시 배포해줘" 라고 부탁하거나, 직접 아래 명령을 써요. 키는 비밀값으로 저장돼요. AXRouter 를 쓰면 ANTHROPIC_BASE_URL 도 같은 방법으로 넣어요 (비밀값 아님).'
          code={`printf %s "$ANTHROPIC_API_KEY" | axhub env set ANTHROPIC_API_KEY --app <앱 슬러그> --secret --from-stdin --stage runtime
axhub deploy create --app <앱 슬러그> --execute`}
        />
      </Card.Content>
    </Card>
  )
}

function Step({ title, desc, code }: { title: string; desc: ReactNode; code: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="t-body-strong">{title}</h3>
      <p className="t-small">{desc}</p>
      <CodeBlock language="bash" code={code} className="overflow-x-auto rounded-card bg-muted p-4" />
    </section>
  )
}

/** 문장 속 파일명·명령 — 회색 바탕 고정폭 글자. */
function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-caption-01 text-secondary">{children}</code>
}
