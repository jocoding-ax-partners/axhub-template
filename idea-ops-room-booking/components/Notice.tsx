import { Alert } from '@heroui/react'

// 서버 액션이 주소에 실어 보낸 결과 코드 (?ok= / ?error=)를 정해진 문구로 보여줘요.
// 주소의 글자를 그대로 화면에 찍지 않아요 — 남이 만든 링크로 가짜 안내문을 띄울 수 없게요.
// 모르는 코드는 아무것도 보여주지 않아요. 새 메시지는 아래 표에 코드를 추가해 써요.
const OK = {
  room_created: '회의실을 등록했어요.',
  booked: '예약을 마쳤어요.',
  cancelled: '예약을 취소했어요.',
} as const

const ERROR = {
  room_forbidden: '회의실 등록은 관리자만 할 수 있어요.',
  room_name: '회의실 이름을 1~50자로 입력해 주세요.',
  room_capacity: '수용 인원은 1~1000 사이 숫자로 입력해 주세요.',
  room_duplicate: '같은 이름의 회의실이 이미 있어요. 다른 이름을 써 주세요.',
  login_to_book: '로그인한 뒤 예약할 수 있어요.',
  bad_day: '날짜가 올바르지 않아요. 다시 골라 주세요.',
  bad_room: '회의실을 다시 골라 주세요.',
  bad_title: '제목을 1~100자로 입력해 주세요.',
  bad_range: '종료 시각은 시작 시각보다 늦어야 해요. 30분 단위로 골라 주세요.',
  past: '이미 지난 시간은 예약할 수 없어요.',
  overlap: '그 시간에 이미 다른 예약이 있어요. 다른 시간을 골라 주세요.',
  room_missing: '회의실을 찾을 수 없어요. 새로고침한 뒤 다시 골라 주세요.',
  login_to_cancel: '로그인한 뒤 취소할 수 있어요.',
  cancel_missing: '취소할 예약을 찾지 못했어요. 이미 취소됐을 수 있어요.',
} as const

export type OkCode = keyof typeof OK
export type ErrorCode = keyof typeof ERROR

const pick = <T extends object>(table: T, code?: string) =>
  code && Object.hasOwn(table, code) ? (table[code as keyof T] as string) : ''

export function Notice({ ok, error }: { ok?: string; error?: string }) {
  const err = pick(ERROR, error)
  const msg = err || pick(OK, ok)
  if (!msg) return null
  return (
    <Alert status={err ? 'danger' : 'success'} role={err ? 'alert' : 'status'}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{msg}</Alert.Title>
      </Alert.Content>
    </Alert>
  )
}
