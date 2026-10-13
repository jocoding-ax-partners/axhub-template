'use server'

// 화면의 폼이 부르는 서버 함수(Server Action). 화면에서 숨겨도 주소로 직접 부를 수 있으니
// 로그인·권한 여부와 입력값을 여기서 다시 확인해요.
import { revalidatePath } from 'next/cache'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import { canDelete, validateContent } from '@/lib/content'
import { NOT_FOUND, createContent, deleteContent as removeContent, getContent, updateContent } from '@/lib/content-store'

export type FormState = { ok: false; message: string } | { ok: true; message: string; id: string; month: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
const NO_DB = '아직 데이터베이스가 연결되지 않았어요. 앱 관리자에게 알려 주세요.'
const isId = (v: string) => /^\d{1,18}$/.test(v)

/** 등록과 수정을 같이 맡아요. 폼에 id 가 있으면 수정이에요. */
export async function saveContent(_prev: FormState | null, form: FormData): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 저장할 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }

  const checked = validateContent({
    title: String(form.get('title') ?? ''),
    channel: String(form.get('channel') ?? ''),
    publishDate: String(form.get('publish_date') ?? ''),
    owner: String(form.get('owner') ?? ''),
    status: String(form.get('status') ?? ''),
    memo: String(form.get('memo') ?? ''),
  })
  if (!checked.ok) return { ok: false, message: checked.error }

  const id = String(form.get('id') ?? '')
  const version = Number(form.get('version'))
  if (id && (!isId(id) || !Number.isInteger(version))) return { ok: false, message: '잘못된 요청이에요. 화면을 새로고침해 주세요.' }

  const who = { userKey: visitor.user_id, name: visitor.name || visitor.email }
  let savedId = id
  try {
    if (id) {
      const problem = await updateContent(id, version, who, checked.value)
      if (problem) return { ok: false, message: problem }
    } else {
      savedId = await createContent(who, checked.value)
    }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
  revalidatePath('/', 'layout')
  return { ok: true, message: id ? '저장했어요.' : '등록했어요.', id: savedId, month: checked.value.publishDate.slice(0, 7) }
}

/** 지우기 — 등록한 사람이나 관리자만. */
export async function deleteContent(id: string): Promise<FormState> {
  const visitor = await me()
  if (!visitor.authenticated) return { ok: false, message: '로그인한 뒤 지울 수 있어요.' }
  if (!isDbConfigured()) return { ok: false, message: NO_DB }
  if (!isId(id)) return { ok: false, message: '잘못된 요청이에요. 화면을 새로고침해 주세요.' }

  try {
    const row = await getContent(id)
    if (!row) return { ok: false, message: NOT_FOUND }
    if (!canDelete(visitor, row.created_by_key)) return { ok: false, message: '등록한 사람이나 관리자만 지울 수 있어요.' }
    if (!(await removeContent(id))) return { ok: false, message: NOT_FOUND }
    revalidatePath('/', 'layout')
    return { ok: true, message: '지웠어요.', id, month: row.publish_date.slice(0, 7) }
  } catch {
    return { ok: false, message: SAVE_FAILED }
  }
}
