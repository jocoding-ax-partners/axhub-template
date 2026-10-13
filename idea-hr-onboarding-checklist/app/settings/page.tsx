import { Alert, Card, EmptyState } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DbNotice, LoginCard } from '@/components/Notices'
import { TemplateManager } from '@/components/OnboardingForms'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { TEMPLATE_MAX, isAdmin } from '@/lib/onboarding'
import { listTemplates, type Template } from '@/lib/onboarding-store'

export const dynamic = 'force-dynamic'

// 기본 체크리스트 — 누구나 볼 수 있고, 추가·삭제는 관리자(axhub 의 is_admin)만 해요.
// 버튼을 숨기는 것만으론 막히지 않으니 Server Action(app/actions.ts)에서도 다시 확인해요.
export default async function SettingsPage() {
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="기본 체크리스트" desc="axhub 계정으로 로그인하면 기본 체크리스트를 볼 수 있어요." returnTo="/settings" />
      </AppShell>
    )
  }

  const dbReady = isDbConfigured()
  const templates: Template[] = dbReady ? await listTemplates() : []
  const admin = isAdmin(visitor)

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="기본 체크리스트" description="새로 등록하는 입사자에게 자동으로 붙는 항목이에요. 이미 등록한 입사자의 체크리스트는 바뀌지 않아요." />

        {!dbReady && <DbNotice />}

        <Card>
          <Card.Header>
            <Card.Title>
              항목 {templates.length}개
            </Card.Title>
            <Card.Description>위에서부터 이 순서로 붙어요. 최대 {TEMPLATE_MAX}개까지 둘 수 있어요.</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            {admin ? (
              <TemplateManager templates={templates} max={TEMPLATE_MAX} />
            ) : (
              <>
                <Alert status="accent">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>항목 추가·삭제는 이 앱의 관리자만 할 수 있어요. 바꾸고 싶으면 앱 관리자에게 요청해 주세요.</Alert.Description>
                  </Alert.Content>
                </Alert>
                {templates.length === 0 ? (
                  <EmptyState>기본 항목이 없어요.</EmptyState>
                ) : (
                  <ol className="list-none p-0">
                    {templates.map((t, i) => (
                      <li key={t.id} className="t-small break-words border-b border-default py-3 first:pt-0 last:border-0 last:pb-0">
                        <span className="text-muted">{i + 1}.</span> {t.title}
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
