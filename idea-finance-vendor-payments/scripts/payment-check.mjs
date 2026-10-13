// 지급 규칙 검사 — npm run check:logic. lib/payment.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import {
  canEdit,
  daysBetween,
  filterOf,
  formatDate,
  formatWon,
  isManager,
  kstToday,
  parseAmount,
  paymentState,
  validatePaidDate,
  validatePayment,
  weekRange,
} from '../lib/payment.ts'

// 금액
assert.equal(parseAmount('1,500,000'), 1_500_000)
assert.equal(parseAmount(' 1500000원 '), 1_500_000)
assert.ok(Number.isNaN(parseAmount('1.5')), '소수')
assert.ok(Number.isNaN(parseAmount('-100')), '음수')
assert.ok(Number.isNaN(parseAmount('')), '빈 값')

// 지급 건 입력
const pay = (o = {}) => validatePayment({ vendor: '한빛상사', amount: '1,500,000', dueDate: '2026-10-15', memo: '', ...o })
assert.deepEqual(pay({ vendor: '  한빛   상사 ', memo: ' 9월분 ' }).value, { vendor: '한빛 상사', amount: 1_500_000, dueDate: '2026-10-15', memo: '9월분' })
assert.equal(pay({ vendor: '   ' }).ok, false, '거래처 없음')
assert.equal(pay({ vendor: 'x'.repeat(101) }).ok, false, '거래처 길이')
assert.equal(pay({ amount: '0' }).ok, false, '0원')
assert.equal(pay({ amount: '100000000001' }).ok, false, '금액 상한')
assert.equal(pay({ amount: '100000000000' }).ok, true, '금액 상한 딱 맞음')
assert.equal(pay({ dueDate: '2026-02-30' }).ok, false, '없는 날짜')
assert.equal(pay({ dueDate: '1999-12-31' }).ok, false, '너무 옛날')
assert.equal(pay({ dueDate: '2026-10-01' }).ok, true, '지난 예정일도 등록 가능')
assert.equal(pay({ memo: 'x'.repeat(301) }).ok, false, '메모 길이')

// 지급일 — 오늘보다 뒤면 안 돼요
assert.equal(validatePaidDate('2026-10-13', '2026-10-13').ok, true)
assert.equal(validatePaidDate('2026-10-14', '2026-10-13').ok, false, '미래 지급일')
assert.equal(validatePaidDate('', '2026-10-13').ok, false, '빈 지급일')

// 한 주 = 월요일 ~ 일요일
assert.deepEqual(weekRange('2026-10-13'), { monday: '2026-10-12', sunday: '2026-10-18' }, '화요일')
assert.deepEqual(weekRange('2026-10-12'), { monday: '2026-10-12', sunday: '2026-10-18' }, '월요일')
assert.deepEqual(weekRange('2026-10-18'), { monday: '2026-10-12', sunday: '2026-10-18' }, '일요일')
assert.deepEqual(weekRange('2026-12-31'), { monday: '2026-12-28', sunday: '2027-01-03' }, '해 넘김')

// 상태
assert.equal(paymentState({ due_date: '2026-10-12', paid_date: null }, '2026-10-13'), 'overdue')
assert.equal(paymentState({ due_date: '2026-10-13', paid_date: null }, '2026-10-13'), 'due', '오늘 예정은 아직 지연 아님')
assert.equal(paymentState({ due_date: '2026-10-01', paid_date: '2026-10-02' }, '2026-10-13'), 'paid')
assert.equal(daysBetween('2026-09-30', '2026-10-13'), 13)

// 권한
const visitor = (o) => ({ authenticated: true, user_id: 'u1', email: '', name: '', app_role: '', is_admin: false, tenant_slug: '', surface: '', ...o })
assert.equal(isManager(visitor({ is_admin: true })), true)
assert.equal(isManager(visitor({ authenticated: false, is_admin: true })), false)
assert.equal(canEdit(visitor(), 'u1'), true, '내가 등록한 건')
assert.equal(canEdit(visitor(), 'u2'), false, '남이 등록한 건')
assert.equal(canEdit(visitor({ is_admin: true }), 'u2'), true, '관리자')

// 화면
assert.equal(filterOf('paid'), 'paid')
assert.equal(filterOf('toString'), 'unpaid', '이상한 값')
assert.equal(kstToday(new Date('2026-12-31T15:30:00Z')), '2027-01-01', 'KST 자정 넘김')
assert.equal(formatDate('2026-10-08', '2026-10-13'), '10월 8일 (목)')
assert.equal(formatDate('2025-10-08', '2026-10-13'), '2025년 10월 8일 (수)')
assert.equal(formatWon(1_500_000), '1,500,000원')

console.log('✓ 지급 규칙 검사 통과')
