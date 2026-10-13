// 캠페인 데이터 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import type { AxhubMe } from './axhub-server'
import { db, ensureSchema } from './db'
import { canEdit, validateDaily, type CampaignSort, type CampaignValue, type DailyInput } from './campaign'

/** 합계 — 비교 표 한 줄, 상세 화면 위쪽 숫자, 전체 요약이 모두 이 모양이에요. */
export type Totals = { cost: number; impressions: number; clicks: number; conversions: number }

export type CampaignRow = Totals & {
  id: string
  name: string
  channel: string
  start_date: string
  end_date: string
  owner_key: string
  owner_name: string
  days: number
}

export type DailyRow = { day: string; impressions: number; clicks: number; conversions: number }

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean }

const NOT_FOUND = '없는 캠페인이에요. 화면을 새로고침해 주세요.'
const NO_PERMISSION = '이 캠페인을 등록한 사람이나 관리자만 고칠 수 있어요.'

/** 이름·채널에 q 가 들어간 캠페인만. q 가 비면 전부. */
function matchOf(q: string) {
  const like = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
  return q ? db()`WHERE (c.name ILIKE ${like} OR c.channel ILIKE ${like})` : db()``
}

/** 정렬 — 정해진 세 가지 중에서만 골라요 (주소의 값을 SQL 에 그대로 넣지 않아요). */
function orderOf(sort: CampaignSort) {
  if (sort === 'cpa') return db()`ORDER BY cost / nullif(conversions, 0) ASC NULLS LAST, t.id DESC`
  if (sort === 'ctr') return db()`ORDER BY clicks / nullif(impressions, 0) DESC NULLS LAST, t.id DESC`
  return db()`ORDER BY start_date DESC, t.id DESC`
}

// ponytail: OFFSET 페이징 — 팀 캠페인 수(수백~수천)에선 충분해요. 수만 개가 되면 커서로 바꿔요.
/** 캠페인 비교 표 — 캠페인마다 날짜별 기록을 더한 합계. 정렬·검색·쪽 나눔은 DB 에서 해요. */
export async function listCampaigns(q: string, sort: CampaignSort, page: number): Promise<Page<CampaignRow>> {
  await ensureSchema()
  const rows = await db()<CampaignRow[]>`
    WITH t AS (
      SELECT c.id, c.name, c.channel, c.start_date, c.end_date, c.owner_key, c.owner_name,
             c.cost::float8 AS cost,
             coalesce(sum(d.impressions), 0)::float8 AS impressions,
             coalesce(sum(d.clicks), 0)::float8 AS clicks,
             coalesce(sum(d.conversions), 0)::float8 AS conversions,
             count(d.day)::int AS days
        FROM campaigns c
        LEFT JOIN campaign_daily d ON d.campaign_id = c.id
        ${matchOf(q)}
       GROUP BY c.id
    )
    SELECT id::text, name, channel, start_date::text, end_date::text, owner_key, owner_name,
           cost, impressions, clicks, conversions, days
      FROM t
      ${orderOf(sort)}
     LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE }
}

/** 검색 조건에 맞는 캠페인 전체의 합계 (쪽과 상관없이). */
export async function summarize(q: string): Promise<Totals & { count: number }> {
  await ensureSchema()
  const [row] = await db()<(Totals & { count: number })[]>`
    SELECT count(*)::int AS count,
           coalesce(sum(c.cost), 0)::float8 AS cost,
           coalesce(sum(d.impressions), 0)::float8 AS impressions,
           coalesce(sum(d.clicks), 0)::float8 AS clicks,
           coalesce(sum(d.conversions), 0)::float8 AS conversions
      FROM campaigns c
      LEFT JOIN (
        SELECT campaign_id, sum(impressions) AS impressions, sum(clicks) AS clicks, sum(conversions) AS conversions
          FROM campaign_daily GROUP BY campaign_id
      ) d ON d.campaign_id = c.id
      ${matchOf(q)}`
  return row
}

export async function getCampaign(id: string): Promise<CampaignRow | null> {
  if (!/^\d{1,18}$/.test(id)) return null
  await ensureSchema()
  const [row] = await db()<CampaignRow[]>`
    SELECT c.id::text, c.name, c.channel, c.start_date::text, c.end_date::text, c.owner_key, c.owner_name,
           c.cost::float8 AS cost,
           coalesce(sum(d.impressions), 0)::float8 AS impressions,
           coalesce(sum(d.clicks), 0)::float8 AS clicks,
           coalesce(sum(d.conversions), 0)::float8 AS conversions,
           count(d.day)::int AS days
      FROM campaigns c
      LEFT JOIN campaign_daily d ON d.campaign_id = c.id
     WHERE c.id = ${id}
     GROUP BY c.id`
  return row ?? null
}

/** 한 캠페인의 날짜별 기록 전부 (날짜 순). 기간이 최대 366일이라 줄 수도 그만큼이 끝이에요. */
export async function listDaily(id: string): Promise<DailyRow[]> {
  await ensureSchema()
  return db()<DailyRow[]>`
    SELECT day::text, impressions::float8 AS impressions, clicks::float8 AS clicks, conversions::float8 AS conversions
      FROM campaign_daily
     WHERE campaign_id = ${id}
     ORDER BY day`
}

type Owner = { userKey: string; name: string }

export async function createCampaign(owner: Owner, v: CampaignValue): Promise<string> {
  await ensureSchema()
  const [row] = await db()<{ id: string }[]>`
    INSERT INTO campaigns (name, channel, start_date, end_date, cost, owner_key, owner_name)
    VALUES (${v.name}, ${v.channel}, ${v.start}, ${v.end}, ${v.cost}, ${owner.userKey}, ${owner.name})
    RETURNING id::text`
  return row.id
}

/** 캠페인 정보 수정. 줄인 기간 밖에 날짜별 기록이 남아 있으면 바꾸지 않아요. 문제가 있으면 문구를, 없으면 null. */
export async function updateCampaign(id: string, v: CampaignValue, visitor: AxhubMe): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (sql) => {
    // FOR UPDATE — 같은 캠페인에 날짜별 기록이 동시에 저장돼도 기간 확인이 엇갈리지 않게 줄을 세워요.
    const [found] = await sql<{ owner_key: string }[]>`SELECT owner_key FROM campaigns WHERE id = ${id} FOR UPDATE`
    if (!found) return NOT_FOUND
    if (!canEdit(visitor, found.owner_key)) return NO_PERMISSION
    const [{ outside }] = await sql<{ outside: number }[]>`
      SELECT count(*)::int AS outside FROM campaign_daily
       WHERE campaign_id = ${id} AND (day < ${v.start} OR day > ${v.end})`
    if (outside > 0) return `바꾼 기간 밖에 날짜별 기록이 ${outside}건 있어요. 그 기록을 먼저 지우거나 기간을 넓혀 주세요.`
    await sql`
      UPDATE campaigns
         SET name = ${v.name}, channel = ${v.channel}, start_date = ${v.start}, end_date = ${v.end},
             cost = ${v.cost}, updated_at = now()
       WHERE id = ${id}`
    return null
  })
}

/** 캠페인 삭제 — 날짜별 기록도 같이 지워져요. */
export async function deleteCampaign(id: string, visitor: AxhubMe): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (sql) => {
    const [found] = await sql<{ owner_key: string }[]>`SELECT owner_key FROM campaigns WHERE id = ${id} FOR UPDATE`
    if (!found) return NOT_FOUND
    if (!canEdit(visitor, found.owner_key)) return NO_PERMISSION
    await sql`DELETE FROM campaigns WHERE id = ${id}`
    return null
  })
}

export type SaveDailyResult = { ok: false; error: string } | { ok: true; replaced: boolean }

/** 날짜별 성과 저장. 같은 날짜가 이미 있으면 덮어써요 (replaced=true). */
export async function saveDaily(id: string, input: DailyInput, visitor: AxhubMe): Promise<SaveDailyResult> {
  await ensureSchema()
  return db().begin(async (sql): Promise<SaveDailyResult> => {
    // FOR SHARE — 기록끼리는 동시에 저장되고, 기간 수정(FOR UPDATE)과는 차례를 지켜요.
    const [c] = await sql<{ owner_key: string; start_date: string; end_date: string }[]>`
      SELECT owner_key, start_date::text, end_date::text FROM campaigns WHERE id = ${id} FOR SHARE`
    if (!c) return { ok: false, error: NOT_FOUND }
    if (!canEdit(visitor, c.owner_key)) return { ok: false, error: NO_PERMISSION }
    const checked = validateDaily(input, { start: c.start_date, end: c.end_date })
    if (!checked.ok) return checked
    const v = checked.value
    const [row] = await sql<{ inserted: boolean }[]>`
      INSERT INTO campaign_daily (campaign_id, day, impressions, clicks, conversions)
      VALUES (${id}, ${v.day}, ${v.impressions}, ${v.clicks}, ${v.conversions})
      ON CONFLICT (campaign_id, day) DO UPDATE
        SET impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks,
            conversions = EXCLUDED.conversions, updated_at = now()
      RETURNING (xmax = 0) AS inserted`
    return { ok: true, replaced: !row.inserted }
  })
}

export async function deleteDaily(id: string, day: string, visitor: AxhubMe): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (sql) => {
    const [c] = await sql<{ owner_key: string }[]>`SELECT owner_key FROM campaigns WHERE id = ${id} FOR SHARE`
    if (!c) return NOT_FOUND
    if (!canEdit(visitor, c.owner_key)) return NO_PERMISSION
    const gone = await sql`DELETE FROM campaign_daily WHERE campaign_id = ${id} AND day = ${day}`
    return gone.count === 0 ? '이미 지워진 기록이에요. 화면을 새로고침해 주세요.' : null
  })
}
