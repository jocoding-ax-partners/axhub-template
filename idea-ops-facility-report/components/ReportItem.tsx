import Image from 'next/image'
import { StatusDot } from '@/components/ax'
import { STATUS_LABEL, formatDateTime, type ReportStatus } from '@/lib/facility'
import type { Report } from '@/lib/facility-store'

const STATUS_TONE: Record<ReportStatus, 'warning' | 'active' | 'muted'> = {
  received: 'warning',
  in_progress: 'active',
  done: 'muted',
}

export function ReportStatusDot({ status }: { status: ReportStatus }) {
  return (
    <StatusDot tone={STATUS_TONE[status]} className="shrink-0">
      {STATUS_LABEL[status]}
    </StatusDot>
  )
}

/**
 * 신고 한 건의 본문 — 위치 · 상태 · 내용 · 사진 · 처리 메모 · 시각.
 * 사진은 app/photos/[id] 가 권한을 확인한 뒤 임시 주소로 보내 줘요 (누르면 새 탭에서 크게 보여요).
 */
export function ReportBody({ report: r, showReporter = false }: { report: Report; showReporter?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
      {r.has_photo && (
        <a href={`/photos/${r.id}`} target="_blank" rel="noreferrer" className="shrink-0 self-start" aria-label={`${r.location} 사진 크게 보기`}>
          {/* 비공개 사진이라 Next 이미지 최적화(서버가 대신 받아 오기)를 쓰지 않아요 — 브라우저가 권한 확인 주소를 직접 열어요. */}
          <Image
            src={`/photos/${r.id}`}
            alt={`${r.location} 고장 사진`}
            width={96}
            height={96}
            unoptimized
            className="size-24 rounded-lg border border-default bg-muted object-cover"
          />
        </a>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="t-small min-w-0 break-words font-semibold">{r.location}</p>
          <ReportStatusDot status={r.status} />
        </div>
        <p className="t-small whitespace-pre-wrap break-words text-muted">{r.description}</p>
        {r.memo && (
          <p className="t-small mt-1 whitespace-pre-wrap break-words rounded-lg bg-muted px-3 py-2">
            <span className="font-semibold">처리 메모</span> {r.memo}
          </p>
        )}
        <p className="t-caption mt-1">
          {showReporter && `${r.reporter_name || r.reporter_email || '이름 없음'} · `}
          {formatDateTime(r.created_at)} 신고
          {r.handled_at && ` · ${formatDateTime(r.handled_at)} ${r.handled_by ?? ''}님이 처리`}
        </p>
      </div>
    </div>
  )
}
