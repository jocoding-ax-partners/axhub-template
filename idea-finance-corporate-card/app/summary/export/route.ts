// 한 달 사용 건 CSV 내려받기 — 관리자만. 엑셀에서 바로 열려요 (UTF-8 BOM).
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { isAdmin, parseMonth, toCsv } from '@/lib/card'
import { EXPORT_MAX, exportMonth } from '@/lib/card-store'

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function GET(req: Request) {
  const visitor = await me()
  if (!isAdmin(visitor)) return text('관리자만 내려받을 수 있어요.', 403)
  const month = parseMonth(new URL(req.url).searchParams.get('month') ?? undefined)
  if (!month) return text('월을 다시 골라 주세요.', 400)

  const rows = isDbConfigured() ? await exportMonth(month) : []
  // 잘린 파일에 합계까지 찍히면 틀린 숫자를 믿게 돼요 — 넘으면 아예 내려주지 않아요.
  if (rows.length > EXPORT_MAX) return text('내보낼 행이 2만 건을 넘어요. 기간을 나눠 주세요.', 413)
  const csv = toCsv([
    ['사용일', '가맹점', '금액(원)', '부서', '용도', '입력한 사람', '이메일'],
    ...rows.map((r) => [r.used_on, r.merchant, r.amount, r.department, r.purpose ?? '용도 미기재', r.user_name, r.user_email]),
    ['합계', '', rows.reduce((s, r) => s + r.amount, 0), '', '', '', ''],
  ])
  const filename = `법인카드-${month}.csv`
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="corporate-card-${month}.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  })
}
