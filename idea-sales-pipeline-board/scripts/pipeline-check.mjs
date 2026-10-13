// 파이프라인 규칙 검사 — npm run check:logic. lib/pipeline.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import {
  canDelete,
  formatShortDate,
  formatWon,
  isOverdue,
  kstToday,
  neighborStage,
  parseAmount,
  sumAmounts,
  validateDeal,
} from '../lib/pipeline.ts'

assert.equal(neighborStage('contact', -1), null, '첫 단계 앞은 없음')
assert.equal(neighborStage('contact', 1), 'proposal')
assert.equal(neighborStage('won', 1), 'lost')
assert.equal(neighborStage('lost', 1), null, '마지막 단계 뒤는 없음')

assert.equal(parseAmount('12,000,000'), 12000000n)
assert.equal(parseAmount(' 3 000원 '), 3000n)
assert.equal(parseAmount('0'), 0n)
assert.equal(parseAmount('-5'), null, '음수')
assert.equal(parseAmount('1.5'), null, '소수')
assert.equal(parseAmount(''), null, '빈 값')

const deal = (over = {}) =>
  validateDeal({ company: ' 한빛상사 ', amount: '12,000,000', owner: '김영업', expectedClose: '2026-11-30', stage: 'contact', ...over })
assert.deepEqual(deal().value, { company: '한빛상사', amount: '12000000', owner: '김영업', expectedClose: '2026-11-30', stage: 'contact' })
assert.equal(deal({ expectedClose: '' }).value.expectedClose, null, '예상 계약일은 비워도 돼요')
assert.equal(deal({ company: '  ' }).ok, false, '고객사 없음')
assert.equal(deal({ company: 'x'.repeat(101) }).ok, false, '고객사 길이')
assert.equal(deal({ amount: '천만원' }).ok, false, '금액이 숫자가 아님')
assert.equal(deal({ amount: '100000000000001' }).ok, false, '금액 상한')
assert.equal(deal({ amount: '100000000000000' }).ok, true, '금액 상한 딱 맞음')
assert.equal(deal({ owner: '' }).ok, false, '담당자 없음')
assert.equal(deal({ expectedClose: '2026-02-30' }).ok, false, '없는 날짜')
assert.equal(deal({ expectedClose: '1999-12-31' }).ok, false, '너무 이른 날짜')
assert.equal(deal({ stage: 'done' }).ok, false, '없는 단계')

assert.equal(formatWon('12000000'), '12,000,000원')
assert.equal(formatWon(sumAmounts(['90000000000000', '90000000000000'])), '180,000,000,000,000원', '큰 합계도 정확')
assert.equal(sumAmounts([]), 0n)

assert.equal(isOverdue('proposal', '2026-10-12', '2026-10-13'), true)
assert.equal(isOverdue('proposal', '2026-10-13', '2026-10-13'), false, '오늘은 아직 안 지남')
assert.equal(isOverdue('won', '2026-10-01', '2026-10-13'), false, '끝난 거래는 지남 표시 없음')
assert.equal(isOverdue('contact', null, '2026-10-13'), false)

assert.equal(kstToday(new Date('2026-12-31T15:30:00Z')), '2027-01-01', 'KST 자정 넘김')
assert.equal(formatShortDate('2026-10-08', '2026-10-13'), '10월 8일')
assert.equal(formatShortDate('2027-01-05', '2026-10-13'), '2027년 1월 5일')

const user = (id, admin = false) => ({ authenticated: true, user_id: id, email: '', name: '', app_role: '', is_admin: admin, tenant_slug: '', surface: '' })
assert.equal(canDelete(user('u1'), 'u1'), true, '등록한 사람')
assert.equal(canDelete(user('u2'), 'u1'), false, '다른 사람')
assert.equal(canDelete(user('u2', true), 'u1'), true, '관리자')
assert.equal(canDelete({ ...user(''), authenticated: false, is_admin: true }, ''), false, '로그인 안 함')

console.log('✓ 파이프라인 규칙 검사 통과')
