// 장비 대여 규칙 검사 — npm run check:logic. lib/rental.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import {
  addDays,
  canReturn,
  dueHint,
  filterOf,
  formatDate,
  isAdmin,
  isOverdue,
  kstToday,
  validateDue,
  validateEquipment,
} from '../lib/rental.ts'

const today = '2026-10-12'
assert.equal(validateDue('2026-10-12', today).ok, true, '오늘 반납')
assert.equal(validateDue('2026-10-11', today).ok, false, '어제')
assert.equal(validateDue(addDays(today, 90), today).ok, true, '90일 뒤')
assert.equal(validateDue(addDays(today, 91), today).ok, false, '91일 뒤')
assert.equal(validateDue('2026-02-30', '2026-01-01').ok, false, '없는 날짜')
assert.equal(validateDue('', today).ok, false, '빈 값')

assert.equal(isOverdue('2026-10-11', today), true)
assert.equal(isOverdue('2026-10-12', today), false, '예정일 당일은 지연 아님')
assert.equal(dueHint('2026-10-12', today), '오늘까지')
assert.equal(dueHint('2026-10-15', today), '3일 남음')
assert.equal(dueHint('2026-10-10', today), '2일 지남')
assert.equal(addDays('2026-12-31', 1), '2027-01-01')

const eq = (name, kind, assetNo) => validateEquipment({ name, kind, assetNo })
assert.deepEqual(eq('  맥북 ', ' 노트북 ', ' NB-1 ').value, { name: '맥북', kind: '노트북', assetNo: 'NB-1' })
assert.equal(eq('', '노트북', 'NB-1').ok, false, '이름 없음')
assert.equal(eq('맥북', ' ', 'NB-1').ok, false, '종류 없음')
assert.equal(eq('맥북', '노트북', '').ok, false, '자산 번호 없음')
assert.equal(eq('x'.repeat(101), '노트북', 'NB-1').ok, false, '이름 길이')

const user = { authenticated: true, user_id: 'u1', is_admin: false }
const admin = { authenticated: true, user_id: 'a1', is_admin: true }
const anon = { authenticated: false, user_id: '', is_admin: false }
assert.equal(canReturn(user, 'u1'), true, '본인 반납')
assert.equal(canReturn(user, 'u2'), false, '남의 장비')
assert.equal(canReturn(admin, 'u2'), true, '관리자 대신 반납')
assert.equal(canReturn(anon, ''), false, '익명')
assert.equal(isAdmin(admin), true)
assert.equal(isAdmin({ ...anon, is_admin: true }), false, '로그인 안 했으면 관리자 아님')

assert.equal(filterOf('overdue'), 'overdue')
assert.equal(filterOf('toString'), 'all', '프로토타입 이름')
assert.equal(filterOf(undefined), 'all')

assert.equal(kstToday(new Date('2026-12-31T15:30:00Z')), '2027-01-01', 'KST 자정 넘김')
assert.equal(formatDate('2026-10-08'), '2026년 10월 8일 (목)')

console.log('✓ 장비 대여 규칙 검사 통과')
