// 예산 규칙 검사 — npm run check:logic. lib/budget.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import {
  formatDate,
  formatWon,
  isWarn,
  kstToday,
  parseAmount,
  parseYear,
  usageRate,
  validateBudget,
  validateDepartmentName,
  validateExpense,
  validateManagerEmail,
} from '../lib/budget.ts'

// 집행률 · 강조
assert.equal(usageRate(1000, 0), 0)
assert.equal(usageRate(1000, 900), 90)
assert.equal(usageRate(3, 1), 33.3)
assert.equal(usageRate(1000, 1500), 150, '초과 집행은 100% 를 넘겨 보여요')
assert.equal(usageRate(0, 0), 0)
assert.equal(usageRate(0, 5), 100, '예산 0원에 집행이 있으면 100%')
assert.equal(isWarn(1000, 900), true, '정확히 90%')
assert.equal(isWarn(10000, 8996), false, '89.96% 는 90.0% 로 보여도 강조 안 함')
assert.equal(isWarn(1000, 1200), true)
assert.equal(isWarn(0, 0), false)
assert.equal(isWarn(0, 1), true)

// 금액
assert.equal(parseAmount('1,200,000', false), 1_200_000)
assert.equal(parseAmount(' 3000원 ', false), 3000)
assert.equal(parseAmount('0', true), 0)
assert.equal(parseAmount('0', false), null, '집행 금액은 1원 이상')
assert.equal(parseAmount('-5', true), null)
assert.equal(parseAmount('1.5', true), null)
assert.equal(parseAmount('1e6', true), null)
assert.equal(parseAmount('', true), null)
assert.equal(parseAmount('10,000,000,000,001', true), null, '10조 초과')

// 연도
assert.equal(parseYear('2025', 2026), 2025)
assert.equal(parseYear('abc', 2026), 2026)
assert.equal(parseYear('1999', 2026), 2026)
assert.equal(parseYear(undefined, 2026), 2026)

// 입력 검사
assert.deepEqual(validateDepartmentName('  재무   팀 '), { ok: true, value: '재무 팀' })
assert.equal(validateDepartmentName('   ').ok, false)
assert.equal(validateDepartmentName('가'.repeat(31)).ok, false)
assert.deepEqual(validateBudget({ year: '2026', amount: '50,000,000' }), { ok: true, value: { year: 2026, amount: 50_000_000 } })
assert.equal(validateBudget({ year: '2026', amount: '' }).ok, false)
assert.equal(validateBudget({ year: '3000', amount: '1' }).ok, false)
assert.deepEqual(validateManagerEmail(' Kim@Example.COM '), { ok: true, value: 'kim@example.com' })
assert.equal(validateManagerEmail('kim').ok, false)

const today = '2026-10-13'
const ex = (spentOn, description = '사무용품', amount = '12,000') => validateExpense({ spentOn, description, amount }, today)
assert.deepEqual(ex('2026-10-13').value, { spentOn: '2026-10-13', description: '사무용품', amount: 12000, year: 2026 })
assert.equal(ex('2026-10-14').ok, false, '미래 날짜')
assert.equal(ex('2026-02-30').ok, false, '없는 날짜')
assert.equal(ex('2025-12-31').value.year, 2025, '집행 날짜의 연도 예산에서 빠져요')
assert.equal(ex('2026-10-01', '   ').ok, false, '내용 없음')
assert.equal(ex('2026-10-01', 'x'.repeat(201)).ok, false, '내용 길이')
assert.equal(ex('2026-10-01', '택시', '0').ok, false, '0원')

// 표시
assert.equal(kstToday(new Date('2026-12-31T15:30:00Z')), '2027-01-01', 'KST 자정 넘김')
assert.equal(formatDate('2026-10-08'), '2026. 10. 8. (목)')
assert.equal(formatWon(-1500), '-1,500원')

console.log('✓ 예산 규칙 검사 통과')
