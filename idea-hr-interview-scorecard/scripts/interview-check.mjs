// 면접 평가 규칙 검사 — npm run check:logic. lib/interview.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import { formatScore, isRecruiter, overall, parseKstLocal, toKstLocal, validateCandidate, validateScore } from '../lib/interview.ts'

// 면접 일시는 KST 로 고른 값 — 저장되는 시각은 UTC 로 9시간 앞이에요.
assert.equal(parseKstLocal('2026-10-20T14:00').toISOString(), '2026-10-20T05:00:00.000Z')
assert.equal(parseKstLocal('2026-10-21T08:30').toISOString(), '2026-10-20T23:30:00.000Z', 'KST 아침 = UTC 전날')
assert.equal(parseKstLocal('2026-02-30T10:00'), null, '없는 날짜')
assert.equal(parseKstLocal('2026-10-20T24:00'), null, '없는 시각')
assert.equal(parseKstLocal('2026-10-20'), null, '시각 없음')
assert.equal(toKstLocal(new Date('2026-10-20T23:30:00Z')), '2026-10-21T08:30')

const cand = (over = {}) =>
  validateCandidate({ name: '김지원', position: '백엔드 개발자', interviewAt: '2026-10-20T14:00', interviewers: 'Kim@Co.com, lee@co.com', ...over })
assert.deepEqual(cand().value.interviewers, ['kim@co.com', 'lee@co.com'], '소문자로')
assert.deepEqual(cand({ interviewers: 'a@co.com;\nA@co.com  b@co.com,' }).value.interviewers, ['a@co.com', 'b@co.com'], '중복·구분자')
assert.equal(cand({ name: '  ' }).ok, false, '이름 없음')
assert.equal(cand({ position: 'x'.repeat(51) }).ok, false, '직무 길이')
assert.equal(cand({ interviewAt: '' }).ok, false, '일시 없음')
assert.equal(cand({ interviewers: ' , ' }).ok, false, '면접관 없음')
assert.equal(cand({ interviewers: 'kim@co.com, 이씨' }).ok, false, '이메일 아님')
assert.equal(cand({ interviewers: Array.from({ length: 11 }, (_, i) => `u${i}@co.com`).join(',') }).ok, false, '면접관 10명 상한')

const score = (over = {}) => validateScore({ job_skill: '4', communication: '5', culture_fit: '3', comment: ' 좋아요 ', ...over })
assert.deepEqual(score().value, { job_skill: 4, communication: 5, culture_fit: 3, comment: '좋아요' })
assert.equal(score({ job_skill: '' }).ok, false, '점수 안 고름')
assert.equal(score({ communication: '0' }).ok, false, '1점 미만')
assert.equal(score({ culture_fit: '6' }).ok, false, '5점 초과')
assert.equal(score({ job_skill: '3.5' }).ok, false, '정수만')
assert.equal(score({ comment: '   ' }).ok, false, '의견 없음')
assert.equal(score({ comment: 'x'.repeat(1001) }).ok, false, '의견 길이')

assert.equal(overall({ job_skill: 4, communication: 5, culture_fit: 3 }), 4)
assert.equal(formatScore(11 / 3), '3.7')
assert.equal(formatScore(4), '4.0')
assert.equal(formatScore(null), '—')

const visitor = { authenticated: true, is_admin: false }
assert.equal(isRecruiter({ ...visitor, is_admin: true }), true)
assert.equal(isRecruiter(visitor), false, '면접관은 채용 담당자가 아님')
assert.equal(isRecruiter({ authenticated: false, is_admin: true }), false)

console.log('✓ 면접 평가 규칙 검사 통과')
