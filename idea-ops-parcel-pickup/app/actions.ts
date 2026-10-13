'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·담당자 여부와 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { isDesk, validateParcel } from '@/lib/parcel'
import { cancelParcel as deleteParcel, createParcel, receiveParcel as markReceived } from '@/lib/parcel-store'

export type FormState = { ok: boolean; message: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const NO_DB = '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.'
const BAD_ID = '잘못된 택배예요. 화면을 새로고침해 주세요.'

const idOf = (form: FormData): string | null => {
  const id = String(form.get('id') ?? '')
  return /^\d{1,18}$/.test(id) ? id : null
}

function refresh() {
  revalidatePath('/')
  revalidatePath('/desk')
}

export async function registerParcel(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isDesk(visitor)) return { ok: false, message: '안내데스크 담당자만 택배를 등록할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }

  const checked = validateParcel({
    kind: String(form.get('kind') ?? ''),
    recipientEmail: String(form.get('recipient_email') ?? ''),
    recipientName: String(form.get('recipient_name') ?? ''),
    sender: String(form.get('sender') ?? ''),
    location: String(form.get('location') ?? ''),
    memo: String(form.get('memo') ?? ''),
  })
  if (!checked.ok) return { ok: false, message: checked.error }

  try {
    await createParcel({ userKey: visitor.user_id, name: visitor.name || visitor.email }, checked.value)
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  const who = checked.value.recipientName || checked.value.recipientEmail
  return { ok: true, message: `등록했어요. ${who}님 화면에 바로 보여요.` }
}

export async function receiveParcel(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 수령 처리할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const id = idOf(form)
  if (!id) return { ok: false, message: BAD_ID }

  try {
    const problem = await markReceived(id, {
      userKey: visitor.user_id,
      name: visitor.name || visitor.email,
      email: visitor.email,
      asDesk: isDesk(visitor),
    })
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  return { ok: true, message: '수령 처리했어요.' }
}

export async function cancelParcel(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isDesk(visitor)) return { ok: false, message: '안내데스크 담당자만 등록을 취소할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const id = idOf(form)
  if (!id) return { ok: false, message: BAD_ID }

  try {
    const problem = await deleteParcel(id)
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  return { ok: true, message: '등록을 취소했어요.' }
}
