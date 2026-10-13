import { Card, Chip } from '@heroui/react'
import { CalendarBlank, MapPin, Users } from '@phosphor-icons/react/ssr'
import { SignupButton } from '@/components/forms'
import { formatWhen, signupState } from '@/lib/training'
import type { Training } from '@/lib/training-store'

const CHIP = {
  mine: { color: 'success', label: '신청함' },
  full: { color: 'warning', label: '마감' },
  started: { color: 'default', label: '지난 교육' },
} as const

/** 직원 화면의 교육 한 건 — 일시 · 장소 · 신청 인원/정원 · 신청(취소) 버튼. */
export function TrainingCard({ t }: { t: Training }) {
  const state = signupState(t)
  const chip = state === 'open' ? null : CHIP[state]
  const left = t.capacity - t.signed
  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex flex-wrap items-center gap-2 break-words">
          {t.title}
          {chip && (
            <Chip size="sm" color={chip.color}>
              {chip.label}
            </Chip>
          )}
        </Card.Title>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        <ul className="t-small flex list-none flex-col gap-1 p-0">
          <li className="flex items-start gap-2">
            <CalendarBlank size={16} weight="fill" className="mt-0.5 shrink-0 text-muted" aria-label="일시" />
            {formatWhen(t.starts_at)}
          </li>
          <li className="flex items-start gap-2 break-words">
            <MapPin size={16} weight="fill" className="mt-0.5 shrink-0 text-muted" aria-label="장소" />
            <span className="min-w-0">{t.location}</span>
          </li>
          <li className="flex items-start gap-2">
            <Users size={16} weight="fill" className="mt-0.5 shrink-0 text-muted" aria-label="신청 인원" />
            <span>
              신청 <strong>{t.signed}</strong> / 정원 {t.capacity}명
              {state === 'open' && <span className="text-muted"> · {left}자리 남았어요</span>}
            </span>
          </li>
        </ul>
        {t.description && <p className="t-small whitespace-pre-line break-words text-muted">{t.description}</p>}
      </Card.Content>
      <Card.Footer className="sm:justify-end">
        <SignupButton id={t.id} title={t.title} state={state} />
      </Card.Footer>
    </Card>
  )
}
