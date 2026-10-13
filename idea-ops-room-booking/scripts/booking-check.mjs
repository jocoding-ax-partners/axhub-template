// 예약 시간 규칙 자체 점검: npm run check:logic (Node 22 이상)
// 겹침 자체는 DB 제약(lib/db.ts 의 bookings_no_overlap)이 막아요 — 여기선 입력 검증 규칙만 봐요.
import assert from 'node:assert/strict'
import { addDays, fmt, fmtDay, isDay, isPast, nowMinKst, toMin, todayKst, validRange } from '../lib/booking.ts'

assert.equal(toMin('09:30'), 570)
assert.equal(fmt(570), '09:30')
assert.ok(Number.isNaN(toMin('9:30')))
assert.ok(Number.isNaN(toMin('09:75')))

assert.ok(isDay('2026-10-12'))
assert.ok(!isDay('2026-02-31')) // 없는 날짜
assert.ok(!isDay('2026-1-5'))
assert.equal(addDays('2026-12-31', 1), '2027-01-01')
assert.equal(addDays('2026-03-01', -1), '2026-02-28')
assert.equal(fmtDay('2026-10-12'), '2026년 10월 12일 (월)')

assert.ok(validRange(540, 570))
assert.ok(!validRange(570, 540)) // 시작 > 종료
assert.ok(!validRange(570, 570)) // 0분
assert.ok(!validRange(545, 600)) // 30분 단위 아님
assert.ok(!validRange(420, 480)) // 08:00 이전
assert.ok(!validRange(1170, 1230)) // 20:00 넘김

// 2026-10-12 00:30 UTC = 2026-10-12 09:30 KST
const now = Date.UTC(2026, 9, 12, 0, 30)
assert.equal(todayKst(now), '2026-10-12')
assert.equal(nowMinKst(now), 570)
// 2026-10-11 15:30 UTC = 2026-10-12 00:30 KST (UTC 로는 아직 전날)
assert.equal(todayKst(Date.UTC(2026, 9, 11, 15, 30)), '2026-10-12')
assert.ok(isPast('2026-10-11', 600, now))
assert.ok(isPast('2026-10-12', 540, now))
assert.ok(!isPast('2026-10-12', 600, now))
assert.ok(!isPast('2026-10-13', 480, now))

console.log('예약 규칙 점검 통과')
