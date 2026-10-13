import Link from 'next/link'
import { Chip } from '@heroui/react'
import { SLOT, SLOTS, fmt, isPast } from '@/lib/booking'

export type Room = { id: string; name: string; capacity: number }
export type Booking = { id: string; room_id: string; title: string; user_key: string; user_name: string; start_min: number; end_min: number }

/**
 * 회의실별 30분 시간표 — 줄은 시각, 열은 회의실. 여러 칸짜리 예약은 첫 칸에서 rowSpan 으로 한 덩어리로 그려요.
 * 회의실이 많으면 좁은 화면에서 이 표만 옆으로 밀어 봐요 (페이지는 옆으로 밀리지 않아요). 시간 열은 왼쪽에 고정돼요.
 *
 * 셀을 합치는(rowSpan) 표라 HeroUI Table 대신 평범한 <table> 에 Tailwind 와 의미 토큰만 써요.
 * 고정 열 바탕은 카드와 같은 색(--surface)이어야 밀 때 뒤 칸이 비쳐 보이지 않아요.
 */
export function Timetable({
  rooms,
  bookings,
  day,
  userId,
  picked,
}: {
  rooms: Room[]
  bookings: Booking[]
  day: string
  /** 로그인한 사람의 user_id — 「내 예약」 표시용. 로그인 안 했으면 undefined. */
  userId?: string
  /** 지금 예약 양식에 고른 칸 */
  picked?: { roomId: string; start: number }
}) {
  // (회의실, 시각) → 그 칸을 차지한 예약. 회의실 수 × 24칸이라 단순 탐색으로 충분해요.
  const at = (roomId: string, m: number) => bookings.find((b) => b.room_id === roomId && b.start_min <= m && m < b.end_min)
  const stickyCell = 'sticky left-0 z-10 border-b border-default bg-[var(--surface)] p-2 text-left'

  return (
    <div className="overflow-x-auto">
      <table className="t-small w-full border-collapse">
        <thead>
          <tr>
            <th scope="col" className={`${stickyCell} t-caption w-16`}>
              시간
            </th>
            {rooms.map((r) => (
              <th key={r.id} scope="col" className="min-w-32 border-b border-default p-2 text-left font-semibold">
                <span className="break-words">{r.name}</span> <span className="t-caption">{r.capacity}명</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map((m) => (
            <tr key={m}>
              <th scope="row" className={`${stickyCell} t-caption font-normal`}>
                {fmt(m)}
              </th>
              {rooms.map((r) => {
                const b = at(r.id, m)
                if (b && b.start_min !== m) return null
                if (b) {
                  return (
                    <td
                      key={r.id}
                      rowSpan={(b.end_min - b.start_min) / SLOT}
                      className="border-b border-l-2 border-default border-l-primary bg-primary-soft p-2 align-top"
                    >
                      <p className="font-semibold break-all">{b.title}</p>
                      <p className="t-caption mt-1">
                        {fmt(b.start_min)}~{fmt(b.end_min)} · {b.user_name || '이름 없음'}
                      </p>
                      {userId && b.user_key === userId && (
                        <Chip size="sm" color="accent" className="mt-1">
                          내 예약
                        </Chip>
                      )}
                    </td>
                  )
                }
                if (isPast(day, m)) {
                  return (
                    <td key={r.id} className="border-b border-default bg-muted p-2">
                      <span className="sr-only">지난 시간</span>
                    </td>
                  )
                }
                const isPicked = r.id === picked?.roomId && m === picked.start
                return (
                  <td key={r.id} className={`border-b border-default p-0 ${isPicked ? 'bg-muted' : ''}`}>
                    <Link
                      className="t-caption flex min-h-10 items-center p-2 hover:bg-muted hover:text-primary"
                      href={`/?date=${day}&room=${r.id}&start=${fmt(m)}#book`}
                      aria-label={`${r.name} ${fmt(m)}부터 예약`}
                    >
                      {isPicked ? '선택함' : '비어 있음'}
                    </Link>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
