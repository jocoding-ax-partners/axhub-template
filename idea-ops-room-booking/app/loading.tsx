import { Card, Spinner } from '@heroui/react'
import { AppShell } from '@/components/AppShell'

/** 화면 데이터를 불러오는 동안 보이는 자리표시. */
export default function Loading() {
  return (
    <AppShell>
      <Card aria-busy="true">
        <Card.Content className="flex items-center justify-center gap-3 py-10" role="status">
          <Spinner size="sm" />
          <span className="t-small">불러오고 있어요…</span>
        </Card.Content>
      </Card>
    </AppShell>
  )
}
