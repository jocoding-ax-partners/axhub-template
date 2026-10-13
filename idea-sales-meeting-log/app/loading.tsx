import { Card, Skeleton } from '@heroui/react'
import { AppShell } from '@/components/AppShell'

// 화면 데이터를 불러오는 동안 잠깐 보이는 자리표시.
export default function Loading() {
  return (
    <AppShell>
      <div className="flex flex-col gap-10" aria-busy="true" aria-live="polite">
        <Skeleton className="h-10 w-48 rounded-input" />
        <Card>
          <p className="t-small text-muted">불러오는 중이에요…</p>
          <div className="grid gap-3">
            <Skeleton className="h-16 rounded-input" />
            <Skeleton className="h-16 rounded-input" />
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
