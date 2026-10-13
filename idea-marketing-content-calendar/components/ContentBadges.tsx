import { StatusDot } from '@/components/ax'
import { CHANNELS, STATUSES, type Channel, type Status } from '@/lib/content'

/** 채널 색 점 + 이름. */
export function ChannelLabel({ channel }: { channel: Channel }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${CHANNELS[channel].dot}`} />
      {CHANNELS[channel].label}
    </span>
  )
}

const STATUS_TONE: Record<Status, 'muted' | 'warning' | 'active' | undefined> = {
  planning: 'muted',
  writing: undefined,
  review: 'warning',
  published: 'active',
}

/** 상태 — 기획(회색) · 작성 중 · 검토(주황) · 발행(초록). */
export function StatusLabel({ status }: { status: Status }) {
  return <StatusDot tone={STATUS_TONE[status]}>{STATUSES[status]}</StatusDot>
}
