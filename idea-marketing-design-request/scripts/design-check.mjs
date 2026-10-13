// 디자인 요청 규칙 검사 — npm run check:logic. lib/design.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import {
  addDays,
  checkFileSizes,
  cleanFileName,
  dueLabel,
  formatBytes,
  formatDate,
  kstToday,
  opensInline,
  sniffFileType,
  statusChangeError,
  validateRequest,
} from '../lib/design.ts'

// 요청 입력
const today = '2026-10-13'
const ok = (over = {}) => validateRequest({ kind: 'banner', size: '1200×628px', copy: '가을 세일 30%', due: '2026-10-20', ...over }, today)
assert.deepEqual(ok().value, { kind: 'banner', size: '1200×628px', copy: '가을 세일 30%', due: '2026-10-20' })
assert.equal(ok({ size: '  1080px  ' }).value.size, '1080px', '앞뒤 공백 정리')
assert.equal(ok({ kind: 'video' }).ok, false, '없는 종류')
assert.equal(ok({ size: ' ' }).ok, false, '크기 없음')
assert.equal(ok({ size: 'x'.repeat(101) }).ok, false, '크기 길이')
assert.equal(ok({ copy: '' }).ok, false, '문구 없음')
assert.equal(ok({ copy: 'x'.repeat(2001) }).ok, false, '문구 길이')
assert.equal(ok({ due: '2026-02-30' }).ok, false, '없는 날짜')
assert.equal(ok({ due: '2026-10-12' }).ok, false, '지난 날짜')
assert.equal(ok({ due: today }).ok, true, '오늘 마감은 돼요')
assert.equal(ok({ due: '2027-10-14' }).ok, false, '1년 넘게 뒤')
assert.equal(ok({ due: addDays(today, 365) }).ok, true, '화면의 최대 날짜(addDays)는 통과')
assert.equal(addDays('2026-12-31', 1), '2027-01-01')

// 진행 단계
assert.equal(statusChangeError('received', 'in_progress', 0), '먼저 이 요청을 맡아 주세요.', '접수는 맡기로만 벗어나요')
assert.equal(statusChangeError('in_progress', 'review', 1), null)
assert.equal(statusChangeError('in_progress', 'done', 2), null)
assert.match(statusChangeError('in_progress', 'review', 0), /결과물/, '결과물 없이 검토 요청 안 돼요')
assert.match(statusChangeError('review', 'done', 0), /결과물/, '결과물 없이 완료 안 돼요')
assert.equal(statusChangeError('review', 'in_progress', 0), null, '되돌리기는 결과물 없어도 돼요')
assert.equal(statusChangeError('done', 'in_progress', 1), null, '다시 작업하기')
assert.ok(statusChangeError('done', 'review', 1), '완료 → 검토 요청은 안 돼요')
assert.ok(statusChangeError('in_progress', 'received', 1), '접수로 되돌리기는 안 돼요')
assert.ok(statusChangeError('in_progress', 'in_progress', 1), '같은 단계')
assert.ok(statusChangeError('in_progress', 'archived', 1), '없는 단계')

// 파일
const bytes = (...xs) => new Uint8Array(xs.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])))
assert.equal(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg')
assert.equal(sniffFileType(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a)), 'image/png')
assert.equal(sniffFileType(bytes('GIF89a')), 'image/gif')
assert.equal(sniffFileType(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 ')), 'image/webp')
assert.equal(sniffFileType(bytes('%PDF-1.7')), 'application/pdf')
assert.equal(sniffFileType(bytes('8BPS', 0, 1)), 'image/vnd.adobe.photoshop')
assert.equal(sniffFileType(bytes('PK', 3, 4)), 'application/zip')
assert.equal(sniffFileType(bytes('<svg onload=alert(1)>')), null, 'SVG · HTML 은 받지 않아요')
assert.equal(sniffFileType(bytes('MZ')), null, '실행 파일')
assert.equal(sniffFileType(bytes()), null, '빈 파일')
assert.equal(opensInline('image/png'), true)
assert.equal(opensInline('application/pdf'), true)
assert.equal(opensInline('image/vnd.adobe.photoshop'), false)
assert.equal(opensInline('application/zip'), false)
assert.equal(cleanFileName('../../etc/passwd'), '....etcpasswd', '경로 글자 제거')
assert.equal(cleanFileName('  \u0000 '), '파일')
assert.equal(cleanFileName('a'.repeat(120) + '.png').length, 100, '끝(확장자) 쪽을 남겨요')
assert.ok(cleanFileName('a'.repeat(120) + '.png').endsWith('.png'))
const MB = 1024 * 1024
assert.equal(checkFileSizes([MB, MB]), null)
assert.match(checkFileSizes([1, 1, 1, 1, 1, 1]), /5개/)
assert.match(checkFileSizes([21 * MB]), /20MB/)
assert.match(checkFileSizes([19 * MB, 19 * MB, 19 * MB]), /50MB/)

// 표시
assert.equal(kstToday(new Date('2026-12-31T15:30:00Z')), '2027-01-01', 'KST 자정 넘김')
assert.equal(formatDate('2026-10-08'), '2026년 10월 8일 (목)')
assert.deepEqual(dueLabel('2026-10-13', today), { text: '오늘 마감', late: false })
assert.deepEqual(dueLabel('2026-10-16', today), { text: 'D-3', late: false })
assert.deepEqual(dueLabel('2026-10-11', today), { text: '2일 지남', late: true })
assert.equal(formatBytes(512), '512B')
assert.equal(formatBytes(1536), '1.5KB')
assert.equal(formatBytes(2.5 * MB), '2.5MB')

console.log('✓ 디자인 요청 규칙 검사 통과')
