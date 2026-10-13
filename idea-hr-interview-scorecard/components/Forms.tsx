'use client'

// 화면의 입력 폼 모음. 검사는 서버(app/actions.ts)에서 다시 해요 — 여기선 입력을 돕기만 해요.
import { startTransition, useActionState, useState, type FormEvent } from 'react'
import {
  Alert,
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Radio,
  RadioGroup,
  TextArea,
  TextField,
  toast,
} from '@heroui/react'
import { FloppyDisk, Trash, UserPlus } from '@phosphor-icons/react'
import { useConfirm } from '@/components/ax'
import {
  createCandidate,
  deleteCandidate,
  recordResult,
  submitScorecard,
  updateCandidate,
  type FormState,
} from '@/app/actions'
import {
  COMMENT_MAX,
  CRITERIA,
  INTERVIEWERS_MAX,
  NAME_MAX,
  POSITION_MAX,
  RESULT_LABEL,
  SCORE_MAX,
  SCORE_MIN,
  type CriterionKey,
  type InterviewResult,
} from '@/lib/interview'

type Action = (prev: FormState | null, form: FormData) => Promise<FormState>

/**
 * 서버 함수를 부르고, 성공하면 알림(오른쪽 위)을 띄우고 onDone 을 불러요. 실패 문구는 state 로 돌려줘요.
 * <form action> 대신 onSubmit 으로 보내요 — 실패했을 때 입력한 값이 지워지지 않게.
 */
function useServerForm(action: Action, onDone?: () => void) {
  const [state, dispatch, pending] = useActionState(async (prev: FormState | null, form: FormData) => {
    const r = await action(prev, form)
    if (r.ok) {
      toast.success(r.message)
      onDone?.()
      return null
    }
    return r
  }, null)
  const submit = (form: FormData) => startTransition(() => dispatch(form))
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    submit(new FormData(e.currentTarget))
  }
  return { error: state, pending, submit, onSubmit }
}

function ErrorAlert({ error }: { error: FormState | null }) {
  if (!error) return null
  return (
    <Alert status="danger" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{error.message}</Alert.Description>
      </Alert.Content>
    </Alert>
  )
}

export type CandidateDefaults = { id: string; name: string; position: string; interviewAt: string; interviewers: string[] }

/** 지원자 등록(defaults 없음) · 수정(defaults 있음) 폼. */
export function CandidateForm({ defaults }: { defaults?: CandidateDefaults }) {
  // 등록에 성공하면 key 를 바꿔 폼을 새로 그려요 — 입력칸이 전부 비워져요.
  const [formKey, setFormKey] = useState(0)
  const editing = Boolean(defaults)
  const { error, pending, onSubmit } = useServerForm(
    editing ? updateCandidate : createCandidate,
    editing ? undefined : () => setFormKey((k) => k + 1),
  )

  return (
    <form key={formKey} onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      <TextField name="name" isRequired maxLength={NAME_MAX} defaultValue={defaults?.name}>
        <Label>지원자 이름</Label>
        <Input placeholder="예: 김지원" autoComplete="off" />
        <FieldError />
      </TextField>
      <TextField name="position" isRequired maxLength={POSITION_MAX} defaultValue={defaults?.position}>
        <Label>지원 직무</Label>
        <Input placeholder="예: 백엔드 개발자" />
        <FieldError />
      </TextField>
      <TextField name="interview_at" type="datetime-local" isRequired defaultValue={defaults?.interviewAt}>
        <Label>면접 일시</Label>
        <Input />
        <Description>한국 시간이에요.</Description>
        <FieldError />
      </TextField>
      <TextField name="interviewers" isRequired defaultValue={defaults?.interviewers.join(', ')}>
        <Label>면접관 이메일</Label>
        <Input placeholder="예: kim@company.com, lee@company.com" inputMode="email" autoComplete="off" />
        <Description>axhub 로그인 이메일을 쉼표로 나눠 적어요. {INTERVIEWERS_MAX}명까지예요.</Description>
        <FieldError />
      </TextField>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <ErrorAlert error={error} />
        <div>
          <Button type="submit" variant={editing ? 'outline' : 'primary'} isPending={pending}>
            {editing ? <FloppyDisk /> : <UserPlus />}
            {pending ? '저장하는 중…' : editing ? '고친 내용 저장' : '지원자 등록'}
          </Button>
        </div>
      </div>
    </form>
  )
}

/** 면접관 평가표 — 세 항목 1~5점과 의견. 이미 낸 평가가 있으면 그 값으로 채워져요. */
export function ScoreForm({ id, initial }: { id: string; initial: (Record<CriterionKey, number> & { comment: string }) | null }) {
  const { error, pending, onSubmit } = useServerForm(submitScorecard)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={id} />
      {CRITERIA.map((c) => (
        <RadioGroup key={c.key} name={c.key} isRequired orientation="horizontal" defaultValue={initial ? String(initial[c.key]) : undefined}>
          <Label>{c.label}</Label>
          <div className="grid max-w-md grid-cols-5 gap-2">
            {Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => String(SCORE_MIN + i)).map((n) => (
              <Radio key={n} value={n}>
                <Radio.Content>
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  <span className="t-small">{n}점</span>
                </Radio.Content>
              </Radio>
            ))}
          </div>
          <FieldError />
        </RadioGroup>
      ))}
      <TextField name="comment" isRequired maxLength={COMMENT_MAX} defaultValue={initial?.comment}>
        <Label>의견</Label>
        <TextArea rows={5} placeholder="강점, 아쉬운 점, 추천 여부를 적어 주세요." />
        <Description>{COMMENT_MAX}자까지 적을 수 있어요. 채용 담당자만 봐요.</Description>
        <FieldError />
      </TextField>
      <div className="flex flex-col gap-3">
        <ErrorAlert error={error} />
        <div>
          <Button type="submit" isPending={pending}>
            <FloppyDisk />
            {pending ? '저장하는 중…' : initial ? '평가 고치기' : '평가 제출'}
          </Button>
        </div>
      </div>
    </form>
  )
}

/** 결과 기록 버튼 — 누르면 한 번 더 물어요. 이미 기록됐으면 바꾸거나 지울 수 있어요. */
export function ResultForm({ id, name, current, scored, total }: { id: string; name: string; current: InterviewResult | null; scored: number; total: number }) {
  const confirm = useConfirm()
  const { error, pending, submit } = useServerForm(recordResult)

  async function choose(result: InterviewResult | '') {
    const missing = total - scored
    const ok = await confirm(
      result === ''
        ? {
            title: `${name}님의 결과를 지울까요?`,
            description: '결과 대기로 돌아가고, 면접관이 평가를 다시 고칠 수 있어요.',
            confirmLabel: '결과 지우기',
            variant: 'danger',
          }
        : {
            title: `${name}님을 ${RESULT_LABEL[result]}(으)로 기록할까요?`,
            description:
              (missing > 0 ? `아직 평가를 내지 않은 면접관이 ${missing}명 있어요. ` : '') +
              '결과가 기록되면 면접관은 평가를 고칠 수 없어요.',
            confirmLabel: RESULT_LABEL[result],
            variant: result === 'fail' ? 'danger' : undefined,
          },
    )
    if (!ok) return
    const data = new FormData()
    data.set('id', id)
    data.set('result', result)
    submit(data)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(RESULT_LABEL) as InterviewResult[]).map((r) => (
          <Button
            key={r}
            variant={current === r ? 'primary' : 'outline'}
            aria-pressed={current === r}
            isDisabled={pending}
            onPress={() => current !== r && choose(r)}
          >
            {RESULT_LABEL[r]}
          </Button>
        ))}
        {current && (
          <Button variant="ghost" isDisabled={pending} onPress={() => choose('')}>
            결과 지우기
          </Button>
        )}
      </div>
      {pending && (
        <p role="status" className="t-small">
          기록하는 중…
        </p>
      )}
      <ErrorAlert error={error} />
    </div>
  )
}

/** 지원자 삭제 — 확인창을 거쳐요. 지우면 목록으로 돌아가요. */
export function DeleteCandidateButton({ id, name, scored }: { id: string; name: string; scored: number }) {
  const confirm = useConfirm()
  const { error, pending, submit } = useServerForm(deleteCandidate)

  async function onPress() {
    const ok = await confirm({
      title: `${name}님을 지울까요?`,
      description: (scored > 0 ? `면접관 평가 ${scored}건도 함께 지워져요. ` : '') + '되돌릴 수 없어요.',
      confirmLabel: '지우기',
      variant: 'danger',
    })
    if (!ok) return
    const data = new FormData()
    data.set('id', id)
    submit(data)
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button variant="outline" data-color="danger" isPending={pending} onPress={onPress}>
          <Trash />
          {pending ? '지우는 중…' : '지원자 지우기'}
        </Button>
      </div>
      <ErrorAlert error={error} />
    </div>
  )
}
