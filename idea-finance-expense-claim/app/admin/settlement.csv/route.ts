// 월별 정산표 CSV 내려받기 — 관리자만. 직원별 승인 금액 합계예요.
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { monthRange, toCsv } from '@/lib/expense-utils'
import { isAppAdmin, personLabel, settlement } from '@/lib/expenses'

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function GET(req: Request) {
  const visitor = await me()
  if (!isAppAdmin(visitor)) return text('관리자만 내려받을 수 있어요.', 403)
  const month = new URL(req.url).searchParams.get('month') ?? ''
  const range = monthRange(month)
  if (!range) return text('월을 다시 골라 주세요.', 400)

  const rows = isDbConfigured() ? await settlement(range) : []
  const csv = toCsv([
    ['정산월', '직원', '이메일', '승인 건수', '승인 금액(원)'],
    ...rows.map((r) => [month, personLabel(r), r.user_email, r.count, r.total]),
    [month, '합계', '', rows.reduce((s, r) => s + r.count, 0), rows.reduce((s, r) => s + r.total, 0)],
  ])
  const filename = `경비정산-${month}.csv`
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="settlement-${month}.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  })
}
