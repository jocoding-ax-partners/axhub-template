// 법인카드 규칙 검사 — npm run check:logic. lib/card.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import { cleanText, formatDate, formatMonth, formatWon, kstToday, monthRange, parseAmount, parseMonth, shiftMonth, toCsv, validateExpense, validatePurpose } from '../lib/card.ts'

const today = '2026-10-13'
const input = (over = {}) => ({ usedOn: '2026-10-08', merchant: '스타벅스  강남점', amount: '12,300', department: ' 영업팀 ', purpose: '', ...over })
const ok = (over) => validateExpense(input(over), today)

assert.deepEqual(ok().value, { usedOn: '2026-10-08', merchant: '스타벅스 강남점', amount: 12300, department: '영업팀', purpose: null }, '빈 용도는 null')
assert.equal(ok({ purpose: ' 거래처 미팅 ' }).value.purpose, '거래처 미팅')
assert.equal(ok({ amount: '12300원' }).value.amount, 12300)
assert.equal(ok({ usedOn: '2026-10-14' }).ok, false, '미래 날짜')
assert.equal(ok({ usedOn: '2026-10-13' }).ok, true, '오늘')
assert.equal(ok({ usedOn: '2026-02-30' }).ok, false, '없는 날짜')
assert.equal(ok({ usedOn: '1999-12-31' }).ok, false, '너무 오래된 날짜')
assert.equal(ok({ merchant: '   ' }).ok, false, '가맹점 없음')
assert.equal(ok({ department: '' }).ok, false, '부서 없음')
assert.equal(ok({ amount: '0' }).ok, false, '0원')
assert.equal(ok({ amount: '-500' }).ok, false, '음수')
assert.equal(ok({ amount: '12.5' }).ok, false, '소수')
assert.equal(ok({ amount: '100,000,001' }).ok, false, '상한 초과')
assert.equal(ok({ amount: '100,000,000' }).ok, true, '상한')
assert.equal(ok({ purpose: 'x'.repeat(201) }).ok, false, '용도 길이')
assert.equal(validatePurpose('  ').ok, false)
assert.equal(validatePurpose(' 팀  회식 ').value, '팀 회식')

assert.equal(Number.isNaN(parseAmount('1e3')), true)
assert.equal(cleanText('  영업   1팀 '), '영업 1팀')

assert.equal(parseMonth('2026-10'), '2026-10')
assert.equal(parseMonth('2026-13'), null)
assert.equal(parseMonth('2026-1'), null)
assert.equal(parseMonth(undefined), null)
assert.equal(shiftMonth('2026-01', -1), '2025-12')
assert.equal(shiftMonth('2026-12', 1), '2027-01')
assert.deepEqual(monthRange('2026-12'), { from: '2026-12-01', to: '2027-01-01' })

assert.equal(kstToday(new Date('2026-10-31T15:30:00Z')), '2026-11-01', 'KST 자정 넘김')
assert.equal(formatDate('2026-10-08'), '10월 8일 (목)')
assert.equal(formatMonth('2026-03'), '2026년 3월')
assert.equal(formatWon(1234567), '1,234,567원')

assert.equal(toCsv([['=1+1', '-2', 'a,b', 'x"y', 3]]), '﻿\'=1+1,\'-2,"a,b","x""y",3\r\n', 'CSV 수식 막기·따옴표')

console.log('✓ 법인카드 규칙 검사 통과')
