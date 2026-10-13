// 온보딩 규칙 — DB·화면과 상관없는 순수 함수만 둬요 (서버·브라우저 어디서든 import 해도 돼요).
// 검사: npm run check:logic (scripts/onboarding-check.mjs)
import type { AxhubMe } from './axhub-server'

/** 앱을 처음 쓸 때 한 번만 넣는 기본 체크리스트. 그 뒤로는 관리자가 화면에서 고쳐요. */
export const DEFAULT_ITEMS = ['노트북 지급', '사내 계정 발급', '보안 교육', '부서 소개', '첫 주 면담']

export const NAME_MAX = 50
export const DEPARTMENT_MAX = 50
export const TITLE_MAX = 100
export const MEMO_MAX = 500
/** 기본 체크리스트 항목 수 상한. 입사자를 등록할 때마다 이만큼 복사돼요. */
export const TEMPLATE_MAX = 30

/**
 * 관리자 = axhub 가 "관리자" 로 알려 준 사람 (기본 체크리스트 추가·삭제, 입사자 삭제).
 * is_admin 은 앱 소유자 · 워크스페이스 관리자 · 플랫폼 관리자일 때 true 예요 (AXHUB.md §7).
 */
export function isAdmin(visitor: AxhubMe): boolean {
  return visitor.authenticated && visitor.is_admin
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  // 2026-02-30 같은 없는 날짜를 걸러요 (Date 는 3월 2일로 넘겨 버려요).
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d
}

export type HireInput = { name: string; department: string; startDate: string }
export type Hire = { name: string; department: string; startDate: string }

/** 입사자 값 검사. 통과하면 저장할 값을, 아니면 사용자에게 보여 줄 문구를 돌려줘요. */
export function validateHire(input: HireInput): { ok: true; value: Hire } | { ok: false; error: string } {
  const name = input.name.trim()
  const department = input.department.trim()
  const startDate = input.startDate.trim()
  if (!name) return { ok: false, error: '이름을 적어 주세요.' }
  if (name.length > NAME_MAX) return { ok: false, error: `이름은 ${NAME_MAX}자 안으로 적어 주세요.` }
  if (!department) return { ok: false, error: '부서를 적어 주세요.' }
  if (department.length > DEPARTMENT_MAX) return { ok: false, error: `부서는 ${DEPARTMENT_MAX}자 안으로 적어 주세요.` }
  const d = parseDate(startDate)
  if (!d) return { ok: false, error: '입사일을 골라 주세요.' }
  const year = d.getUTCFullYear()
  if (year < 2000 || year > 2100) return { ok: false, error: '입사일을 다시 확인해 주세요.' }
  return { ok: true, value: { name, department, startDate } }
}

/** 기본 체크리스트 항목 이름 검사. */
export function validateTitle(input: string): { ok: true; value: string } | { ok: false; error: string } {
  const title = input.trim()
  if (!title) return { ok: false, error: '항목 이름을 적어 주세요.' }
  if (title.length > TITLE_MAX) return { ok: false, error: `항목 이름은 ${TITLE_MAX}자 안으로 적어 주세요.` }
  return { ok: true, value: title }
}

/** 진행률(%) — 완료 수 ÷ 전체 항목 수, 반올림. 항목이 없으면 null. */
export function progress(done: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((Math.min(done, total) / total) * 100)
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

/** 입사일까지 남은 날 / 지난 날 — 'D-3', '오늘 입사', '입사 12일째'. 오늘은 KST 기준. */
export function startLabel(startDate: string, today: string = kstToday()): string {
  const a = parseDate(startDate)
  const b = parseDate(today)
  if (!a || !b) return ''
  const diff = Math.round((a.getTime() - b.getTime()) / 86_400_000)
  if (diff > 0) return `D-${diff}`
  if (diff === 0) return '오늘 입사'
  return `입사 ${-diff + 1}일째`
}
