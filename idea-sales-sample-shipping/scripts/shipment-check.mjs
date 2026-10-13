// 발송 기록 규칙 검사 — npm run check:logic. lib/shipment.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import { canManage, daysBetween, followUpLabel, followUpState, formatDate, kstToday, normalizeName, validateShipment } from '../lib/shipment.ts'

const today = '2026-10-13'
const input = (over = {}) => ({
  customer: '  한빛상사  ',
  contact: '김민지  과장',
  items: '신제품 샘플 3종',
  sentOn: '2026-10-08',
  followUpOn: '2026-10-15',
  memo: '',
  ...over,
})
const check = (over) => validateShipment(input(over), today)

assert.deepEqual(check().value, {
  customer: '한빛상사',
  contact: '김민지 과장',
  items: '신제품 샘플 3종',
  sentOn: '2026-10-08',
  followUpOn: '2026-10-15',
  memo: '',
})
assert.equal(check({ followUpOn: '' }).value.followUpOn, null, '후속 연락 예정일은 선택')
assert.equal(check({ followUpOn: '2026-10-08' }).ok, true, '보낸 날 당일 연락 가능')
assert.equal(check({ sentOn: today }).ok, true, '오늘 보낸 건')
assert.equal(check({ sentOn: '2026-09-20', followUpOn: '2026-10-01' }).ok, true, '지난 예정일도 기록 가능 (밀린 연락)')
assert.equal(check({ customer: '   ' }).ok, false, '고객사 없음')
assert.equal(check({ customer: 'x'.repeat(101) }).ok, false, '고객사 길이')
assert.equal(check({ items: '' }).ok, false, '보낸 것 없음')
assert.equal(check({ sentOn: '' }).ok, false, '보낸 날 없음')
assert.equal(check({ sentOn: '2026-02-30' }).ok, false, '없는 날짜')
assert.equal(check({ sentOn: '2026-10-14', followUpOn: '' }).ok, false, '내일 보낸 건 없음')
assert.equal(check({ sentOn: '1999-12-31', followUpOn: '' }).ok, false, '너무 옛날')
assert.equal(check({ followUpOn: '2026-10-07' }).ok, false, '예정일이 보낸 날보다 앞섬')
assert.equal(check({ followUpOn: '2027-10-13' }).ok, true, '1년 뒤까지')
assert.equal(check({ followUpOn: '2027-10-14' }).ok, false, '1년 넘게 뒤 (연도 오타)')
assert.equal(check({ memo: 'x'.repeat(1001) }).ok, false, '메모 길이')

assert.equal(normalizeName(' 한빛\t 상사 '), '한빛 상사')

assert.equal(followUpState(null, false, today), 'none')
assert.equal(followUpState('2026-10-10', true, today), 'done', '완료가 지남보다 먼저')
assert.equal(followUpState('2026-10-12', false, today), 'overdue')
assert.equal(followUpState(today, false, today), 'today')
assert.equal(followUpState('2026-10-14', false, today), 'upcoming')
assert.equal(followUpLabel('2026-10-10', false, today), '연락 3일 지남')
assert.equal(followUpLabel('2026-10-20', false, today), '10월 20일 (화) 연락 예정')
assert.equal(followUpLabel(null, false, today), '')
assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3, '해 넘김')

const visitor = (over) => ({ authenticated: true, user_id: 'u1', email: '', name: '', app_role: '', is_admin: false, tenant_slug: '', surface: '', ...over })
assert.equal(canManage(visitor(), 'u1'), true, '기록한 사람')
assert.equal(canManage(visitor(), 'u2'), false, '다른 팀원')
assert.equal(canManage(visitor({ is_admin: true }), 'u2'), true, '관리자')
assert.equal(canManage(visitor({ authenticated: false, user_id: '' }), ''), false, '로그인 안 함')

assert.equal(kstToday(new Date('2026-12-31T15:30:00Z')), '2027-01-01', 'KST 자정 넘김')
assert.equal(formatDate('2026-10-08'), '2026년 10월 8일 (목)')

console.log('✓ 발송 기록 규칙 검사 통과')
