// 설문 규칙 검사 — npm run check:logic. lib/survey.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import { formatDateTime, percent, validateAnswers, validateSurvey } from '../lib/survey.ts'

const survey = (questions, title = '고객 만족도') => validateSurvey({ title, description: '', questions })
const choice = (prompt = '만족하셨나요?', options = ['예', '아니요']) => ({ kind: 'choice', prompt, options })

assert.deepEqual(survey([choice('  만족?  ', [' 예 ', '', '아니요']), { kind: 'text', prompt: '의견', options: ['무시'] }]).value, {
  title: '고객 만족도',
  description: '',
  questions: [
    { kind: 'choice', prompt: '만족?', options: ['예', '아니요'] },
    { kind: 'text', prompt: '의견', options: [] },
  ],
})
assert.equal(survey([choice()], '  ').ok, false, '제목 없음')
assert.equal(survey([]).ok, false, '문항 없음')
assert.equal(survey('[]').ok, false, '배열 아님')
assert.equal(survey([{ kind: 'radio', prompt: 'x' }]).ok, false, '없는 종류')
assert.equal(survey([choice('  ')]).ok, false, '질문 없음')
assert.equal(survey([choice('x', ['하나'])]).ok, false, '보기 1개')
assert.equal(survey([choice('x', ['a', 'a'])]).ok, false, '같은 보기')
assert.equal(survey([choice('x', Array.from({ length: 11 }, (_, i) => `${i}`))]).ok, false, '보기 11개')
assert.equal(survey(Array.from({ length: 31 }, () => choice())).ok, false, '문항 31개')
assert.equal(survey([null]).ok, false, '이상한 문항')

const qs = [
  { id: '1', kind: 'choice', options: ['예', '아니요'] },
  { id: '2', kind: 'text', options: [] },
]
const answers = (values) => validateAnswers(qs, (id) => values[id] ?? '')
assert.deepEqual(answers({ 1: '1', 2: ' 좋아요 ' }).value, [
  { questionId: '1', choice: 1, text: null },
  { questionId: '2', choice: null, text: '좋아요' },
])
assert.deepEqual(answers({ 1: '0' }).value, [{ questionId: '1', choice: 0, text: null }], '주관식은 비워도 돼요')
assert.equal(answers({ 2: '의견' }).ok, false, '객관식 빠짐')
assert.equal(answers({ 1: '2' }).ok, false, '없는 보기 번호')
assert.equal(answers({ 1: '-1' }).ok, false, '음수 번호')
assert.equal(answers({ 1: '0', 2: 'x'.repeat(1001) }).ok, false, '답 길이')
assert.equal(validateAnswers([{ id: '9', kind: 'text', options: [] }], () => '  ').ok, false, '전부 빈 답')

assert.equal(percent(1, 3), 33.3)
assert.equal(percent(2, 3), 66.7)
assert.equal(percent(0, 0), 0, '답한 사람 없음')
assert.equal(percent(5, 5), 100)

assert.match(formatDateTime(new Date('2026-12-31T15:30:00Z')), /2027\. 1\. 1\./, 'KST 자정 넘김')

console.log('✓ 설문 규칙 검사 통과')
