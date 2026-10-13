'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·담당자 여부와 입력값을 여기서 다시 확인해요.
// 예상되는 실패(권한 없음 · 잘못된 값 · 다른 사람이 먼저 고침)는 throw 하지 않고 FormState 로 돌려줘요.
// 배포본에서는 throw 한 메시지가 가려져 "문제가 생겼어요" 만 보이기 때문이에요.
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { MAX_PHOTO_BYTES, PHOTO_BAD_TYPE, PHOTO_TOO_BIG, isManager, sniffImageType, validateReport, validateUpdate } from '@/lib/facility'
import { createReport, updateReport } from '@/lib/facility-store'
import { deleteFile, isStorageConfigured, putFile } from '@/lib/storage'

export type FormState = { ok: boolean; message: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const fail = (message: string): FormState => ({ ok: false, message })

// 고장 신고 — 로그인한 사람 누구나. 사진은 한 장까지, 선택이에요.
export async function submitReport(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return fail('로그인이 풀렸어요. 새로고침한 뒤 다시 로그인해 주세요.')
  if (!isDbConfigured()) return fail('아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.')

  const checked = validateReport({ location: form.get('location'), description: form.get('description') })
  if (!checked.ok) return fail(checked.error)

  let photoKey: string | null = null
  const file = form.get('photo')
  if (file instanceof File && file.size > 0) {
    if (!isStorageConfigured()) return fail('사진을 저장할 곳이 아직 켜지지 않았어요. 사진 없이 신고해 주세요.')
    if (file.size > MAX_PHOTO_BYTES) return fail(PHOTO_TOO_BIG)
    const bytes = new Uint8Array(await file.arrayBuffer())
    const type = sniffImageType(bytes)
    if (!type) return fail(PHOTO_BAD_TYPE)
    // 경로에 사용자 입력(파일 이름)을 쓰지 않아요.
    photoKey = `reports/${randomUUID()}.${type.split('/')[1]}`
    try {
      await putFile(photoKey, bytes, type)
    } catch {
      return fail('사진을 올리지 못했어요. 잠시 뒤 다시 시도해 주세요.')
    }
  }

  try {
    await createReport({ userKey: visitor.user_id, name: visitor.name || visitor.email, email: visitor.email }, checked.value, photoKey)
  } catch {
    // 저장에 실패하면 먼저 올린 사진도 지워서 주인 없는 파일을 남기지 않아요.
    if (photoKey) await deleteFile(photoKey).catch(() => {})
    return fail(SAVE_FAILED)
  }
  revalidatePath('/')
  revalidatePath('/admin')
  return { ok: true, message: '신고했어요. 담당자가 처리하면 아래 목록의 상태가 바뀌어요.' }
}

// 상태 · 처리 메모 저장 — 담당자(관리자)만.
export async function saveHandling(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!isManager(visitor)) return fail('담당자(앱 관리자)만 상태를 바꿀 수 있어요.')
  if (!isDbConfigured()) return fail('아직 데이터베이스가 연결되지 않았어요.')

  const checked = validateUpdate({
    id: form.get('id'),
    status: form.get('status'),
    memo: form.get('memo'),
    version: form.get('version'),
  })
  if (!checked.ok) return fail(checked.error)

  try {
    const problem = await updateReport(checked.value, visitor.name || visitor.email)
    if (problem) return fail(problem)
  } catch {
    return fail(SAVE_FAILED)
  }
  revalidatePath('/admin')
  revalidatePath('/')
  return { ok: true, message: '저장했어요. 신고한 직원의 목록에도 바로 보여요.' }
}
