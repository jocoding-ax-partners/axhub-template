// 참가 신청자 입력 규칙 — CSV 읽기 · 값 검사 · 등록 가능 여부 판정.
// 서버(등록·미리보기)와 브라우저(CSV 글자 읽기)가 함께 써요. 외부 패키지·DB 를 쓰지 않아요.
// 규칙을 바꾸면 `npm run check:logic` 으로 확인해요 (scripts/check-logic.mjs).

export type Applicant = { name: string; company: string; email: string }

export const LIMITS = { name: 100, company: 100, email: 254, rows: 2000, fileBytes: 500_000 }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 한 명의 값을 검사해요. 문제가 없으면 null, 있으면 화면에 보여줄 문장이에요.
export function applicantError(a: Applicant): string | null {
  if (!a.name) return '이름이 비어 있어요.'
  if (a.name.length > LIMITS.name) return `이름은 ${LIMITS.name}자까지 쓸 수 있어요.`
  if (a.company.length > LIMITS.company) return `회사는 ${LIMITS.company}자까지 쓸 수 있어요.`
  if (!a.email) return '이메일이 비어 있어요.'
  if (a.email.length > LIMITS.email || !EMAIL_RE.test(a.email)) return '이메일 형식이 맞지 않아요.'
  return null
}

export const emailKey = (email: string): string => email.trim().toLowerCase()

// ── CSV 글자 읽기 ───────────────────────────────────────────────────────────────
// 엑셀의 "CSV UTF-8" 은 UTF-8(+BOM), 그냥 "CSV" 는 한글 윈도우에서 CP949(EUC-KR) 로 저장돼요.
// UTF-8 로 먼저 읽고, 깨지면 EUC-KR(브라우저 표준상 CP949 전체를 포함)로 다시 읽어요.
export function decodeCsv(bytes: Uint8Array): { text: string } | { error: string } {
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '') }
  } catch {
    // UTF-8 이 아니에요 → 아래에서 EUC-KR 로 시도
  }
  try {
    return { text: new TextDecoder('euc-kr', { fatal: true }).decode(bytes) }
  } catch {
    return { error: '파일 글자를 읽지 못했어요. 엑셀에서 "다른 이름으로 저장 → CSV UTF-8(쉼표로 분리)" 로 다시 저장해 주세요.' }
  }
}

// ── CSV 나누기 ──────────────────────────────────────────────────────────────────
// 따옴표 안의 쉼표·줄바꿈·"" 를 처리하는 최소 파서. 빈 줄은 건너뛰고 원래 줄 번호를 같이 돌려줘요.
function splitRows(text: string): { line: number; cells: string[] }[] {
  const out: { line: number; cells: string[] }[] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let line = 1
  let rowLine = 1
  const endRow = () => {
    row.push(cell)
    if (row.some((v) => v.trim() !== '')) out.push({ line: rowLine, cells: row.map((v) => v.trim()) })
    row = []
    cell = ''
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else {
        if (c === '\n') line++
        cell += c
      }
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      endRow()
      line++
      rowLine = line
    } else cell += c
  }
  endRow()
  return out
}

const HEADERS = {
  name: ['이름', '성명', '성함', '참가자', '신청자', 'name'],
  company: ['회사', '회사명', '소속', '기관', 'company', 'organization'],
  email: ['이메일', '메일', '이메일주소', '이메일 주소', 'email', 'e-mail'],
}

export type CsvRow = Applicant & { line: number }

// 첫 줄이 머리글(이름·회사·이메일 등)이면 그 열을 찾아 읽고, 머리글이 없으면 이름·회사·이메일 순서로 읽어요.
// 다른 열(연락처 등)은 무시해요.
export function parseApplicantsCsv(text: string): { rows: CsvRow[] } | { error: string } {
  const all = splitRows(text.replace(/^﻿/, ''))
  if (all.length === 0) return { error: '파일에 내용이 없어요.' }
  const head = all[0].cells.map((v) => v.toLowerCase().replace(/\s+/g, ' '))
  const find = (keys: string[]) => head.findIndex((h) => keys.includes(h))
  const idx = { name: find(HEADERS.name), company: find(HEADERS.company), email: find(HEADERS.email) }
  const hasHeader = idx.name >= 0 || idx.email >= 0 || idx.company >= 0
  if (hasHeader && (idx.name < 0 || idx.email < 0)) {
    return { error: '머리글에서 "이름" 과 "이메일" 열을 찾지 못했어요. 첫 줄을 이름,회사,이메일 로 맞춰 주세요.' }
  }
  const col = hasHeader ? idx : { name: 0, company: 1, email: 2 }
  const body = hasHeader ? all.slice(1) : all
  if (body.length === 0) return { error: '머리글만 있고 신청자가 없어요.' }
  if (body.length > LIMITS.rows) return { error: `한 번에 ${LIMITS.rows.toLocaleString('ko-KR')}명까지 올릴 수 있어요. 파일을 나눠서 올려 주세요.` }
  return {
    rows: body.map(({ line, cells }) => ({
      line,
      name: cells[col.name] ?? '',
      company: col.company >= 0 ? (cells[col.company] ?? '') : '',
      email: cells[col.email] ?? '',
    })),
  }
}

// ── 등록 가능 여부 판정 ──────────────────────────────────────────────────────────
// 값 오류 → 파일 안 중복 → 이미 신청 → 정원 순서로 봐요. 정원은 위에서부터 남은 자리만큼만 채워요.
export type RowStatus = 'ok' | 'invalid' | 'duplicate' | 'registered' | 'full'
export type ClassifiedRow = CsvRow & { status: RowStatus; reason: string }

export function classifyRows(rows: CsvRow[], registeredEmails: Set<string>, seatsLeft: number): ClassifiedRow[] {
  const seen = new Set<string>()
  let left = Math.max(0, seatsLeft)
  return rows.map((r) => {
    const err = applicantError(r)
    if (err) return { ...r, status: 'invalid', reason: err }
    const key = emailKey(r.email)
    if (seen.has(key)) return { ...r, status: 'duplicate', reason: '파일 안에 같은 이메일이 먼저 있어요.' }
    seen.add(key)
    if (registeredEmails.has(key)) return { ...r, status: 'registered', reason: '이미 신청한 이메일이에요.' }
    if (left <= 0) return { ...r, status: 'full', reason: '정원이 다 찼어요.' }
    left--
    return { ...r, status: 'ok', reason: '' }
  })
}
