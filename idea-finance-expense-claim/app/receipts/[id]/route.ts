// 영수증 사진 보기 — 올린 본인 또는 관리자만. 권한을 확인한 뒤 5분짜리 임시 주소로 보내요.
// 사진 주소 자체는 화면에 남지 않아요 (버킷 비공개 · 공개 링크 없음).
import { me } from '@/lib/axhub-server'
import { db, ensureSchema, isDbConfigured } from '@/lib/db'
import { isAppAdmin } from '@/lib/expenses'
import { isStorageConfigured, signedUrl } from '@/lib/storage'

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const visitor = await me()
  if (!visitor.authenticated) return text('로그인한 뒤 볼 수 있어요.', 401)
  if (!/^\d{1,18}$/.test(id) || !isDbConfigured() || !isStorageConfigured()) return text('영수증을 찾을 수 없어요.', 404)

  await ensureSchema()
  const [row] = await db()<{ user_id: string; receipt_key: string | null }[]>`
    SELECT user_id, receipt_key FROM expenses WHERE id = ${id}`
  // 남의 영수증은 "없다" 와 같은 답을 줘서 있는지조차 알 수 없게 해요.
  if (!row?.receipt_key || (row.user_id !== visitor.user_id && !isAppAdmin(visitor))) {
    return text('영수증을 찾을 수 없어요.', 404)
  }

  return new Response(null, {
    status: 302,
    headers: { Location: await signedUrl(row.receipt_key), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  })
}
