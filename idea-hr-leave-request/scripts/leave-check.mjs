// 휴가 규칙 검사 — npm run check:logic. lib/leave.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import { formatDate, formatDays, kstToday, leaveDays, validateLeave } from '../lib/leave.ts'

assert.equal(leaveDays('half', '2026-10-08', '2026-10-08'), 0.5)
assert.equal(leaveDays('annual', '2026-10-05', '2026-10-11'), 5, '월~일 = 평일 5일')
assert.equal(leaveDays('sick', '2026-10-10', '2026-10-11'), 0, '주말만')

const ok = (kind, start, end, reason = '가족 행사') => validateLeave({ kind, start, end, reason })
assert.deepEqual(ok('half', '2026-10-08', '').value, { kind: 'half', start: '2026-10-08', end: '2026-10-08', reason: '가족 행사', days: 0.5, year: 2026 })
assert.equal(ok('annual', '2026-10-05', '2026-10-09').value.days, 5)
assert.equal(ok('vacation', '2026-10-05', '2026-10-09').ok, false, '없는 종류')
assert.equal(ok('annual', '2026-02-30', '2026-03-02').ok, false, '없는 날짜')
assert.equal(ok('annual', '2026-10-09', '2026-10-05').ok, false, '종료일이 앞섬')
assert.equal(ok('annual', '2026-12-30', '2027-01-02').ok, false, '해를 넘김')
assert.equal(ok('annual', '2026-10-10', '2026-10-11').ok, false, '평일 없음')
assert.equal(ok('annual', '2026-01-01', '2026-06-30').ok, false, '기간 상한')
assert.equal(ok('annual', '2026-10-05', '2026-10-05', '   ').ok, false, '사유 없음')
assert.equal(ok('annual', '2026-10-05', '2026-10-05', 'x'.repeat(201)).ok, false, '사유 길이')

assert.equal(kstToday(new Date('2026-12-31T15:30:00Z')), '2027-01-01', 'KST 자정 넘김')
assert.equal(formatDate('2026-10-08'), '2026년 10월 8일 (목)')
assert.equal(formatDays(12.5), '12.5일')
assert.equal(formatDays(15), '15일')

console.log('✓ 휴가 규칙 검사 통과')
