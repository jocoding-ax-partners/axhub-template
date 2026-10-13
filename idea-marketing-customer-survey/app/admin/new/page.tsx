import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { DbNotice, LoginCard, ManagerOnly } from '@/components/Notices'
import { SurveyBuilder } from '@/components/SurveyBuilder'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { isManager } from '@/lib/survey'

export const dynamic = 'force-dynamic'

export default async function NewSurveyPage() {
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="새 설문" desc="관리자 계정으로 로그인하면 설문을 만들 수 있어요." returnTo="/admin/new" />
      </AppShell>
    )
  }
  if (!isManager(visitor)) {
    return (
      <AppShell>
        <ManagerOnly />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="새 설문"
          description="제목과 문항을 적어요. 객관식은 꼭 답해야 하고, 주관식은 비워 둘 수 있어요. 만든 뒤에는 문항을 고칠 수 없어요."
        />
        {isDbConfigured() ? <SurveyBuilder /> : <DbNotice />}
      </div>
    </AppShell>
  )
}
