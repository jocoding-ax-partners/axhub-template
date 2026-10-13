// 콘텐츠 캘린더 규칙 검사 — npm run check:logic. lib/content.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import { canDelete, formatDate, formatMonth, kstToday, monthGrid, monthRange, parseMonth, shiftMonth, validateContent } from '../lib/content.ts'

// 달 이동 · 범위
assert.equal(shiftMonth('2026-01', -1), '2025-12')
assert.equal(shiftMonth('2026-12', 1), '2027-01')
assert.deepEqual(monthRange('2028-02'), { from: '2028-02-01', to: '2028-02-29' }, '윤년')
assert.deepEqual(monthRange('2026-02'), { from: '2026-02-01', to: '2026-02-28' })
assert.equal(parseMonth('2026-13'), null)
assert.equal(parseMonth('2026-1'), null)
assert.equal(parseMonth(undefined), null)
assert.equal(parseMonth('2026-10'), '2026-10')

// 달력 칸 — 2026년 10월 1일은 목요일, 31일까지 → 5주
const oct = monthGrid('2026-10')
assert.equal(oct.length, 5)
assert.ok(oct.every((w) => w.length === 7))
assert.deepEqual(oct[0].slice(0, 5), [null, null, null, null, '2026-10-01'])
assert.equal(oct.flat().filter(Boolean).length, 31)
assert.equal(monthGrid('2026-02').length, 4, '2026년 2월은 일요일 시작 28일 → 4주')
assert.equal(monthGrid('2026-08').length, 6, '2026년 8월은 토요일 시작 31일 → 6주')

// 입력 검사
const base = { title: '가을 신제품 소개', channel: 'youtube', publishDate: '2026-10-20', owner: '김민지', status: 'planning', memo: '' }
const v = (patch) => validateContent({ ...base, ...patch })
assert.deepEqual(v({ title: '  가을 신제품 소개  ' }).value, { ...base, title: '가을 신제품 소개' })
assert.equal(v({ title: '   ' }).ok, false, '제목 없음')
assert.equal(v({ title: 'x'.repeat(101) }).ok, false, '제목 길이')
assert.equal(v({ channel: 'tiktok' }).ok, false, '없는 채널')
assert.equal(v({ channel: 'toString' }).ok, false, '프로토타입 이름')
assert.equal(v({ publishDate: '2026-02-30' }).ok, false, '없는 날짜')
assert.equal(v({ publishDate: '' }).ok, false, '날짜 없음')
assert.equal(v({ publishDate: '1999-12-31' }).ok, false, '범위 밖')
assert.equal(v({ owner: ' ' }).ok, false, '담당자 없음')
assert.equal(v({ status: 'done' }).ok, false, '없는 상태')
assert.equal(v({ memo: 'x'.repeat(1001) }).ok, false, '메모 길이')

// 지우기 권한 — 등록자 또는 관리자
const who = (user_id, is_admin = false) => ({ authenticated: Boolean(user_id), user_id, is_admin })
assert.equal(canDelete(who('u1'), 'u1'), true)
assert.equal(canDelete(who('u2'), 'u1'), false)
assert.equal(canDelete(who('u2', true), 'u1'), true)
assert.equal(canDelete(who(''), ''), false, '로그인 안 함')

// KST
assert.equal(kstToday(new Date('2026-12-31T15:30:00Z')), '2027-01-01', 'KST 자정 넘김')
assert.equal(formatDate('2026-10-08'), '2026년 10월 8일 (목)')
assert.equal(formatMonth('2026-03'), '2026년 3월')

console.log('✓ 콘텐츠 캘린더 규칙 검사 통과')
