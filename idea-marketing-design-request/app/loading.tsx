import { Card, Spinner } from '@heroui/react'
import { AppShell } from '@/components/AppShell'

/** 화면 데이터를 불러오는 동안 잠깐 보이는 자리표시. */
export default function Loading() {
  return (
    <AppShell>
      <Card aria-busy="true">
        <Card.Content className="flex flex-row items-center justify-center gap-3 py-8">
          <Spinner size="sm" />
          <p className="t-small">불러오는 중이에요…</p>
        </Card.Content>
      </Card>
    </AppShell>
  )
}
