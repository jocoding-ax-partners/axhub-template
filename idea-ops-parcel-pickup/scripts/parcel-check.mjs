// 택배 규칙 검사 — npm run check:logic. lib/parcel.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import { daysWaiting, isDesk, kstDate, normalizeEmail, recipientLabel, validateParcel, waitingLabel } from '../lib/parcel.ts'

const base = { kind: 'parcel', recipientEmail: ' Hong@Company.com ', recipientName: ' 홍길동 ', sender: '쿠팡', location: '선반 A-3', memo: '' }
const check = (over) => validateParcel({ ...base, ...over })

assert.deepEqual(check({}).value, {
  kind: 'parcel',
  recipientEmail: 'hong@company.com',
  recipientName: '홍길동',
  sender: '쿠팡',
  location: '선반 A-3',
  memo: '',
})
assert.equal(check({ kind: 'mail', recipientName: '' }).ok, true, '우편 · 이름 없이')
assert.equal(check({ kind: 'box' }).ok, false, '없는 종류')
assert.equal(check({ recipientEmail: '' }).ok, false, '이메일 없음')
assert.equal(check({ recipientEmail: 'hong' }).ok, false, '이메일 형식')
assert.equal(check({ recipientEmail: 'hong@company' }).ok, false, '도메인 점 없음')
assert.equal(check({ sender: '   ' }).ok, false, '보낸 곳 없음')
assert.equal(check({ location: '' }).ok, false, '보관 위치 없음')
assert.equal(check({ location: 'x'.repeat(51) }).ok, false, '보관 위치 길이')
assert.equal(check({ memo: 'x'.repeat(101) }).ok, false, '메모 길이')

assert.equal(normalizeEmail('  A@B.CO '), 'a@b.co')

const person = { authenticated: true, user_id: 'u1', email: 'a@b.co', name: '', app_role: '', is_admin: false, tenant_slug: '', surface: '' }
assert.equal(isDesk(person), false)
assert.equal(isDesk({ ...person, is_admin: true }), true)
assert.equal(isDesk({ ...person, is_admin: true, authenticated: false }), false)

// 한국 날짜 기준 — UTC 15:00 은 이미 다음 날이에요.
assert.equal(kstDate(new Date('2026-10-12T15:00:00Z')), '2026-10-13')
assert.equal(daysWaiting(new Date('2026-10-12T15:30:00Z'), new Date('2026-10-13T14:59:00Z')), 0, '같은 KST 날')
assert.equal(daysWaiting(new Date('2026-10-12T14:30:00Z'), new Date('2026-10-12T15:30:00Z')), 1, 'KST 자정을 넘김')
assert.equal(daysWaiting(new Date('2026-10-09T01:00:00Z'), new Date('2026-10-13T01:00:00Z')), 4)
assert.equal(daysWaiting(new Date('2026-10-14T01:00:00Z'), new Date('2026-10-13T01:00:00Z')), 0, '미래 시각은 0')
assert.equal(waitingLabel(0), '오늘 도착')
assert.equal(waitingLabel(1), '어제 도착')
assert.equal(waitingLabel(4), '4일째 보관 중')
assert.equal(recipientLabel('', 'a@b.co'), 'a@b.co')
assert.equal(recipientLabel('홍길동', 'a@b.co'), '홍길동 (a@b.co)')

console.log('✓ 택배 규칙 검사 통과')
