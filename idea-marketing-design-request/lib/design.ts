// 디자인 요청 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/design-check.mjs)
import type { AxhubMe } from './axhub-server'

export const KIND_LABEL = { banner: '배너', detail: '상세페이지', sns: 'SNS 이미지', etc: '기타' } as const
export type DesignKind = keyof typeof KIND_LABEL

export const STATUS_LABEL = { received: '접수', in_progress: '작업 중', review: '검토 요청', done: '완료' } as const
export type DesignStatus = keyof typeof STATUS_LABEL

export const SIZE_MAX = 100
export const COPY_MAX = 2000
/** 희망 마감일은 오늘부터 이 날수 안에서 골라요. */
export const DUE_MAX_DAYS = 365

// ── 파일 ──────────────────────────────────────────────────────────────────────
/** 파일 한 개 최대 크기 */
export const FILE_MAX_BYTES = 20 * 1024 * 1024
/** 한 번에 올리는 파일 크기 합 (next.config.ts 의 bodySizeLimit 과 맞춰요) */
export const UPLOAD_MAX_BYTES = 50 * 1024 * 1024
/** 한 번에 올리는 파일 수 */
export const UPLOAD_MAX_FILES = 5
/** 요청 한 건에 붙일 수 있는 참고 자료 · 결과물 수 */
export const REFERENCE_MAX = 5
export const RESULT_MAX = 20

/** 받을 수 있는 파일 — 이름이 아니라 파일 앞부분(매직 바이트)으로 판별해요. AI 파일은 PDF 로 읽혀요. */
export const FILE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'image/vnd.adobe.photoshop': 'psd',
  'application/zip': 'zip',
} as const
export type FileType = keyof typeof FILE_TYPES
export const FILE_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.ai,.psd,.zip'
export const FILE_HINT = 'JPG · PNG · GIF · WEBP · PDF · AI · PSD · ZIP, 파일당 20MB'

export function sniffFileType(b: Uint8Array): FileType | null {
  const starts = (sig: number[], at = 0) => b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v)
  const ascii = (s: string, at = 0) => starts([...s].map((c) => c.charCodeAt(0)), at)
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (ascii('GIF87a') || ascii('GIF89a')) return 'image/gif'
  if (ascii('RIFF') && ascii('WEBP', 8)) return 'image/webp'
  if (ascii('%PDF-')) return 'application/pdf'
  if (ascii('8BPS')) return 'image/vnd.adobe.photoshop'
  if (starts([0x50, 0x4b, 0x03, 0x04])) return 'application/zip'
  return null
}

/** 브라우저에서 바로 열어 볼 수 있는 형식 (나머지는 내려받아요). */
export function opensInline(type: string): boolean {
  return type === 'application/pdf' || (type.startsWith('image/') && type !== 'image/vnd.adobe.photoshop')
}

/** 저장할 파일 이름 — 경로 글자·제어 문자를 빼고 100자로 잘라요. 화면 표시와 내려받기 이름에만 써요. */
export function cleanFileName(name: string): string {
  const s = name.replace(/[\u0000-\u001f\u007f/\\]/g, '').trim()
  return (s || '파일').slice(-100)
}

export const FILE_COUNT_ERROR = `한 번에 ${UPLOAD_MAX_FILES}개까지 올릴 수 있어요.`
export const FILE_SIZE_ERROR = '파일 하나는 20MB 까지 올릴 수 있어요.'
export const FILE_TOTAL_ERROR = '한 번에 올리는 파일은 합쳐서 50MB 까지예요. 나눠서 올려 주세요.'

/** 고른 파일들의 개수·크기 검사 (내용 판별은 서버가 sniffFileType 으로 다시 해요). */
export function checkFileSizes(sizes: number[]): string | null {
  if (sizes.length > UPLOAD_MAX_FILES) return FILE_COUNT_ERROR
  if (sizes.some((s) => s > FILE_MAX_BYTES)) return FILE_SIZE_ERROR
  if (sizes.reduce((a, s) => a + s, 0) > UPLOAD_MAX_BYTES) return FILE_TOTAL_ERROR
  return null
}

// ── 사람 ──────────────────────────────────────────────────────────────────────

/**
 * 디자이너 = axhub 가 "이 앱의 관리자" 로 알려 준 사람.
 * is_admin 은 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자일 때 true 예요 (AXHUB.md §7).
 */
export function isDesigner(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

// ── 요청 입력 ─────────────────────────────────────────────────────────────────

export function isKind(v: string): v is DesignKind {
  return Object.hasOwn(KIND_LABEL, v)
}

export function isStatus(v: string): v is DesignStatus {
  return Object.hasOwn(STATUS_LABEL, v)
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  // 2026-02-30 같은 없는 날짜를 걸러요 (Date 는 3월 2일로 넘겨 버려요).
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d
}

/** 두 날짜('YYYY-MM-DD') 사이 날수. to 가 앞이면 음수. */
export function daysBetween(from: string, to: string): number {
  const a = parseDate(from)
  const b = parseDate(to)
  return a && b ? Math.round((b.getTime() - a.getTime()) / 86_400_000) : 0
}

/** 'YYYY-MM-DD' 에 n 일을 더한 날짜. */
export function addDays(s: string, n: number): string {
  const d = parseDate(s)
  if (!d) return s
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export type RequestInput = { kind: string; size: string; copy: string; due: string }
export type DesignRequestInput = { kind: DesignKind; size: string; copy: string; due: string }

/** 요청 값 검사. today 는 KST 오늘. 통과하면 저장할 값을, 아니면 보여 줄 문구를 돌려줘요. */
export function validateRequest(
  input: RequestInput,
  today: string,
): { ok: true; value: DesignRequestInput } | { ok: false; error: string } {
  const size = input.size.trim()
  const copy = input.copy.trim()
  if (!isKind(input.kind)) return { ok: false, error: '종류를 골라 주세요.' }
  if (!size) return { ok: false, error: '크기를 적어 주세요. 예: 1200×628px' }
  if (size.length > SIZE_MAX) return { ok: false, error: `크기는 ${SIZE_MAX}자 안으로 적어 주세요.` }
  if (!copy) return { ok: false, error: '들어갈 문구를 적어 주세요.' }
  if (copy.length > COPY_MAX) return { ok: false, error: `문구는 ${COPY_MAX}자 안으로 적어 주세요.` }
  if (!parseDate(input.due)) return { ok: false, error: '희망 마감일을 골라 주세요.' }
  const ahead = daysBetween(today, input.due)
  if (ahead < 0) return { ok: false, error: '희망 마감일은 오늘이나 그 뒤로 골라 주세요.' }
  if (ahead > DUE_MAX_DAYS) return { ok: false, error: `희망 마감일은 ${DUE_MAX_DAYS}일 안으로 골라 주세요.` }
  return { ok: true, value: { kind: input.kind, size, copy, due: input.due } }
}

// ── 진행 단계 ─────────────────────────────────────────────────────────────────
//
//   접수 ──(디자이너가 맡기)──▶ 작업 중 ⇄ 검토 요청 ──▶ 완료
//                                  ▲                      │
//                                  └──── 다시 작업하기 ───┘
//
// 맡은 디자이너만 단계를 바꿔요. 검토 요청 · 완료는 결과물이 하나 이상 있어야 해요.

/** 지금 단계에서 갈 수 있는 다음 단계 (버튼 순서대로). */
export const NEXT_STATUS: Record<DesignStatus, DesignStatus[]> = {
  received: [],
  in_progress: ['review', 'done'],
  review: ['in_progress', 'done'],
  done: ['in_progress'],
}

/** 단계를 바꿀 수 있는지. 안 되면 보여 줄 문구, 되면 null. */
export function statusChangeError(from: DesignStatus, to: string, resultCount: number): string | null {
  if (!isStatus(to)) return '바꿀 단계를 골라 주세요.'
  if (from === 'received') return '먼저 이 요청을 맡아 주세요.'
  if (!NEXT_STATUS[from].includes(to)) return `${STATUS_LABEL[from]}에서 ${STATUS_LABEL[to]}(으)로는 바꿀 수 없어요.`
  if ((to === 'review' || to === 'done') && resultCount === 0) return '결과물 파일을 먼저 올려 주세요.'
  return null
}

/** 결과물을 올리거나 지울 수 있는 단계 — 완료된 요청은 "다시 작업하기" 뒤에 고쳐요. */
export function canEditResults(status: DesignStatus): boolean {
  return status === 'in_progress' || status === 'review'
}

// ── 한국 시간(KST) 표시 ─────────────────────────────────────────────────────

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** 오늘 날짜(KST) 'YYYY-MM-DD'. */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}

/** '2026-10-08' → '2026년 10월 8일 (목)'. 날짜 값이라 시간대 영향이 없어요. */
export function formatDate(s: string): string {
  const d = parseDate(s)
  if (!d) return s
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY[d.getUTCDay()]})`
}

/** 시각 → KST '2026. 10. 8. 오후 3:20'. */
export function formatDateTime(t: Date): string {
  return t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })
}

/** 마감까지 남은 날 표시 — '오늘 마감' · 'D-3' · '2일 지남'. 완료된 요청은 쓰지 않아요. */
export function dueLabel(due: string, today: string): { text: string; late: boolean } {
  const left = daysBetween(today, due)
  if (left === 0) return { text: '오늘 마감', late: false }
  return left > 0 ? { text: `D-${left}`, late: false } : { text: `${-left}일 지남`, late: true }
}

/** 1536 → '1.5KB', 2_400_000 → '2.3MB'. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}
