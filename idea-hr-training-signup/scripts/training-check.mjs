// 교육 신청 규칙 검사 — npm run check:logic. lib/training.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import { formatWhen, parseKstInput, signupState, toCsv, toKstInput, validateTraining } from '../lib/training.ts'

// 일시 입력은 한국 시간이에요 — 서버(UTC)에선 9시간 앞이에요.
assert.equal(parseKstInput('2026-11-03T14:00').toISOString(), '2026-11-03T05:00:00.000Z')
assert.equal(parseKstInput('2026-11-01T08:30').toISOString(), '2026-10-31T23:30:00.000Z', '자정 넘김')
assert.equal(parseKstInput('2026-02-30T10:00'), null, '없는 날짜')
assert.equal(parseKstInput('2026-11-03 14:00'), null, '형식')
assert.equal(toKstInput(new Date('2026-10-31T23:30:00Z')), '2026-11-01T08:30')
assert.equal(formatWhen(new Date('2026-11-03T05:00:00Z')), '2026년 11월 3일 (화) 오후 2:00')
assert.equal(formatWhen(new Date('2026-11-02T15:05:00Z')), '2026년 11월 3일 (화) 오전 12:05')

const now = new Date('2026-10-13T00:00:00Z')
const base = { title: '보안 교육', description: '', starts_at: '2026-11-03T14:00', location: '대회의실', capacity: '30' }
const check = (patch, isNew = true) => validateTraining({ ...base, ...patch }, { isNew, now })
assert.deepEqual(check({}).value, { title: '보안 교육', description: '', startsAt: new Date('2026-11-03T05:00:00Z'), location: '대회의실', capacity: 30 })
assert.equal(check({ title: '  ' }).errors.title, '제목을 적어 주세요.')
assert.ok(check({ title: 'x'.repeat(101) }).errors.title)
assert.ok(check({ location: '' }).errors.location)
assert.ok(check({ capacity: '0' }).errors.capacity, '정원 0')
assert.ok(check({ capacity: '2.5' }).errors.capacity, '정원 소수')
assert.ok(check({ capacity: '1001' }).errors.capacity, '정원 상한')
assert.ok(check({ starts_at: '' }).errors.starts_at)
assert.ok(check({ starts_at: '2026-10-01T10:00' }).errors.starts_at, '새 교육은 지난 일시 안 됨')
assert.equal(check({ starts_at: '2026-10-01T10:00' }, false).ok, true, '수정은 지난 교육도 됨')

// 신청 버튼 상태: 시작 > 신청함 > 마감 > 신청 가능
const t = (p) => ({ starts_at: new Date('2026-11-03T05:00:00Z'), capacity: 2, signed: 0, mine: false, ...p })
assert.equal(signupState(t({}), now), 'open')
assert.equal(signupState(t({ signed: 2 }), now), 'full')
assert.equal(signupState(t({ signed: 2, mine: true }), now), 'mine', '정원이 차도 내 신청은 취소할 수 있어요')
assert.equal(signupState(t({ mine: true }), new Date('2026-11-03T05:00:00Z')), 'started', '시작 시각부터 닫혀요')

// CSV: BOM + 수식 막기 + 따옴표
assert.equal(toCsv([['이름', '=1+1', '-3', '@x', '+y', 'a,"b"']]), '﻿이름,\'=1+1,\'-3,\'@x,\'+y,"a,""b"""\r\n')
assert.equal(toCsv([[1, 'ok']]), '﻿1,ok\r\n', '숫자는 그대로')

console.log('✓ 교육 신청 규칙 검사 통과')
