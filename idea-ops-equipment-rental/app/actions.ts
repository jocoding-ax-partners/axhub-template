'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·관리자 여부와 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { isAdmin, kstToday, validateDue, validateEquipment } from '@/lib/rental'
import { addEquipment as saveEquipment, rentEquipment, retireEquipment as saveRetire, returnRental } from '@/lib/rental-store'

export type FormState = { ok: boolean; message: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const NO_DB = '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.'
const BAD_ID = '잘못된 요청이에요. 화면을 새로고침해 주세요.'
const isId = (v: string) => /^\d{1,18}$/.test(v)

function refresh() {
  revalidatePath('/')
  revalidatePath('/my')
  revalidatePath('/admin')
}

export async function rent(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 빌릴 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const id = String(form.get('id') ?? '')
  const due = String(form.get('due_date') ?? '')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  const checked = validateDue(due, kstToday())
  if (!checked.ok) return { ok: false, message: checked.error }

  try {
    const r = await rentEquipment(id, { userKey: visitor.user_id, name: visitor.name || visitor.email, email: visitor.email }, due)
    if (!r.ok) return { ok: false, message: r.error }
    refresh()
    return { ok: true, message: `${r.value}을(를) 빌렸어요. 다 쓰면 반납을 눌러 주세요.` }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
}

export async function giveBack(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 반납할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const id = String(form.get('id') ?? '')
  if (!isId(id)) return { ok: false, message: BAD_ID }

  try {
    const r = await returnRental(id, { userKey: visitor.user_id, name: visitor.name || visitor.email, isAdmin: isAdmin(visitor) })
    if (!r.ok) return { ok: false, message: r.error }
    refresh()
    return { ok: true, message: `${r.value}을(를) 반납했어요.` }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
}

export async function addEquipment(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isAdmin(visitor)) return { ok: false, message: '관리자만 장비를 등록할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const checked = validateEquipment({
    name: String(form.get('name') ?? ''),
    kind: String(form.get('kind') ?? ''),
    assetNo: String(form.get('asset_no') ?? ''),
  })
  if (!checked.ok) return { ok: false, message: checked.error }

  try {
    const r = await saveEquipment(checked.value)
    if (!r.ok) return { ok: false, message: r.error }
    refresh()
    return { ok: true, message: `${checked.value.name}을(를) 등록했어요.` }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
}

export async function retireEquipment(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isAdmin(visitor)) return { ok: false, message: '관리자만 장비를 뺄 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  const id = String(form.get('id') ?? '')
  if (!isId(id)) return { ok: false, message: BAD_ID }

  try {
    const r = await saveRetire(id)
    if (!r.ok) return { ok: false, message: r.error }
    refresh()
    return { ok: true, message: `${r.value}을(를) 목록에서 뺐어요.` }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
}
