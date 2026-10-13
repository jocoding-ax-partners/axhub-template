// 영업 실적 규칙 검사 — npm run check:logic. lib/sales.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import {
  canDelete,
  changeVsPrev,
  formatMonth,
  formatMonthShort,
  kstToday,
  lastMonths,
  monthOf,
  monthRange,
  parseAmount,
  sharePct,
  shiftMonth,
  validateContract,
  wonShort,
} from '../lib/sales.ts'

const NOW = new Date('2026-10-13T03:00:00Z') // KST 2026-10-13 12:00

// 월 계산 — 해 넘김
assert.equal(shiftMonth('2026-01', -1), '2025-12')
assert.equal(shiftMonth('2026-12', 1), '2027-01')
assert.deepEqual(lastMonths('2026-02', 6), ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02'])
assert.deepEqual(monthRange('2026-12'), { from: '2026-12-01', to: '2027-01-01' })

// ?month= 읽기 — 이상한 값·미래는 이번 달(KST)
assert.equal(monthOf('2026-07', NOW), '2026-07')
assert.equal(monthOf('2026-13', NOW), '2026-10')
assert.equal(monthOf('2026-11', NOW), '2026-10', '미래 달')
assert.equal(monthOf(undefined, NOW), '2026-10')
assert.equal(monthOf('1999-12', NOW), '2026-10', '하한 전')
assert.equal(kstToday(new Date('2026-10-31T15:30:00Z')), '2026-11-01', 'KST 자정 넘김')

// 금액 읽기
assert.equal(parseAmount('12,000,000'), 12_000_000)
assert.equal(parseAmount(' 5000원 '), 5000)
assert.equal(parseAmount('1.5'), null)
assert.equal(parseAmount('-3'), null)
assert.equal(parseAmount(''), null)

// 계약 검사
const v = (date, customer = '한빛상사', amount = '1,000') => validateContract({ date, customer, amount }, NOW)
assert.deepEqual(v('2026-10-13', '  한빛   상사 ').value, { date: '2026-10-13', customer: '한빛 상사', amount: 1000 })
assert.equal(v('2026-10-14').ok, false, '미래 계약일')
assert.equal(v('2026-02-30').ok, false, '없는 날짜')
assert.equal(v('1999-12-31').ok, false, '하한 전')
assert.equal(v('2026-10-01', '   ').ok, false, '고객사 없음')
assert.equal(v('2026-10-01', 'x'.repeat(101)).ok, false, '고객사 길이')
assert.equal(v('2026-10-01', '한빛상사', '0').ok, false, '0원')
assert.equal(v('2026-10-01', '한빛상사', '1,000,000,000,000').ok, false, '1조 이상')
assert.equal(v('2026-10-01', '한빛상사', '999,999,999,999').ok, true, '1조 미만')

// 권한 — 본인 또는 관리자만 지우기
const user = (id, admin = false) => ({ authenticated: true, user_id: id, is_admin: admin })
assert.equal(canDelete(user('u1'), 'u1'), true)
assert.equal(canDelete(user('u2'), 'u1'), false)
assert.equal(canDelete(user('u2', true), 'u1'), true)
assert.equal(canDelete({ authenticated: false, user_id: '', is_admin: true }, ''), false, '익명')

// 표시
assert.equal(wonShort(123_400_000), '1.2억')
assert.equal(wonShort(34_000_000), '3,400만')
assert.equal(wonShort(5_000), '5,000')
assert.equal(wonShort(25_000_000_000), '250억')
assert.equal(formatMonth('2026-03'), '2026년 3월')
assert.equal(formatMonthShort('2027-01'), '27년 1월')
assert.equal(changeVsPrev(150, 100), '지난달보다 50% 늘었어요')
assert.equal(changeVsPrev(50, 100), '지난달보다 50% 줄었어요')
assert.equal(changeVsPrev(10, 0), '지난달 실적이 없어요')
assert.equal(sharePct(1, 3), '33.3%')
assert.equal(sharePct(1, 0), '0%')

console.log('✓ 영업 실적 규칙 검사 통과')
