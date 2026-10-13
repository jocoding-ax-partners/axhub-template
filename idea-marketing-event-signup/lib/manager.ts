// 담당자 확인 (서버 전용). 이 앱의 모든 화면과 저장은 담당자만 써요.
//
// 담당자 = axhub 가 알려 주는 is_admin(앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자).
// 로컬 개발(next dev, axhub 문이 없음)에서만 화면을 볼 수 있게 'local-dev' 담당자로 취급해요.
// 배포본(production)에서 axhub 설정이 비어 있으면 아무도 들이지 않아요 — 누구나 담당자가 되면 안 되니까요.
import { isAxhubConfigured, me } from '@/lib/axhub-server'

export type ManagerAccess = { ok: true; userKey: string } | { ok: false; reason: 'login' | 'forbidden' | 'unconfigured' }

export async function managerAccess(): Promise<ManagerAccess> {
  if (!isAxhubConfigured()) {
    if (process.env.NODE_ENV !== 'production') return { ok: true, userKey: 'local-dev' }
    return { ok: false, reason: 'unconfigured' }
  }
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, reason: 'login' }
  if (!visitor.is_admin) return { ok: false, reason: 'forbidden' }
  return { ok: true, userKey: visitor.email || visitor.user_id }
}

const DENIED: Record<Exclude<ManagerAccess, { ok: true }>['reason'], string> = {
  login: '로그인이 필요해요. 새로고침한 뒤 다시 로그인해 주세요.',
  forbidden: '담당자만 할 수 있어요.',
  unconfigured: 'axhub 설정이 비어 있어서 저장할 수 없어요.',
}

// Server Action 맨 앞에서 불러요. 담당자가 아니면 저장하지 않고 안내 문구를 돌려줘요
// (throw 하면 배포본에서는 문구가 가려져요).
export async function requireManager(): Promise<{ ok: true; userKey: string } | { ok: false; message: string }> {
  const access = await managerAccess()
  return access.ok ? access : { ok: false, message: DENIED[access.reason] }
}
