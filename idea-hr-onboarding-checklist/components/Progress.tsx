import { ProgressBar } from '@heroui/react'
import { progress } from '@/lib/onboarding'

/** 진행률 막대 + '60% · 3/5'. 다 끝나면 초록색, 항목이 없으면 '항목 없음'. */
export function Progress({ done, total, label, className }: { done: number; total: number; label: string; className?: string }) {
  const pct = progress(done, total)
  if (pct === null) return <span className={`t-caption ${className ?? ''}`}>항목 없음</span>
  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      <ProgressBar value={pct} aria-label={`${label} 진행률`} color={pct === 100 ? 'success' : 'accent'} size="sm" className="flex-1">
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <span className="t-small shrink-0 tabular-nums">
        <span className="font-semibold">{pct}%</span>
        <span className="text-muted">
          {' '}
          · {done}/{total}
        </span>
      </span>
    </div>
  )
}
