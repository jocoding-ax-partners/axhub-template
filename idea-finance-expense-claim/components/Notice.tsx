import type { ReactNode } from 'react'
import { Card, buttonVariants } from '@heroui/react'
import { isAxhubConfigured, loginUrl } from '@/lib/axhub-server'

/** 제목 + 한 줄 설명 + (선택) 버튼만 있는 안내 카드. 로그인 필요 · 권한 없음 · 준비 안 됨 화면에 써요. */
export function Notice({ title, desc, action }: { title: string; desc: string; action?: ReactNode }) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        <Card.Description>{desc}</Card.Description>
      </Card.Header>
      {action && <Card.Footer>{action}</Card.Footer>}
    </Card>
  )
}

/** 로그인 안 한 방문자에게. returnTo = 로그인 후 돌아올 화면. */
export async function LoginNotice({ returnTo }: { returnTo: string }) {
  if (!isAxhubConfigured()) {
    return <Notice title="로그인이 필요해요" desc="지금은 내 컴퓨터에서 실행 중이라 로그인할 수 없어요. axhub 에 배포한 주소에서 열어 주세요." />
  }
  const href = await loginUrl(returnTo)
  return (
    <Notice
      title="로그인이 필요해요"
      desc="axhub 로 로그인하면 경비를 올리고 처리 상태를 볼 수 있어요."
      action={
        // 로그인은 플랫폼 경로(/__axhub/auth/*)로 페이지째 이동해야 해서 <a> 에 버튼 모양만 입혀요.
        <a className={buttonVariants({ variant: 'primary' })} href={href}>
          axhub 로 로그인
        </a>
      }
    />
  )
}

/** DB 가 아직 연결되지 않았을 때 (주로 로컬 실행). */
export function DbNotice() {
  return (
    <Notice
      title="데이터 저장소가 아직 연결되지 않았어요"
      desc="배포한 앱이라면 axhub.yaml 의 database 설정이 켜져 있는지 확인해 주세요. 내 컴퓨터에서는 npm run db:up 으로 DB 를 띄워요."
    />
  )
}
