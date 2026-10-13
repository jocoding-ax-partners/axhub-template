import type { ReactNode } from 'react'
import { Card, buttonVariants } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { loginUrl } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { managerAccess } from '@/lib/manager'

/**
 * 담당자 화면 입구. 로그인 안 함 · 담당자 아님 · DB 미연결이면 안내 카드를 보여주고,
 * 통과하면 children 을 그려요. 화면을 숨기는 것뿐 아니라 저장도 app/actions.ts 에서 다시 막아요.
 * path 는 로그인 뒤 돌아올 이 화면의 주소예요.
 */
export async function Gate({ path, children }: { path: string; children: ReactNode }) {
  const access = await managerAccess()
  if (access.ok && isDbConfigured()) return <AppShell>{children}</AppShell>

  let title: string
  let description: string
  let action: ReactNode = null
  if (!access.ok && access.reason === 'login') {
    title = '로그인이 필요해요'
    description = '이벤트 담당자만 신청자 명단을 볼 수 있어요. axhub 계정으로 로그인해 주세요.'
    const loginHref = await loginUrl(path)
    action = (
      // 로그인은 플랫폼 경로(/__axhub/auth/*)로 페이지째 이동해야 해서 <a> 에 버튼 모양만 입혀요.
      <a className={buttonVariants({ variant: 'primary' })} href={loginHref}>
        axhub 로 로그인
      </a>
    )
  } else if (!access.ok && access.reason === 'unconfigured') {
    title = 'axhub 설정이 비어 있어요'
    description =
      '로그인과 담당자 확인에 필요한 axhub 설정(APPHUB_API_URL · APPHUB_APP_SLUG · APPHUB_TENANT)이 없어서 화면을 열 수 없어요. axhub 로 다시 배포하거나 axhub env set 으로 값을 넣어 주세요.'
  } else if (!access.ok) {
    title = '담당자만 쓸 수 있어요'
    description = '신청자 개인정보가 있어서 담당자에게만 열려 있어요. 필요하면 이 앱을 만든 분이나 워크스페이스 관리자에게 권한을 요청해 주세요.'
  } else {
    title = '데이터 저장소가 아직 연결되지 않았어요'
    description = 'axhub 에 배포하면 저장소가 자동으로 연결돼요. 내 컴퓨터에서 실행 중이라면 README 의 "내 컴퓨터에서 실행" 순서를 따라 주세요.'
  }
  return (
    <AppShell>
      <Card>
        <Card.Header>
          <Card.Title>{title}</Card.Title>
          <Card.Description>{description}</Card.Description>
        </Card.Header>
        {action && <Card.Footer>{action}</Card.Footer>}
      </Card>
    </AppShell>
  )
}
