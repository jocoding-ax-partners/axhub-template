// 고장 신고 규칙 검사 — npm run check:logic. lib/facility.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import { formatDateTime, isManager, isStatus, likePattern, sniffImageType, validateReport, validateUpdate } from '../lib/facility.ts'

const report = (location, description) => validateReport({ location, description })
assert.deepEqual(report('  본관 3층 화장실 ', ' 물이 새요 ').value, { location: '본관 3층 화장실', description: '물이 새요' })
assert.equal(report('', '물이 새요').ok, false, '위치 없음')
assert.equal(report('본관', '   ').ok, false, '내용 없음')
assert.equal(report('x'.repeat(101), '물이 새요').ok, false, '위치 길이')
assert.equal(report('본관', 'x'.repeat(1001)).ok, false, '내용 길이')
assert.equal(report(null, null).ok, false, '값이 없음')

const update = (id, status, memo = '', version = '0') => validateUpdate({ id, status, memo, version })
assert.deepEqual(update('12', 'in_progress', ' 업체 호출 ', '3').value, { id: '12', status: 'in_progress', memo: '업체 호출', version: 3 })
assert.equal(update('12', 'closed').ok, false, '없는 상태')
assert.equal(update('12', 'toString').ok, false, '프로토타입 이름은 상태가 아님')
assert.equal(update('1; DROP', 'done').ok, false, '숫자가 아닌 id')
assert.equal(update('12', 'done', '', '').ok, false, 'version 없음')
assert.equal(update('12', 'done', 'x'.repeat(1001)).ok, false, '메모 길이')
assert.equal(isStatus('received') && isStatus('in_progress') && isStatus('done'), true)

const who = (authenticated, is_admin) => ({ authenticated, is_admin, user_id: 'u', email: '', name: '', app_role: '', tenant_slug: '', surface: '' })
assert.equal(isManager(who(true, true)), true)
assert.equal(isManager(who(true, false)), false, '일반 직원')
assert.equal(isManager(who(false, true)), false, '로그인 안 됨')

assert.equal(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
assert.equal(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png')
assert.equal(sniffImageType(new TextEncoder().encode('RIFF....WEBPVP8 ')), 'image/webp')
assert.equal(sniffImageType(new TextEncoder().encode('<svg onload=alert(1)>')), null, 'SVG 거절')
assert.equal(sniffImageType(new TextEncoder().encode('%PDF-1.7')), null, 'PDF 거절')

assert.equal(likePattern('50%_a\\b'), '%50\\%\\_a\\\\b%')
assert.equal(formatDateTime(new Date('2026-12-31T15:30:00Z')), '2027. 1. 1. 오전 12:30', 'KST 표시')

console.log('✓ 고장 신고 규칙 검사 통과')
