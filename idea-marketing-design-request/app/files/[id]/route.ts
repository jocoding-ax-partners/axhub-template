// 파일 보기 · 내려받기 — 요청자 본인 또는 디자이너만. 권한을 확인한 뒤 5분짜리 임시 주소로 보내요.
// 파일 주소 자체는 화면에 남지 않아요 (버킷 비공개 · 공개 링크 없음).
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { isDesigner, opensInline } from '@/lib/design'
import { getFileForView } from '@/lib/design-store'
import { isStorageConfigured, signedUrl } from '@/lib/storage'

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const visitor = await me()
  if (!visitor.authenticated) return text('로그인한 뒤 볼 수 있어요.', 401)
  if (!isDbConfigured() || !isStorageConfigured()) return text('파일을 찾을 수 없어요.', 404)

  const file = await getFileForView(id)
  // 남의 요청 파일은 "없다" 와 같은 답을 줘서 있는지조차 알 수 없게 해요.
  if (!file || (file.requester_key !== visitor.user_id && !isDesigner(visitor))) return text('파일을 찾을 수 없어요.', 404)

  const location = await signedUrl(file.storage_key, file.file_name, opensInline(file.content_type))
  return new Response(null, {
    status: 302,
    headers: { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  })
}
