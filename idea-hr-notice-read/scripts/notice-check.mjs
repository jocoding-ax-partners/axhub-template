// 공지 규칙 검사 — npm run check:logic. lib/notice.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import { formatDateTime, isManager, isNoticeId, readRate, validateNotice } from '../lib/notice.ts'

assert.equal(readRate(0, 0), 0, '명단이 비면 0%')
assert.equal(readRate(1, 3), 33, '소수점 버림')
assert.equal(readRate(2, 3), 66)
assert.equal(readRate(299, 300), 99, '한 명이라도 남으면 100% 가 아님')
assert.equal(readRate(3, 3), 100)
assert.equal(readRate(5, 3), 100, '100% 를 넘지 않음')

const ok = validateNotice({ title: '  보안 점검  ', body: '\n첫 줄\n  둘째 줄\n\n', important: 'on' })
assert.deepEqual(ok, { ok: true, value: { title: '보안 점검', body: '첫 줄\n  둘째 줄', important: true } })
assert.equal(validateNotice({ title: 'a', body: 'b', important: '' }).value.important, false)
assert.deepEqual(validateNotice({ title: ' ', body: ' \n ', important: '' }).errors, { title: '제목을 적어 주세요.', body: '본문을 적어 주세요.' })
assert.equal(validateNotice({ title: 'x'.repeat(101), body: 'b', important: '' }).ok, false, '제목 길이')
assert.equal(validateNotice({ title: 'a', body: 'x'.repeat(10_001), important: '' }).ok, false, '본문 길이')

assert.equal(isNoticeId('12'), true)
for (const bad of ['0', '012', '-1', '1.5', 'abc', '', '1'.repeat(19)]) assert.equal(isNoticeId(bad), false, bad)

const who = { authenticated: true, is_admin: true }
assert.equal(isManager(who), true)
assert.equal(isManager({ ...who, is_admin: false }), false)
assert.equal(isManager({ ...who, authenticated: false }), false)

assert.match(formatDateTime(new Date('2026-10-12T15:30:00Z')), /2026\. 10\. 13\./, 'KST 로 날짜가 넘어감')

console.log('✓ 공지 규칙 검사 통과')
