// 경비 공통 값·순수 함수. 서버·브라우저 어디서나 import 해도 돼요 (DB·헤더를 쓰지 않아요).
// 동작 검사: npm run check:logic (lib/expense-utils.test.ts)

export const CATEGORIES = ['식대', '교통', '소모품', '기타'] as const
export type Category = (typeof CATEGORIES)[number]

export type ExpenseStatus = 'pending' | 'approved' | 'rejected'
export const STATUS_LABEL: Record<ExpenseStatus, string> = { pending: '대기', approved: '승인', rejected: '반려' }

export const MAX_AMOUNT = 100_000_000
export const MAX_MEMO = 200

// 영수증 사진 — 크기와 형식. 브라우저와 서버가 같은 값을 써요.
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024
export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const RECEIPT_TOO_BIG = '영수증 사진은 10MB 이하만 올릴 수 있어요.'
export const RECEIPT_BAD_TYPE = '영수증은 JPG · PNG · WEBP 사진만 올릴 수 있어요.'

const KST_OFFSET_MS = 9 * 3600_000

// 한국 시간 기준 오늘 'YYYY-MM-DD'.
export function todayKst(now = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

// 한국 시간 기준 이번 달 'YYYY-MM'.
export function currentMonthKst(now = new Date()): string {
  return todayKst(now).slice(0, 7)
}

// 'YYYY-MM' → [그 달 1일, 다음 달 1일). 형식이 틀리면 null.
export function monthRange(month: string): [string, string] | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null
  return [`${month}-01`, `${shiftMonth(month, 1)}-01`]
}

// 'YYYY-MM' 을 n 달 앞뒤로.
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

// '2026-10' → '2026년 10월'
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${y}년 ${m}월`
}

// '2026-10-05' → '10월 5일 (일)'
export function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  const wd = '일월화수목금토'[d.getUTCDay()]
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${wd})`
}

export function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

export type ExpenseInput = { spentOn: string; category: Category; amount: number; memo: string }

// 경비 입력값 검사. 화면 검사와 별개로 서버가 반드시 다시 확인해요.
export function parseExpenseInput(
  raw: { spent_on: unknown; category: unknown; amount: unknown; memo: unknown },
  today: string,
): { ok: true; value: ExpenseInput } | { ok: false; error: string } {
  const spentOn = String(raw.spent_on ?? '').trim()
  // 2026-02-31 같은 없는 날짜는 날짜로 바꿨다 되돌려 비교해서 걸러요.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn) || new Date(`${spentOn}T00:00:00Z`).toJSON()?.slice(0, 10) !== spentOn) {
    return { ok: false, error: '사용일을 골라 주세요.' }
  }
  if (spentOn > today) return { ok: false, error: '사용일은 오늘이나 지난 날짜만 고를 수 있어요.' }

  const category = String(raw.category ?? '')
  if (!(CATEGORIES as readonly string[]).includes(category)) return { ok: false, error: '항목을 골라 주세요.' }

  const amountText = String(raw.amount ?? '').replace(/[,\s원]/g, '')
  const amount = Number(amountText)
  if (!/^\d+$/.test(amountText) || !Number.isSafeInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
    return { ok: false, error: '금액은 1원부터 1억 원까지 숫자로 넣어 주세요.' }
  }

  const memo = String(raw.memo ?? '').trim()
  if (memo.length > MAX_MEMO) return { ok: false, error: `메모는 ${MAX_MEMO}자까지 쓸 수 있어요.` }

  return { ok: true, value: { spentOn, category: category as Category, amount, memo } }
}

// 파일 앞부분(매직 바이트)으로 실제 사진 형식을 알아내요. 확장자·브라우저가 알려 준 형식은 믿지 않아요.
export function sniffImageType(b: Uint8Array): (typeof RECEIPT_TYPES)[number] | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return 'image/png'
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to))
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  return null
}

// CSV 한 칸. 따옴표·쉼표·줄바꿈 감싸기 + 엑셀 수식 실행(= + - @ 로 시작) 막기.
function csvCell(v: string | number): string {
  let s = String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// 맨 앞 BOM(﻿) 덕분에 한국어 엑셀에서 더블클릭해도 한글이 깨지지 않아요.
export function toCsv(rows: (string | number)[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
