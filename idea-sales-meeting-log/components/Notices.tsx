import type { ReactNode } from 'react'
import { Card, buttonVariants } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { loginUrl } from '@/lib/axhub-server'

/** 로그인 안 한 방문자에게 — 고객 정보는 로그인한 사람만 봐요. */
export async function LoginRequired({ returnTo }: { returnTo: string }) {
  const href = await loginUrl(returnTo)
  return (
    <AppShell>
      <Card className="mx-auto w-full max-w-xl items-center py-10 text-center">
        <Card.Header className="items-center">
          <Card.Title>로그인이 필요해요</Card.Title>
          <Card.Description>고객사와 미팅 기록은 axhub 에 로그인한 뒤에 볼 수 있어요.</Card.Description>
        </Card.Header>
        <Card.Footer>
          {/* 로그인은 플랫폼 경로(/__axhub/auth/*)로 페이지째 이동해야 해서 <a> 에 버튼 모양만 입혀요. */}
          <a className={buttonVariants()} href={href}>
            axhub 로 로그인
          </a>
        </Card.Footer>
      </Card>
    </AppShell>
  )
}

/** 데이터베이스가 아직 없을 때 — 배포본은 axhub.yaml 의 database 선언으로 자동 발급돼요. */
export function DbMissing() {
  return (
    <AppShell>
      <Card className="mx-auto w-full max-w-xl items-center py-10 text-center">
        <Card.Header className="items-center">
          <Card.Title>데이터를 저장할 곳이 아직 준비되지 않았어요</Card.Title>
          <Card.Description>
            배포한 앱이라면 잠시 뒤 다시 열어 보세요. 계속 이 화면이 보이면 앱 관리자에게 알려 주세요.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <p className="t-caption">
            내 컴퓨터에서 실행 중이라면 <Code>npm run db:up</Code> 으로 데이터베이스를 켜고 <Code>.env.local</Code> 의
            DATABASE_URL 을 채워 주세요.
          </p>
        </Card.Content>
      </Card>
    </AppShell>
  )
}

/** 문장 속 파일명·명령 — 회색 바탕 고정폭 글자. */
function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-caption-01 text-secondary">{children}</code>
}
