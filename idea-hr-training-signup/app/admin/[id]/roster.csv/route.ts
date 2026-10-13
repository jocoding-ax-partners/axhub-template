// 교육별 신청자 명단 CSV 내려받기 — 관리자만.
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { formatDateTime, formatWhen, isManager, toCsv } from '@/lib/training'
import { allSignups, getTraining } from '@/lib/training-store'

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isManager(await me())) return text('관리자만 내려받을 수 있어요.', 403)
  if (!isDbConfigured()) return text('아직 데이터베이스가 연결되지 않았어요.', 503)
  const t = await getTraining(id)
  if (!t) return text('없는 교육이에요.', 404)

  const rows = await allSignups(t.id)
  const csv = toCsv([
    ['번호', '이름', '이메일', '신청 시각', '교육', '일시', '장소'],
    ...rows.map((s, i) => [i + 1, s.user_name, s.user_email, formatDateTime(s.created_at), t.title, formatWhen(t.starts_at), t.location]),
  ])
  // 파일 이름의 / \ : * ? " < > | 는 운영체제가 못 쓰는 글자라 빼요.
  const filename = `${t.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 60) || '교육'}-신청자.csv`
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="training-${t.id}.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  })
}
