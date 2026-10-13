'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·디자이너 여부와 입력값을 여기서 다시 확인해요.
// 예상되는 실패(권한 없음 · 그사이 바뀜 · 잘못된 값)는 throw 하지 않고 { ok:false, message } 로 돌려줘요 —
// 배포본에서는 throw 한 메시지가 가려져 "문제가 생겼어요" 만 보이기 때문이에요.
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { me, type AxhubMe } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import {
  FILE_TYPES,
  REFERENCE_MAX,
  checkFileSizes,
  cleanFileName,
  isDesigner,
  kstToday,
  sniffFileType,
  validateRequest,
} from '@/lib/design'
import * as store from '@/lib/design-store'
import { deleteFiles, isStorageConfigured, putFile } from '@/lib/storage'

export type FormState = { ok: boolean; message: string; id?: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const NO_DB = '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.'
const BAD_ID = '잘못된 요청이에요. 화면을 새로고침해 주세요.'
const fail = (message: string): FormState => ({ ok: false, message })
const isId = (v: string) => /^\d{1,18}$/.test(v)
const person = (v: AxhubMe): store.Person => ({ userKey: v.user_id, name: v.name || v.email, email: v.email })

function refresh(id?: string) {
  revalidatePath('/')
  revalidatePath('/manage')
  if (id) revalidatePath(`/requests/${id}`)
}

/**
 * 폼의 파일을 검사하고 저장소에 올려요. 형식은 파일 이름이 아니라 내용(매직 바이트)으로 판별해요.
 * 저장소 경로에는 사용자 입력(파일 이름)을 쓰지 않아요 — 이름은 DB 에만 남겨 화면·내려받기에 써요.
 */
async function uploadFiles(form: FormData, field: string): Promise<{ error: string } | { error: null; files: store.StoredFile[] }> {
  const picked = form.getAll(field).filter((f): f is File => f instanceof File && f.size > 0)
  if (picked.length === 0) return { error: null, files: [] }
  if (!isStorageConfigured()) return { error: '파일 저장소가 아직 켜지지 않았어요. 앱 관리자에게 알려 주세요.' }
  const sizeError = checkFileSizes(picked.map((f) => f.size))
  if (sizeError) return { error: sizeError }

  const ready: { bytes: Uint8Array; file: store.StoredFile }[] = []
  for (const f of picked) {
    const bytes = new Uint8Array(await f.arrayBuffer())
    const type = sniffFileType(bytes)
    if (!type) return { error: `${cleanFileName(f.name)} 은(는) 올릴 수 없는 형식이에요. 이미지 · PDF · AI · PSD · ZIP 만 올려 주세요.` }
    ready.push({ bytes, file: { key: `design/${randomUUID()}.${FILE_TYPES[type]}`, name: cleanFileName(f.name), type, size: f.size } })
  }
  try {
    await Promise.all(ready.map((r) => putFile(r.file.key, r.bytes, r.file.type)))
  } catch {
    await deleteFiles(ready.map((r) => r.file.key))
    return { error: '파일을 올리지 못했어요. 잠시 뒤 다시 시도해 주세요.' }
  }
  return { error: null, files: ready.map((r) => r.file) }
}

// 새 요청 — 로그인한 사람 누구나. 참고 자료 파일은 선택이에요.
export async function submitRequest(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return fail('로그인한 뒤 요청할 수 있어요.')
  if (!isDbConfigured()) return fail(NO_DB)

  const checked = validateRequest(
    {
      kind: String(form.get('kind') ?? ''),
      size: String(form.get('size') ?? ''),
      copy: String(form.get('copy') ?? ''),
      due: String(form.get('due_date') ?? ''),
    },
    kstToday(),
  )
  if (!checked.ok) return fail(checked.error)
  if (form.getAll('references').filter((f) => f instanceof File && f.size > 0).length > REFERENCE_MAX)
    return fail(`참고 자료는 ${REFERENCE_MAX}개까지 올릴 수 있어요.`)

  const uploaded = await uploadFiles(form, 'references')
  if (uploaded.error !== null) return fail(uploaded.error)

  let id: string
  try {
    id = await store.createRequest(person(visitor), checked.value, uploaded.files)
  } catch {
    // 저장에 실패하면 먼저 올린 파일도 지워서 주인 없는 파일을 남기지 않아요.
    await deleteFiles(uploaded.files.map((f) => f.key))
    return fail(SAVE_FAILED)
  }
  refresh()
  return { ok: true, message: '요청을 보냈어요. 디자이너가 맡으면 단계가 바뀌어요.', id }
}

// 요청 취소 — 요청자 본인, 아직 접수 단계일 때만.
export async function cancelRequest(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return fail('로그인이 풀렸어요. 새로고침한 뒤 다시 로그인해 주세요.')
  const id = String(form.get('id') ?? '')
  if (!isId(id)) return fail(BAD_ID)
  try {
    const r = await store.cancelRequest(id, visitor.user_id)
    if (r.error !== null) return fail(r.error)
    await deleteFiles(r.keys)
  } catch {
    return fail('취소하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
  }
  refresh(id)
  return { ok: true, message: '요청을 취소했어요.' }
}

// 요청 맡기 — 디자이너만. designer = 화면에 보이던 담당자(없으면 빈 값). 그사이 바뀌었으면 덮어쓰지 않아요.
export async function takeRequest(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isDesigner(visitor)) return fail('디자이너(앱 관리자)만 요청을 맡을 수 있어요.')
  const id = String(form.get('id') ?? '')
  if (!isId(id)) return fail(BAD_ID)
  try {
    const problem = await store.takeRequest(id, person(visitor), String(form.get('designer') ?? ''))
    if (problem) return fail(problem)
  } catch {
    return fail(SAVE_FAILED)
  }
  refresh(id)
  return { ok: true, message: '이 요청을 맡았어요.' }
}

// 단계 바꾸기 — 맡은 디자이너만. from = 누를 때 화면에 보이던 단계.
export async function changeStatus(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isDesigner(visitor)) return fail('디자이너(앱 관리자)만 단계를 바꿀 수 있어요.')
  const id = String(form.get('id') ?? '')
  if (!isId(id)) return fail(BAD_ID)
  try {
    const problem = await store.changeStatus(id, String(form.get('from') ?? ''), String(form.get('to') ?? ''), visitor.user_id)
    if (problem) return fail(problem)
  } catch {
    return fail(SAVE_FAILED)
  }
  refresh(id)
  return { ok: true, message: '단계를 바꿨어요.' }
}

// 결과물 올리기 — 맡은 디자이너만, 작업 중 · 검토 요청 단계에서.
export async function uploadResults(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isDesigner(visitor)) return fail('디자이너(앱 관리자)만 결과물을 올릴 수 있어요.')
  const id = String(form.get('id') ?? '')
  if (!isId(id)) return fail(BAD_ID)

  const uploaded = await uploadFiles(form, 'results')
  if (uploaded.error !== null) return fail(uploaded.error)
  if (uploaded.files.length === 0) return fail('올릴 파일을 골라 주세요.')

  try {
    const problem = await store.addResults(id, person(visitor), uploaded.files)
    if (problem) {
      await deleteFiles(uploaded.files.map((f) => f.key))
      return fail(problem)
    }
  } catch {
    await deleteFiles(uploaded.files.map((f) => f.key))
    return fail(SAVE_FAILED)
  }
  refresh(id)
  return { ok: true, message: `결과물 ${uploaded.files.length}개를 올렸어요.` }
}

// 결과물 지우기 — 맡은 디자이너만, 완료 전에만.
export async function deleteResult(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isDesigner(visitor)) return fail('디자이너(앱 관리자)만 결과물을 지울 수 있어요.')
  const fileId = String(form.get('file_id') ?? '')
  if (!isId(fileId)) return fail(BAD_ID)
  try {
    const r = await store.deleteResult(fileId, visitor.user_id)
    if (r.error !== null) return fail(r.error)
    await deleteFiles(r.keys)
  } catch {
    return fail('지우지 못했어요. 잠시 뒤 다시 시도해 주세요.')
  }
  const id = String(form.get('id') ?? '')
  refresh(isId(id) ? id : undefined)
  return { ok: true, message: '결과물을 지웠어요.' }
}
