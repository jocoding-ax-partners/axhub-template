import { Card } from '@heroui/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { CompanyForm } from '@/components/MeetingLogForms'
import { DbMissing, LoginRequired } from '@/components/Notices'
import { isDbConfigured } from '@/lib/db'
import { currentUser } from '@/lib/user'

// 고객사 등록. 등록한 사람이 그 고객사의 담당자가 돼요. 저장하면 고객사 화면으로 이동해요.
export default async function NewCompanyPage() {
  if (!(await currentUser())) return <LoginRequired returnTo="/companies/new" />
  if (!isDbConfigured()) return <DbMissing />

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader title="고객사 등록" description="등록한 사람이 이 고객사의 담당이 돼요." backTo="/" backLabel="고객사 목록" />
        <Card>
          <Card.Content>
            <CompanyForm />
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}
