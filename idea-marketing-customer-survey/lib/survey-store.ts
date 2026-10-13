// 설문 데이터 읽기·쓰기 (서버 전용). 화면(app/*)과 Server Action(app/actions.ts)은 이 파일만 거쳐요.
// 값은 전부 tagged-template 으로 넘겨 자동 바인딩돼요 — SQL 문자열을 이어붙이지 않아요.
import { db, ensureSchema } from './db'
import { validateAnswers, type QuestionKind, type SurveyDraft, type SurveyStatus } from './survey'

/** 한 쪽에 보여 줄 줄 수. 다음 쪽이 있는지는 한 줄 더 읽어 봐서 알아요. */
export const PAGE_SIZE = 30

export type Page<T> = { rows: T[]; hasMore: boolean }

function toPage<T>(rows: T[]): Page<T> {
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE }
}

/** 검색어 → ILIKE 패턴 (% _ \ 는 글자 그대로 찾게 이스케이프). */
const likeOf = (q: string) => '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'

export type OpenSurvey = { id: string; title: string; description: string; question_count: number; created_at: Date; responded: boolean }

/**
 * 직원 화면 — 진행 중인 설문. 아직 안 한 설문이 먼저 와요.
 * ponytail: OFFSET 페이징 — 설문 수백 개 규모에선 충분해요. 수만 개가 되면 커서로 바꿔요.
 */
export async function listOpenSurveys(userKey: string, q: string, page: number): Promise<Page<OpenSurvey>> {
  await ensureSchema()
  const match = q ? db()`AND s.title ILIKE ${likeOf(q)}` : db()``
  const rows = await db()<OpenSurvey[]>`
    SELECT s.id::text, s.title, s.description, s.created_at,
           (SELECT count(*) FROM survey_questions sq WHERE sq.survey_id = s.id)::int AS question_count,
           EXISTS (SELECT 1 FROM survey_responses r WHERE r.survey_id = s.id AND r.user_key = ${userKey}) AS responded
      FROM surveys s
     WHERE s.status = 'open' ${match}
     ORDER BY responded, s.id DESC
     LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`
  return toPage(rows)
}

export type ManagedSurvey = {
  id: string
  title: string
  status: SurveyStatus
  created_by_name: string
  created_at: Date
  response_count: number
}

/** 담당자 화면 — 모든 설문과 응답 수. q 가 있으면 제목에 그 글자가 들어간 것만. */
export async function listSurveys(q: string, page: number): Promise<Page<ManagedSurvey> & { total: number }> {
  await ensureSchema()
  const match = q ? db()`WHERE s.title ILIKE ${likeOf(q)}` : db()``
  const [rows, [{ total }]] = await Promise.all([
    db()<ManagedSurvey[]>`
      SELECT s.id::text, s.title, s.status, s.created_by_name, s.created_at,
             (SELECT count(*) FROM survey_responses r WHERE r.survey_id = s.id)::int AS response_count
        FROM surveys s ${match}
       ORDER BY s.id DESC
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    db()<{ total: number }[]>`SELECT count(*)::int AS total FROM surveys s ${match}`,
  ])
  return { ...toPage(rows), total }
}

export type Survey = {
  id: string
  title: string
  description: string
  status: SurveyStatus
  created_by_name: string
  created_at: Date
  closed_at: Date | null
}
export type Question = { id: string; position: number; kind: QuestionKind; prompt: string; options: string[] }

/** 설문 한 개와 문항. 없으면 null. */
export async function getSurvey(id: string): Promise<{ survey: Survey; questions: Question[] } | null> {
  await ensureSchema()
  const [[survey], questions] = await Promise.all([
    db()<Survey[]>`
      SELECT id::text, title, description, status, created_by_name, created_at, closed_at
        FROM surveys WHERE id = ${id}`,
    db()<Question[]>`
      SELECT id::text, position, kind, prompt, options
        FROM survey_questions WHERE survey_id = ${id} ORDER BY position`,
  ])
  return survey ? { survey, questions } : null
}

/** 이 사람이 이 설문에 응답한 시각. 안 했으면 null. */
export async function getMyResponse(surveyId: string, userKey: string): Promise<Date | null> {
  await ensureSchema()
  const [row] = await db()<{ created_at: Date }[]>`
    SELECT created_at FROM survey_responses WHERE survey_id = ${surveyId} AND user_key = ${userKey}`
  return row?.created_at ?? null
}

export type QuestionResult =
  | { id: string; kind: 'choice'; prompt: string; answered: number; options: { label: string; count: number }[] }
  | { id: string; kind: 'text'; prompt: string; answered: number; latest: string[] }

/** 미리 보여 줄 주관식 답 수. 나머지는 문항별 "전체 답 보기" 화면에서 쪽으로 나눠 봐요. */
export const TEXT_PREVIEW = 5

/** 결과 — 객관식은 보기별 응답 수, 주관식은 최근 답 몇 개. 집계는 DB 에서 GROUP BY 로 해요. */
export async function getResults(surveyId: string, questions: Question[]): Promise<{ total: number; questions: QuestionResult[] }> {
  await ensureSchema()
  const [[{ total }], counts, texts] = await Promise.all([
    db()<{ total: number }[]>`SELECT count(*)::int AS total FROM survey_responses WHERE survey_id = ${surveyId}`,
    db()<{ question_id: string; choice: number | null; n: number }[]>`
      SELECT a.question_id::text, a.choice, count(*)::int AS n
        FROM survey_answers a
        JOIN survey_questions q ON q.id = a.question_id
       WHERE q.survey_id = ${surveyId}
       GROUP BY a.question_id, a.choice`,
    db()<{ question_id: string; text_value: string }[]>`
      SELECT question_id::text, text_value FROM (
        SELECT a.question_id, a.text_value,
               row_number() OVER (PARTITION BY a.question_id ORDER BY a.response_id DESC) AS rn
          FROM survey_answers a
          JOIN survey_questions q ON q.id = a.question_id
         WHERE q.survey_id = ${surveyId} AND q.kind = 'text'
      ) t
      WHERE rn <= ${TEXT_PREVIEW}
      ORDER BY t.question_id, rn`,
  ])

  return {
    total,
    questions: questions.map((q): QuestionResult => {
      const mine = counts.filter((c) => c.question_id === q.id)
      const answered = mine.reduce((sum, c) => sum + c.n, 0)
      if (q.kind === 'text') {
        const latest = texts.filter((t) => t.question_id === q.id).map((t) => t.text_value)
        return { id: q.id, kind: 'text', prompt: q.prompt, answered, latest }
      }
      const options = q.options.map((label, i) => ({ label, count: mine.find((c) => c.choice === i)?.n ?? 0 }))
      return { id: q.id, kind: 'choice', prompt: q.prompt, answered, options }
    }),
  }
}

export type TextAnswer = { response_id: string; text_value: string; created_at: Date }

/** 주관식 한 문항의 답 전부 — 최근 것부터, q 가 있으면 그 글자가 들어간 답만. */
export async function listTextAnswers(questionId: string, q: string, page: number): Promise<Page<TextAnswer> & { total: number }> {
  await ensureSchema()
  const match = q ? db()`AND a.text_value ILIKE ${likeOf(q)}` : db()``
  const [rows, [{ total }]] = await Promise.all([
    db()<TextAnswer[]>`
      SELECT a.response_id::text, a.text_value, r.created_at
        FROM survey_answers a
        JOIN survey_responses r ON r.id = a.response_id
       WHERE a.question_id = ${questionId} AND a.text_value IS NOT NULL ${match}
       ORDER BY a.response_id DESC
       LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`,
    db()<{ total: number }[]>`
      SELECT count(*)::int AS total FROM survey_answers a
       WHERE a.question_id = ${questionId} AND a.text_value IS NOT NULL ${match}`,
  ])
  return { ...toPage(rows), total }
}

/** 새 설문을 저장하고 번호를 돌려줘요. */
export async function createSurvey(draft: SurveyDraft, creator: { userKey: string; name: string }): Promise<string> {
  await ensureSchema()
  return db().begin(async (sql) => {
    const [s] = await sql<{ id: string }[]>`
      INSERT INTO surveys (title, description, created_by_key, created_by_name)
      VALUES (${draft.title}, ${draft.description}, ${creator.userKey}, ${creator.name})
      RETURNING id::text`
    for (const [i, q] of draft.questions.entries()) {
      await sql`
        INSERT INTO survey_questions (survey_id, position, kind, prompt, options)
        VALUES (${s.id}, ${i}, ${q.kind}, ${q.prompt}, ${q.options}::text[])`
    }
    return s.id
  })
}

/**
 * 응답 저장. 문제가 있으면 사용자에게 보여 줄 문구를, 없으면 null 을 돌려줘요.
 * 설문 상태·문항은 트랜잭션 안에서 다시 읽어요 — 화면을 연 사이에 마감되거나 지워졌을 수 있어요.
 */
export async function submitResponse(surveyId: string, userKey: string, value: (questionId: string) => string): Promise<string | null> {
  await ensureSchema()
  return db().begin(async (sql) => {
    // FOR SHARE — 응답을 저장하는 동안 다른 사람이 마감·삭제하면 그쪽이 이 저장을 기다려요.
    const [survey] = await sql<{ status: SurveyStatus }[]>`SELECT status FROM surveys WHERE id = ${surveyId} FOR SHARE`
    if (!survey) return '없는 설문이에요. 링크를 다시 확인해 주세요.'
    if (survey.status !== 'open') return '마감된 설문이라 응답할 수 없어요.'

    const questions = await sql<{ id: string; kind: QuestionKind; options: string[] }[]>`
      SELECT id::text, kind, options FROM survey_questions WHERE survey_id = ${surveyId} ORDER BY position`
    const checked = validateAnswers(questions, value)
    if (!checked.ok) return checked.error

    // UNIQUE (survey_id, user_key) — 이미 응답했으면 아무것도 넣지 않아요.
    const [response] = await sql<{ id: string }[]>`
      INSERT INTO survey_responses (survey_id, user_key) VALUES (${surveyId}, ${userKey})
      ON CONFLICT (survey_id, user_key) DO NOTHING
      RETURNING id::text`
    if (!response) return '이미 응답한 설문이에요. 한 사람당 한 번만 응답할 수 있어요.'

    for (const a of checked.value) {
      await sql`
        INSERT INTO survey_answers (response_id, question_id, choice, text_value)
        VALUES (${response.id}, ${a.questionId}, ${a.choice}, ${a.text})`
    }
    return null
  })
}

/** 마감 · 다시 열기. 없는 설문이면 false. */
export async function setSurveyStatus(id: string, status: SurveyStatus): Promise<boolean> {
  await ensureSchema()
  const rows = await db()`
    UPDATE surveys
       SET status = ${status}, closed_at = CASE WHEN ${status} = 'closed' THEN now() END
     WHERE id = ${id}
    RETURNING 1`
  return rows.length > 0
}

/** 설문 삭제 — 문항·응답·답이 함께 지워져요. 없는 설문이면 false. */
export async function deleteSurvey(id: string): Promise<boolean> {
  await ensureSchema()
  const rows = await db()`DELETE FROM surveys WHERE id = ${id} RETURNING 1`
  return rows.length > 0
}
