'use server'

// 화면의 폼·버튼이 부르는 서버 함수(Server Action). 화면에서 버튼을 숨겨도 주소로 직접 부를 수 있으니
// 로그인·권한과 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { me, type AxhubMe } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { kstToday, validateShipment } from '@/lib/shipment'
import {
  createShipment as insertShipment,
  deleteShipment as removeShipment,
  setFollowUpDone as saveDone,
  updateShipment as saveShipment,
} from '@/lib/shipment-store'

export type FormState = { ok: boolean; message: string; id?: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const BAD_ID = '잘못된 발송 기록이에요. 화면을 새로고침해 주세요.'

/** 로그인·DB 확인. 문제가 있으면 보여 줄 문구를 돌려줘요. */
function blocked(visitor: AxhubMe): string | null {
  if (!visitor.authenticated) return '로그인한 뒤 쓸 수 있어요.'
  if (!isDbConfigured()) return '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.'
  return null
}

const actorOf = (v: AxhubMe) => ({ userKey: v.user_id, name: v.name || v.email, isAdmin: v.is_admin })

const idOf = (form: FormData): string | null => {
  const id = String(form.get('id') ?? '')
  return /^\d{1,18}$/.test(id) ? id : null
}

function readShipment(form: FormData) {
  return validateShipment(
    {
      customer: String(form.get('customer') ?? ''),
      contact: String(form.get('contact') ?? ''),
      items: String(form.get('items') ?? ''),
      sentOn: String(form.get('sent_on') ?? ''),
      followUpOn: String(form.get('follow_up_on') ?? ''),
      memo: String(form.get('memo') ?? ''),
    },
    kstToday(),
  )
}

// 목록·요약·고객사 화면이 모두 같은 표를 읽어서 한꺼번에 새로 그려요.
const refresh = () => revalidatePath('/', 'layout')

export async function createShipment(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  const stop = blocked(visitor)
  if (stop) return { ok: false, message: stop }

  const checked = readShipment(form)
  if (!checked.ok) return { ok: false, message: checked.error }

  let id: string
  try {
    id = await insertShipment(actorOf(visitor), checked.value)
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  return { ok: true, message: '발송 기록을 남겼어요.', id }
}

export async function updateShipment(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  const stop = blocked(visitor)
  if (stop) return { ok: false, message: stop }
  const id = idOf(form)
  if (!id) return { ok: false, message: BAD_ID }

  const checked = readShipment(form)
  if (!checked.ok) return { ok: false, message: checked.error }

  try {
    const problem = await saveShipment(id, actorOf(visitor), checked.value)
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  return { ok: true, message: '고친 내용을 저장했어요.', id }
}

export async function deleteShipment(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  const stop = blocked(visitor)
  if (stop) return { ok: false, message: stop }
  const id = idOf(form)
  if (!id) return { ok: false, message: BAD_ID }

  try {
    const problem = await removeShipment(id, actorOf(visitor))
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: '지우지 못했어요. 잠시 뒤 다시 시도해 주세요.' }
  }
  refresh()
  return { ok: true, message: '발송 기록을 지웠어요.' }
}

export async function markFollowUp(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  const stop = blocked(visitor)
  if (stop) return { ok: false, message: stop }
  const id = idOf(form)
  if (!id) return { ok: false, message: BAD_ID }
  const done = form.get('done') === 'true'

  try {
    const problem = await saveDone(id, done, actorOf(visitor))
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  refresh()
  return { ok: true, message: done ? '연락 완료로 표시했어요.' : '완료 표시를 풀었어요.', id }
}
