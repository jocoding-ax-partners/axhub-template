// 구매 요청 규칙 검사 — npm run check:logic. lib/purchase.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import { formatDateTime, isHighValue, parseAmount, validatePurchase, won } from '../lib/purchase.ts'

assert.equal(parseAmount('1,200,000'), 1200000)
assert.equal(parseAmount(' 3 '), 3)
assert.equal(parseAmount('1.5'), null, '소수')
assert.equal(parseAmount('-1'), null, '음수')
assert.equal(parseAmount(''), null)

const ok = (quantity, unitPrice, item = '모니터 27인치', reason = '신규 입사자 지급') =>
  validatePurchase({ item, quantity, unitPrice, reason })
assert.deepEqual(ok('2', '350,000').value, { item: '모니터 27인치', quantity: 2, unitPrice: 350000, reason: '신규 입사자 지급', total: 700000 })
assert.equal(ok('10000', '1,000,000,000').value.total, 10_000_000_000_000, '상한끼리 곱해도 정확')
assert.equal(ok('0', '1000').ok, false, '수량 0')
assert.equal(ok('10001', '1000').ok, false, '수량 상한')
assert.equal(ok('1', '0').ok, false, '단가 0')
assert.equal(ok('1', '1000000001').ok, false, '단가 상한')
assert.equal(ok('1', '1000', '  ').ok, false, '품목 없음')
assert.equal(ok('1', '1000', 'x'.repeat(101)).ok, false, '품목 길이')
assert.equal(ok('1', '1000', '펜', ' ').ok, false, '사유 없음')
assert.equal(ok('1', '1000', '펜', 'x'.repeat(501)).ok, false, '사유 길이')

assert.equal(isHighValue(999_999), false)
assert.equal(isHighValue(1_000_000), true, '100만 원 "이상" 이면 고액')
assert.equal(ok('4', '250,000').value.total, 1_000_000)

assert.equal(won(1200000), '1,200,000원')
assert.equal(formatDateTime(new Date('2026-12-31T15:30:00Z')), '2027. 1. 1. 오전 12:30', 'KST 표시')

console.log('✓ 구매 요청 규칙 검사 통과')
