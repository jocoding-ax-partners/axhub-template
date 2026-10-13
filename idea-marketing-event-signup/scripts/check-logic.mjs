// 신청자 규칙 자가 점검 (Node 22.6+): npm run check:logic
// lib/applicants.ts 의 CSV 읽기 · 값 검사 · 등록 가능 판정이 바뀌면 여기서 걸려요.
import assert from 'node:assert/strict'
import { classifyRows, decodeCsv, parseApplicantsCsv } from '../lib/applicants.ts'

// 1) 글자 읽기 — UTF-8(BOM 포함) · CP949(EUC-KR)
const utf8 = new TextEncoder().encode('﻿이름,회사,이메일\r\n홍길동,가나다,a@x.com\r\n')
assert.equal(decodeCsv(utf8).text, '이름,회사,이메일\r\n홍길동,가나다,a@x.com\r\n')
// "홍길동,방각하" 를 EUC-KR 바이트로. ('똠' 같은 CP949 확장 글자는 브라우저 TextDecoder 가 읽어요 —
// Node 의 euc-kr 은 확장 영역을 빼먹어서 여기서는 기본 영역만 확인해요.)
const euckr = Uint8Array.from([0xc8, 0xab, 0xb1, 0xe6, 0xb5, 0xbf, 0x2c, 0xb9, 0xe6, 0xb0, 0xa2, 0xc7, 0xcf])
assert.equal(decodeCsv(euckr).text, '홍길동,방각하')

// 2) 나누기 — 머리글 순서 · 따옴표 · 빈 줄 · 다른 열 무시 · 줄 번호
const parsed = parseApplicantsCsv('이메일,연락처,성명,소속\r\na@x.com,010,홍길동,"A, Inc."\r\n\r\n"b@y.kr",,"이""영희",\n')
assert.deepEqual(parsed.rows, [
  { line: 2, name: '홍길동', company: 'A, Inc.', email: 'a@x.com' },
  { line: 4, name: '이"영희', company: '', email: 'b@y.kr' },
])
assert.deepEqual(parseApplicantsCsv('김철수,B사,b@y.kr').rows, [{ line: 1, name: '김철수', company: 'B사', email: 'b@y.kr' }])
assert.ok('error' in parseApplicantsCsv(''))
assert.ok('error' in parseApplicantsCsv('이름,회사\n홍길동,A'))
assert.ok('error' in parseApplicantsCsv('이름,회사,이메일\n'))

// 3) 판정 — 오류 · 파일 안 중복(대소문자 무시) · 이미 신청 · 정원
const rows = [
  { line: 2, name: '가', company: '', email: 'a@x.com' },
  { line: 3, name: '', company: '', email: 'b@x.com' },
  { line: 4, name: '나', company: '', email: 'A@X.com' },
  { line: 5, name: '다', company: '', email: 'old@x.com' },
  { line: 6, name: '라', company: '', email: 'not-an-email' },
  { line: 7, name: '마', company: '', email: 'c@x.com' },
  { line: 8, name: '바', company: '', email: 'd@x.com' },
]
assert.deepEqual(
  classifyRows(rows, new Set(['old@x.com']), 2).map((r) => r.status),
  ['ok', 'invalid', 'duplicate', 'registered', 'invalid', 'ok', 'full'],
)
assert.ok(classifyRows(rows.slice(0, 1), new Set(), -3).every((r) => r.status === 'full'))

console.log('✓ 신청자 규칙 점검 통과')
