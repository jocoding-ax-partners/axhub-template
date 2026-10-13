// 지원자·평가표 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import { db, ensureSchema } from './db'
import type { CandidateValue, InterviewResult, ScoreValue } from './interview'

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean }

function toPage<T>(rows: T[]): Page<T> {
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE }
}

/** 검색어 → ILIKE 패턴 (%, _ 는 글자 그대로). */
const likeOf = (q: string) => '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'

// ── 면접관 ───────────────────────────────────────────────────────────────────

export type MyInterview = {
  id: string
  name: string
  position: string
  interview_at: Date
  result: InterviewResult | null
  /** 내가 낸 평가표의 세 항목 평균. 아직 안 냈으면 null */
  my_overall: number | null
}

export type MyCounts = { todo: number; done: number }

// ponytail: OFFSET 페이징 — 한 사람에게 배정된 면접 수 규모에선 충분해요. 수만 건이 되면 커서로 바꿔요.
/** 내가 면접관으로 배정된 지원자. 평가할 것(결과 전 · 평가 안 냄)이 먼저, 그 안에서는 면접 일시 순이에요. */
export async function listMyInterviews(email: string, page: number): Promise<Page<MyInterview> & MyCounts> {
  await ensureSchema()
  const [rows, [counts]] = await Promise.all([
    db()<MyInterview[]>`
      SELECT c.id::text, c.name, c.position, c.interview_at, c.result,
             ((s.job_skill + s.communication + s.culture_fit) / 3.0)::float8 AS my_overall
        FROM candidates c
        LEFT JOIN scorecards s ON s.candidate_id = c.id AND s.interviewer_email = ${email}
       WHERE c.interviewers @> ARRAY[${email}]::text[]
       ORDER BY (s.candidate_id IS NULL AND c.result IS NULL) DESC, c.interview_at, c.id
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    db()<MyCounts[]>`
      SELECT count(*) FILTER (WHERE s.candidate_id IS NULL AND c.result IS NULL)::int AS todo,
             count(s.candidate_id)::int AS done
        FROM candidates c
        LEFT JOIN scorecards s ON s.candidate_id = c.id AND s.interviewer_email = ${email}
       WHERE c.interviewers @> ARRAY[${email}]::text[]`,
  ])
  return { ...toPage(rows), ...counts }
}

export type MyScorecard = {
  candidate: { id: string; name: string; position: string; interview_at: Date; result: InterviewResult | null }
  score: (ScoreValue & { updated_at: Date }) | null
}

/** 평가 화면 — 내가 배정된 지원자일 때만 돌려줘요. 아니면 null. */
export async function getMyScorecard(id: string, email: string): Promise<MyScorecard | null> {
  await ensureSchema()
  const [candidate] = await db()<MyScorecard['candidate'][]>`
    SELECT id::text, name, position, interview_at, result
      FROM candidates WHERE id = ${id} AND interviewers @> ARRAY[${email}]::text[]`
  if (!candidate) return null
  const [score] = await db()<NonNullable<MyScorecard['score']>[]>`
    SELECT job_skill, communication, culture_fit, comment, updated_at
      FROM scorecards WHERE candidate_id = ${id} AND interviewer_email = ${email}`
  return { candidate, score: score ?? null }
}

/** 평가표 저장(처음이면 새로, 있으면 고쳐요). 문제가 있으면 사용자에게 보여 줄 문구를, 없으면 null. */
export async function saveScorecard(id: string, who: { email: string; name: string }, s: ScoreValue): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (sql) => {
    // 결과 기록·면접관 변경과 엇갈리지 않게 지원자 줄을 잠가요.
    const [c] = await sql<{ assigned: boolean; result: string | null }[]>`
      SELECT interviewers @> ARRAY[${who.email}]::text[] AS assigned, result
        FROM candidates WHERE id = ${id} FOR UPDATE`
    if (!c || !c.assigned) return '내가 면접관으로 배정된 지원자가 아니에요. 화면을 새로고침해 주세요.'
    if (c.result) return '결과가 이미 기록돼서 평가를 고칠 수 없어요. 채용 담당자에게 알려 주세요.'
    await sql`
      INSERT INTO scorecards (candidate_id, interviewer_email, interviewer_name, job_skill, communication, culture_fit, comment)
      VALUES (${id}, ${who.email}, ${who.name}, ${s.job_skill}, ${s.communication}, ${s.culture_fit}, ${s.comment})
      ON CONFLICT (candidate_id, interviewer_email) DO UPDATE SET
        interviewer_name = EXCLUDED.interviewer_name,
        job_skill = EXCLUDED.job_skill,
        communication = EXCLUDED.communication,
        culture_fit = EXCLUDED.culture_fit,
        comment = EXCLUDED.comment,
        updated_at = now()`
    return null
  })
}

// ── 채용 담당자 ───────────────────────────────────────────────────────────────

/** 목록 거르기 — 전체 · 결과 대기 · 결과별. */
export const RESULT_FILTERS = ['all', 'waiting', 'pass', 'hold', 'fail'] as const
export type ResultFilter = (typeof RESULT_FILTERS)[number]

export type CandidateRow = {
  id: string
  name: string
  position: string
  interview_at: Date
  interviewer_count: number
  result: InterviewResult | null
  scored: number
  /** 제출된 평가표 전체의 종합 평균. 하나도 없으면 null */
  overall: number | null
}

export type ResultCounts = Record<ResultFilter, number>

/** 지원자 목록. q 는 이름·직무에서 찾고, filter 로 결과별로 걸러요. 최근 면접이 먼저예요. */
export async function listCandidates(q: string, filter: ResultFilter, page: number): Promise<Page<CandidateRow> & { counts: ResultCounts }> {
  await ensureSchema()
  const like = likeOf(q)
  const match = q ? db()`AND (c.name ILIKE ${like} OR c.position ILIKE ${like})` : db()``
  const only =
    filter === 'all' ? db()`` : filter === 'waiting' ? db()`AND c.result IS NULL` : db()`AND c.result = ${filter}`
  const [rows, [counts]] = await Promise.all([
    db()<CandidateRow[]>`
      SELECT c.id::text, c.name, c.position, c.interview_at, cardinality(c.interviewers) AS interviewer_count, c.result,
             count(s.candidate_id)::int AS scored,
             avg((s.job_skill + s.communication + s.culture_fit) / 3.0)::float8 AS overall
        FROM candidates c
        LEFT JOIN scorecards s ON s.candidate_id = c.id
       WHERE true ${match} ${only}
       GROUP BY c.id
       ORDER BY c.interview_at DESC, c.id DESC
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    // 거르기 버튼의 숫자 — 검색어는 반영하고 결과 거르기는 반영하지 않아요.
    db()<ResultCounts[]>`
      SELECT count(*)::int AS "all",
             count(*) FILTER (WHERE c.result IS NULL)::int AS waiting,
             count(*) FILTER (WHERE c.result = 'pass')::int AS pass,
             count(*) FILTER (WHERE c.result = 'hold')::int AS hold,
             count(*) FILTER (WHERE c.result = 'fail')::int AS fail
        FROM candidates c WHERE true ${match}`,
  ])
  return { ...toPage(rows), counts }
}

export type CandidateDetail = {
  id: string
  name: string
  position: string
  interview_at: Date
  interviewers: string[]
  result: InterviewResult | null
  result_by: string | null
  result_at: Date | null
  created_by: string
  created_at: Date
}

export type Scorecard = ScoreValue & { interviewer_email: string; interviewer_name: string; updated_at: Date }

/** 지원자 상세 — 기본 정보와 제출된 평가표 전부 (면접관 수는 최대 10명이라 한 번에 읽어요). */
export async function getCandidate(id: string): Promise<{ candidate: CandidateDetail; scorecards: Scorecard[] } | null> {
  await ensureSchema()
  const [candidate] = await db()<CandidateDetail[]>`
    SELECT id::text, name, position, interview_at, interviewers, result, result_by, result_at, created_by, created_at
      FROM candidates WHERE id = ${id}`
  if (!candidate) return null
  const scorecards = await db()<Scorecard[]>`
    SELECT interviewer_email, interviewer_name, job_skill, communication, culture_fit, comment, updated_at
      FROM scorecards WHERE candidate_id = ${id}
     ORDER BY created_at, interviewer_email`
  return { candidate, scorecards }
}

/** 지원자 등록. 새 지원자의 id 를 돌려줘요. */
export async function createCandidate(v: CandidateValue, createdBy: string): Promise<string> {
  await ensureSchema()
  const [row] = await db()<{ id: string }[]>`
    INSERT INTO candidates (name, position, interview_at, interviewers, created_by)
    VALUES (${v.name}, ${v.position}, ${v.interviewAt}, ${v.interviewers}::text[], ${createdBy})
    RETURNING id::text`
  return row.id
}

/** 지원자 정보 수정. 평가를 이미 낸 면접관은 뺄 수 없어요. 문제가 있으면 문구를, 없으면 null. */
export async function updateCandidate(id: string, v: CandidateValue): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (sql) => {
    const [c] = await sql`SELECT 1 FROM candidates WHERE id = ${id} FOR UPDATE`
    if (!c) return '없는 지원자예요. 목록에서 다시 골라 주세요.'
    const removed = await sql<{ interviewer_email: string }[]>`
      SELECT interviewer_email FROM scorecards
       WHERE candidate_id = ${id} AND NOT (interviewer_email = ANY (${v.interviewers}::text[]))
       ORDER BY interviewer_email`
    if (removed.length > 0)
      return `${removed.map((r) => r.interviewer_email).join(', ')} 님은 이미 평가를 냈어요. 면접관에서 뺄 수 없어요.`
    await sql`
      UPDATE candidates
         SET name = ${v.name}, position = ${v.position}, interview_at = ${v.interviewAt}, interviewers = ${v.interviewers}::text[]
       WHERE id = ${id}`
    return null
  })
}

/** 결과 기록. null 이면 "결과 대기" 로 되돌려 면접관이 다시 평가를 고칠 수 있어요. */
export async function recordResult(id: string, result: InterviewResult | null, by: string): Promise<string | null> {
  await ensureSchema()
  const rows = await db()`
    UPDATE candidates
       SET result = ${result}, result_by = ${result ? by : null}, result_at = CASE WHEN ${result}::text IS NULL THEN NULL ELSE now() END
     WHERE id = ${id}
    RETURNING id`
  return rows.length === 0 ? '없는 지원자예요. 목록에서 다시 골라 주세요.' : null
}

/** 지원자 삭제 — 평가표도 같이 지워져요. */
export async function deleteCandidate(id: string): Promise<string | null> {
  await ensureSchema()
  const rows = await db()`DELETE FROM candidates WHERE id = ${id} RETURNING id`
  return rows.length === 0 ? '이미 지워진 지원자예요.' : null
}
