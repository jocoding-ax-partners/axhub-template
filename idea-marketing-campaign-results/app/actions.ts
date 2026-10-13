'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·권한(등록한 사람 또는 관리자)과 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { me, type AxhubMe } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { parseDate, validateCampaign } from '@/lib/campaign'
import * as store from '@/lib/campaign-store'

/** id 는 저장에 성공했을 때 캠페인 번호 (새로 등록하면 상세 화면으로 이동해요). */
export type FormState = { ok: boolean; message: string; id?: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const BAD_ID = '잘못된 캠페인이에요. 화면을 새로고침해 주세요.'

const field = (form: FormData, key: string) => String(form.get(key) ?? '')
const isId = (id: string) => /^\d{1,18}$/.test(id)

/** 로그인과 DB 연결을 확인해요. 문제가 있으면 보여 줄 문구를 돌려줘요. */
async function visitorOrProblem(): Promise<AxhubMe | FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 쓸 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.' }
  return visitor
}

const isProblem = (v: AxhubMe | FormState): v is FormState => 'ok' in v

function campaignInput(form: FormData) {
  return validateCampaign({
    name: field(form, 'name'),
    channel: field(form, 'channel'),
    start: field(form, 'start_date'),
    end: field(form, 'end_date'),
    cost: field(form, 'cost'),
  })
}

export async function createCampaign(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await visitorOrProblem()
  if (isProblem(visitor)) return visitor
  const checked = campaignInput(form)
  if (!checked.ok) return { ok: false, message: checked.error }
  try {
    const id = await store.createCampaign({ userKey: visitor.user_id, name: visitor.name || visitor.email }, checked.value)
    revalidatePath('/')
    return { ok: true, message: '캠페인을 등록했어요. 이제 날짜별 성과를 적어 보세요.', id }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
}

export async function updateCampaign(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await visitorOrProblem()
  if (isProblem(visitor)) return visitor
  const id = field(form, 'id')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  const checked = campaignInput(form)
  if (!checked.ok) return { ok: false, message: checked.error }
  try {
    const problem = await store.updateCampaign(id, checked.value, visitor)
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/')
  revalidatePath(`/campaigns/${id}`)
  return { ok: true, message: '캠페인 정보를 고쳤어요.', id }
}

export async function deleteCampaign(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await visitorOrProblem()
  if (isProblem(visitor)) return visitor
  const id = field(form, 'id')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  try {
    const problem = await store.deleteCampaign(id, visitor)
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/')
  return { ok: true, message: '캠페인을 지웠어요.' }
}

export async function saveDaily(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await visitorOrProblem()
  if (isProblem(visitor)) return visitor
  const id = field(form, 'campaign_id')
  if (!isId(id)) return { ok: false, message: BAD_ID }
  try {
    const r = await store.saveDaily(
      id,
      {
        day: field(form, 'day'),
        impressions: field(form, 'impressions'),
        clicks: field(form, 'clicks'),
        conversions: field(form, 'conversions'),
      },
      visitor,
    )
    if (!r.ok) return { ok: false, message: r.error }
    revalidatePath('/')
    revalidatePath(`/campaigns/${id}`)
    return { ok: true, message: r.replaced ? '이미 있던 날짜라 새 숫자로 바꿨어요.' : '날짜별 성과를 저장했어요.' }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
}

export async function deleteDaily(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await visitorOrProblem()
  if (isProblem(visitor)) return visitor
  const id = field(form, 'campaign_id')
  const day = field(form, 'day')
  if (!isId(id) || !parseDate(day)) return { ok: false, message: BAD_ID }
  try {
    const problem = await store.deleteDaily(id, day, visitor)
    if (problem) return { ok: false, message: problem }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/')
  revalidatePath(`/campaigns/${id}`)
  return { ok: true, message: '그날 기록을 지웠어요.' }
}
