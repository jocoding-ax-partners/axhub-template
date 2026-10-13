// 견적 요청 규칙 검사 — npm run check:logic. lib/quote.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import { cleanQuery, dueLabel, formatDate, kstToday, statusOf, validateQuote } from '../lib/quote.ts'

const TODAY = '2026-10-13'
const base = { company: ' 한빛상사 ', contactName: '김민지', contactPhone: '010-1234-5678', item: 'A4 용지', quantity: '200', dueDate: '2026-10-20' }
const check = (patch) => validateQuote({ ...base, ...patch }, TODAY)

assert.deepEqual(check({}).value, {
  company: '한빛상사', contactName: '김민지', contactPhone: '010-1234-5678', item: 'A4 용지', quantity: 200, dueDate: '2026-10-20',
})
assert.equal(check({ company: '   ' }).ok, false, '회사명 없음')
assert.equal(check({ company: 'x'.repeat(101) }).ok, false, '회사명 길이')
assert.equal(check({ contactPhone: '+82 (2) 555-0100' }).ok, true, '해외 · 괄호 번호')
assert.equal(check({ contactPhone: '010-12' }).ok, false, '숫자 부족')
assert.equal(check({ contactPhone: '010-1234-567a' }).ok, false, '문자 섞임')
assert.equal(check({ quantity: '0' }).ok, false, '수량 0')
assert.equal(check({ quantity: '1.5' }).ok, false, '소수')
assert.equal(check({ quantity: '-3' }).ok, false, '음수')
assert.equal(check({ quantity: '100000001' }).ok, false, '수량 상한')
assert.equal(check({ dueDate: '2026-02-30' }).ok, false, '없는 날짜')
assert.equal(check({ dueDate: '2026-10-12' }).ok, false, '지난 납기')
assert.equal(check({ dueDate: TODAY }).ok, true, '오늘 납기')

assert.equal(statusOf('won'), 'won')
assert.equal(statusOf('toString'), null, '프로토타입 이름은 상태가 아님')
assert.equal(statusOf(undefined), null)
assert.equal(cleanQuery('  abc  '), 'abc')
assert.equal(cleanQuery('x'.repeat(80)).length, 50)

assert.equal(dueLabel('2026-10-16', TODAY, 'received'), 'D-3')
assert.equal(dueLabel(TODAY, TODAY, 'quoted'), '오늘 납기')
assert.equal(dueLabel('2026-10-10', TODAY, 'received'), '3일 지남')
assert.equal(dueLabel('2026-10-10', TODAY, 'won'), '', '끝난 요청은 표시 없음')

assert.equal(kstToday(new Date('2026-12-31T15:30:00Z')), '2027-01-01', 'KST 자정 넘김')
assert.equal(formatDate('2026-10-08'), '2026년 10월 8일 (목)')

console.log('✓ 견적 요청 규칙 검사 통과')
