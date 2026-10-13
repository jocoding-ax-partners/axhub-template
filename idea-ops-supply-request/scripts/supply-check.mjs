// 비품 규칙 검사 — npm run check:logic. lib/supply.ts 를 바꾸면 돌려 보세요.
import assert from 'node:assert/strict'
import { exceedsStockMax, formatCount, isId, isShort, likePattern, parseCount, validateRequest, validateSupply } from '../lib/supply.ts'

assert.equal(isShort(4, 5), true, '최소 재고 아래면 부족')
assert.equal(isShort(5, 5), false, '최소 재고와 같으면 아직 괜찮음')
assert.equal(isShort(0, 0), false, '최소 재고 0 이면 늘 괜찮음')

assert.equal(parseCount('12', 0, 100), 12)
assert.equal(parseCount(' 0 ', 0, 100), 0)
assert.equal(parseCount('0', 1, 100), null, '하한')
assert.equal(parseCount('101', 0, 100), null, '상한')
for (const bad of ['', '-1', '1.5', '1e3', 'abc', '0x10']) assert.equal(parseCount(bad, 0, 100), null, bad)

const sup = (name, stock, minStock) => validateSupply({ name, stock, minStock })
assert.deepEqual(sup('  A4   복사용지 ', '20', '5').value, { name: 'A4 복사용지', stock: 20, minStock: 5 })
assert.equal(sup('  ', '1', '1').ok, false, '이름 없음')
assert.equal(sup('x'.repeat(51), '1', '1').ok, false, '이름 길이')
assert.equal(sup('펜', '-1', '1').ok, false, '음수 재고')
assert.equal(sup('펜', '1', '').ok, false, '최소 재고 없음')
assert.equal(validateSupply({ name: '펜', stock: '', minStock: '3' }, false).ok, true, '고칠 땐 재고를 안 봐요')

const req = (qty, note = '') => validateRequest({ qty, note })
assert.deepEqual(req('3', ' 회의실용 ').value, { qty: 3, note: '회의실용' })
assert.equal(req('0').ok, false, '0개')
assert.equal(req('1001').ok, false, '한 번에 1000개까지')
assert.equal(req('2', 'x'.repeat(201)).ok, false, '메모 길이')

assert.equal(exceedsStockMax(999_999, 1), false)
assert.equal(exceedsStockMax(999_999, 2), true)

assert.equal(isId('42'), true)
assert.equal(isId('0'), false)
assert.equal(isId('1; DROP'), false)
assert.equal(likePattern('50%_a\\b'), '%50\\%\\_a\\\\b%')
assert.equal(formatCount(1234), '1,234')

console.log('✓ 비품 규칙 검사 통과')
