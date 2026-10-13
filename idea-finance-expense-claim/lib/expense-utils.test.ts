// 실행: npm run check:logic
import assert from 'node:assert/strict'
import {
  currentMonthKst,
  dayLabel,
  monthRange,
  parseExpenseInput,
  shiftMonth,
  sniffImageType,
  toCsv,
  todayKst,
} from './expense-utils.ts'

// 월 범위 · 이동
assert.deepEqual(monthRange('2026-10'), ['2026-10-01', '2026-11-01'])
assert.deepEqual(monthRange('2026-12'), ['2026-12-01', '2027-01-01'])
assert.equal(monthRange('2026-13'), null)
assert.equal(monthRange("2026-10' OR 1=1"), null)
assert.equal(shiftMonth('2026-01', -1), '2025-12')
assert.equal(shiftMonth('2026-12', 1), '2027-01')

// 한국 시간
assert.equal(currentMonthKst(new Date('2026-10-31T15:30:00Z')), '2026-11') // KST 11/1 00:30
assert.equal(todayKst(new Date('2026-10-04T15:00:00Z')), '2026-10-05')
assert.equal(dayLabel('2026-10-05'), '10월 5일 (월)')

// 입력 검사
const ok = { spent_on: '2026-10-05', category: '식대', amount: '12,000', memo: ' 점심 ' }
assert.deepEqual(parseExpenseInput(ok, '2026-10-05'), {
  ok: true,
  value: { spentOn: '2026-10-05', category: '식대', amount: 12000, memo: '점심' },
})
const err = (patch: Partial<typeof ok>) => {
  const r = parseExpenseInput({ ...ok, ...patch }, '2026-10-05')
  return r.ok ? null : r.error
}
assert.match(err({ spent_on: '2026-02-31' })!, /사용일/)
assert.match(err({ spent_on: '2026-10-06' })!, /지난 날짜/)
assert.match(err({ category: '술' })!, /항목/)
assert.match(err({ amount: '0' })!, /금액/)
assert.match(err({ amount: '1.5' })!, /금액/)
assert.match(err({ amount: '-100' })!, /금액/)
assert.match(err({ amount: '100000001' })!, /금액/)
assert.match(err({ memo: 'a'.repeat(201) })!, /메모/)

// 사진 형식 판별
assert.equal(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
assert.equal(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png')
assert.equal(sniffImageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp')
assert.equal(sniffImageType(new TextEncoder().encode('<html><script>')), null)

// CSV — BOM · 이스케이프 · 수식 막기
assert.equal(toCsv([['이름', 1000], ['a,"b"', '=SUM(A1)']]), '﻿이름,1000\r\n"a,""b""",\'=SUM(A1)\r\n')

console.log('✓ 경비 로직 검사 통과')
