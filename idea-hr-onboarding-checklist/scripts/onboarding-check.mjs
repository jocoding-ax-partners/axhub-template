// 온보딩 규칙 검사 — npm run check:logic. lib/onboarding.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import { formatDate, kstToday, progress, startLabel, validateHire, validateTitle } from '../lib/onboarding.ts'

assert.equal(progress(0, 5), 0)
assert.equal(progress(3, 5), 60)
assert.equal(progress(2, 3), 67, '반올림')
assert.equal(progress(5, 5), 100)
assert.equal(progress(0, 0), null, '항목 없음')
assert.equal(progress(6, 5), 100, '100% 를 넘지 않음')

const hire = (name, department, startDate) => validateHire({ name, department, startDate })
assert.deepEqual(hire(' 김하나 ', ' 개발팀 ', '2026-10-08').value, { name: '김하나', department: '개발팀', startDate: '2026-10-08' })
assert.equal(hire('', '개발팀', '2026-10-08').ok, false, '이름 없음')
assert.equal(hire('김하나', '  ', '2026-10-08').ok, false, '부서 없음')
assert.equal(hire('x'.repeat(51), '개발팀', '2026-10-08').ok, false, '이름 길이')
assert.equal(hire('김하나', '개발팀', '2026-02-30').ok, false, '없는 날짜')
assert.equal(hire('김하나', '개발팀', '').ok, false, '입사일 없음')
assert.equal(hire('김하나', '개발팀', '1999-12-31').ok, false, '말이 안 되는 연도')

assert.equal(validateTitle('  복지 안내 ').value, '복지 안내')
assert.equal(validateTitle('   ').ok, false)
assert.equal(validateTitle('x'.repeat(101)).ok, false)

assert.equal(kstToday(new Date('2026-12-31T15:30:00Z')), '2027-01-01', 'KST 자정 넘김')
assert.equal(formatDate('2026-10-08'), '2026년 10월 8일 (목)')
assert.equal(startLabel('2026-10-11', '2026-10-08'), 'D-3')
assert.equal(startLabel('2026-10-08', '2026-10-08'), '오늘 입사')
assert.equal(startLabel('2026-10-01', '2026-10-08'), '입사 8일째')

console.log('✓ 온보딩 규칙 검사 통과')
