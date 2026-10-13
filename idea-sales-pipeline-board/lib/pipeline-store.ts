// 거래 데이터 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import { db, ensureSchema } from './db'
import { STAGES, type Deal, type Stage } from './pipeline'

export type DealRow = {
  id: string
  company: string
  /** 원 단위 정수를 글자로 — bigint 합계가 커져도 정확하게 */
  amount: string
  owner: string
  expected_close: string | null
  stage: Stage
}

export type DealDetail = DealRow & {
  created_by_key: string
  created_by_name: string
  updated_by_name: string
  created_at: Date
  updated_at: Date
}

export type StageSummary = Record<Stage, { count: number; total: string }>

/** 보드에서 한 열에 보여 줄 카드 수. 넘는 카드는 거래 목록에서 봐요 (열 위 건수·합계는 전체 기준). */
export const BOARD_LIMIT = 30
/** 목록 한 쪽의 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean; total: number }

/** 고객사·담당자 검색 조건 (q 가 비면 조건 없음). */
function matchQuery(q: string) {
  if (!q) return db()``
  const like = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
  return db()`AND (company ILIKE ${like} OR owner ILIKE ${like})`
}

/** 보드 — 단계마다 앞쪽 BOARD_LIMIT 장의 카드와, 단계별 전체 건수·금액 합계. */
export async function getBoard(q: string): Promise<{ cards: DealRow[]; summary: StageSummary }> {
  await ensureSchema()
  const match = matchQuery(q)
  // ponytail: 단계별 앞 30장을 window 함수로 골라요 — 거래가 수십만 건이 되면 단계별 쿼리 + 인덱스로 나눠요.
  const [cards, sums] = await Promise.all([
    db()<DealRow[]>`
      SELECT id::text, company, amount::text, owner, expected_close::text, stage
        FROM (SELECT *,
                     -- 진행 중인 열은 예상 계약일이 빠른 순, 계약·실패 열은 최근에 바뀐 순이에요.
                     row_number() OVER (
                       PARTITION BY stage
                       ORDER BY CASE WHEN stage IN ('won', 'lost') THEN -extract(epoch FROM updated_at) END,
                                expected_close NULLS LAST, id
                     ) AS rn
                FROM deals WHERE true ${match}) d
       WHERE rn <= ${BOARD_LIMIT}
       ORDER BY stage, rn`,
    db()<{ stage: Stage; count: number; total: string }[]>`
      SELECT stage, count(*)::int AS count, coalesce(sum(amount), 0)::text AS total
        FROM deals WHERE true ${match}
       GROUP BY stage`,
  ])
  const summary = Object.fromEntries(STAGES.map((s) => [s, { count: 0, total: '0' }])) as StageSummary
  for (const s of sums) summary[s.stage] = { count: s.count, total: s.total }
  return { cards, summary }
}

// ponytail: OFFSET 페이징 — 팀 영업 거래 규모(수천 건)에선 충분해요. 수만 건이 되면 커서로 바꿔요.
export async function listDeals(q: string, stage: Stage | null, page: number): Promise<Page<DealRow>> {
  await ensureSchema()
  const match = matchQuery(q)
  const inStage = stage ? db()`AND stage = ${stage}` : db()``
  const [rows, [{ total }]] = await Promise.all([
    db()<DealRow[]>`
      SELECT id::text, company, amount::text, owner, expected_close::text, stage
        FROM deals
       WHERE true ${match} ${inStage}
       ORDER BY updated_at DESC, deals.id DESC
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    db()<{ total: number }[]>`SELECT count(*)::int AS total FROM deals WHERE true ${match} ${inStage}`,
  ])
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE, total }
}

export async function getDeal(id: string): Promise<DealDetail | null> {
  await ensureSchema()
  const [row] = await db()<DealDetail[]>`
    SELECT id::text, company, amount::text, owner, expected_close::text, stage,
           created_by_key, created_by_name, updated_by_name, created_at, updated_at
      FROM deals WHERE id = ${id}`
  return row ?? null
}

type Who = { userKey: string; name: string }

export async function createDeal(who: Who, d: Deal): Promise<void> {
  await ensureSchema()
  await db()`
    INSERT INTO deals (company, amount, owner, expected_close, stage, created_by_key, created_by_name, updated_by_name)
    VALUES (${d.company}, ${d.amount}, ${d.owner}, ${d.expectedClose}, ${d.stage}, ${who.userKey}, ${who.name}, ${who.name})`
}

export const GONE = '지워졌거나 없는 거래예요. 화면을 새로고침해 주세요.'

export const STALE = '다른 사람이 먼저 바꿨어요. 새로고침한 뒤 다시 해 주세요.'

/**
 * 거래 고치기. 폼을 연 때의 updated_at(seen, ISO)과 같을 때만 바꿔요 — 그 사이 누가 단계를
 * 옮겼다면 폼이 들고 있던 옛 단계로 되돌리지 않고 STALE 을 돌려줘요.
 * 문제가 있으면 사용자에게 보여 줄 문구를, 없으면 null. (JS Date 는 ms 까지라 DB 쪽도 ms 로 잘라 비교)
 */
export async function updateDeal(id: string, seen: string, d: Deal, who: Who): Promise<string | null> {
  await ensureSchema()
  const rows = await db()`
    UPDATE deals
       SET company = ${d.company}, amount = ${d.amount}, owner = ${d.owner}, expected_close = ${d.expectedClose},
           stage = ${d.stage}, updated_by_name = ${who.name}, updated_at = now()
     WHERE id = ${id} AND date_trunc('milliseconds', updated_at) = ${seen}::timestamptz
     RETURNING id`
  if (rows.length) return null
  const [still] = await db()`SELECT 1 FROM deals WHERE id = ${id}`
  return still ? STALE : GONE
}

/**
 * 단계 옮기기. 보드가 본 단계(from)일 때만 바꿔요 — 두 사람이 같은 카드를 동시에 옮기면
 * 뒤에 온 쪽은 바뀌지 않고 안내 문구를 받아요 (화면은 새로 그려져 최신 위치가 보여요).
 */
export async function moveDeal(id: string, from: Stage, to: Stage, who: Who): Promise<string | null> {
  await ensureSchema()
  const rows = await db()`
    UPDATE deals SET stage = ${to}, updated_by_name = ${who.name}, updated_at = now()
     WHERE id = ${id} AND stage = ${from}
     RETURNING id`
  if (rows.length) return null
  const [still] = await db()`SELECT 1 FROM deals WHERE id = ${id}`
  return still ? '다른 사람이 먼저 옮긴 거래예요. 최신 위치로 다시 보여 드려요.' : GONE
}

/** 지우기 — 등록한 사람 또는 관리자만. 조건을 DELETE 에 같이 넣어 화면을 거치지 않은 요청도 막아요. */
export async function deleteDeal(id: string, userKey: string, manager: boolean): Promise<string | null> {
  await ensureSchema()
  const rows = await db()`
    DELETE FROM deals WHERE id = ${id} AND (${manager} OR created_by_key = ${userKey}) RETURNING id`
  if (rows.length) return null
  const [still] = await db()`SELECT 1 FROM deals WHERE id = ${id}`
  return still ? '등록한 사람이나 관리자만 지울 수 있어요.' : GONE
}
