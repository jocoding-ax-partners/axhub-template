// 지금 사용자 (서버 전용). 로그인 안 했으면 null.
//
// key   = axhub user_id — 고객사 담당자(owner_key)·기록 작성자(author_key)로 저장해요.
// admin = 이 앱의 관리자(me().is_admin) — 남의 고객사도 고치고 지울 수 있어요.
//
// 로컬 단독 실행(axhub 문이 없음)에서는 '로컬 사용자' 로 폴백해 화면을 시험할 수 있게 해요.
import { me } from '@/lib/axhub-server'

export type CurrentUser = { key: string; name: string; admin: boolean }

export async function currentUser(): Promise<CurrentUser | null> {
  const visitor = await me()
  if (visitor.authenticated) {
    return { key: visitor.user_id, name: visitor.name || visitor.email, admin: visitor.is_admin }
  }
  if (process.env.NODE_ENV !== 'production') return { key: 'local-dev', name: '로컬 사용자', admin: false }
  return null
}

/** 고객사 정보를 고치거나 고객사를 지울 수 있는지 — 담당자 본인이거나 앱 관리자. */
export function canManageCompany(user: CurrentUser, ownerKey: string): boolean {
  return user.admin || user.key === ownerKey
}
