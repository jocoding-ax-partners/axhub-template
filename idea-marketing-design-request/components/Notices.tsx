import { Alert, Card, buttonVariants } from '@heroui/react'
import { isAxhubConfigured, loginUrl } from '@/lib/axhub-server'

/** 로그인 전 안내. 로컬 실행(axhub 문이 없음)에서는 로그인할 수 없다고 알려요. */
export async function LoginCard({ title, desc, returnTo }: { title: string; desc: string; returnTo: string }) {
  const href = isAxhubConfigured() ? await loginUrl(returnTo) : ''
  return (
    <Card className="mx-auto w-full max-w-xl items-center text-center">
      <Card.Header className="items-center">
        {/* 이 화면의 제목이라 h1 — 모양은 Card.Title 과 같아요. */}
        <h1 className="t-card-title">{title}</h1>
        <Card.Description>{desc}</Card.Description>
      </Card.Header>
      <Card.Footer className="justify-center">
        {href ? (
          <a className={buttonVariants({ variant: 'primary' })} href={href}>
            axhub 로 로그인
          </a>
        ) : (
          <p className="t-small">지금은 내 컴퓨터에서 실행 중이라 로그인할 수 없어요. axhub 에 배포한 뒤 확인해 주세요.</p>
        )}
      </Card.Footer>
    </Card>
  )
}

/** DB 가 아직 연결되지 않았을 때 (로컬에서 Postgres 를 안 띄웠거나 axhub.yaml 의 database 가 꺼짐). */
export function DbNotice() {
  return (
    <Alert status="warning" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>데이터베이스가 아직 연결되지 않았어요</Alert.Title>
        <Alert.Description>
          요청 내용을 저장할 곳이 없어 목록이 비어 보여요. axhub 에 배포하면 자동으로 연결돼요. 내 컴퓨터에서는 <Code>npm run db:up</Code> 으로 DB 를
          띄우고 <Code>.env.local</Code> 의 DATABASE_URL 줄 앞 # 을 지워 주세요.
        </Alert.Description>
      </Alert.Content>
    </Alert>
  )
}

/** 문장 속 파일명·명령 — 회색 바탕 고정폭 글자. */
function Code({ children }: { children: string }) {
  return <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-caption-01 text-secondary">{children}</code>
}
