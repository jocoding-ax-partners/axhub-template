'use client'

// 입력 폼과 버튼 (브라우저 쪽). 저장·검사는 app/actions.ts 의 Server Action 이 해요 — 여기선 입력을 돕기만 해요.
import { useActionState, useRef, type ComponentProps, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Alert, Button, Description, FieldError, Input, Label, TextArea, TextField, toast } from '@heroui/react'
import { CheckCircle, FloppyDisk, Plus, Trash, XCircle } from '@phosphor-icons/react'
import { cancelSignup, deleteTraining, saveTraining, signUp, type FormState } from '@/app/actions'
import { useConfirm } from '@/components/ax'
import { CAPACITY_MAX, DESCRIPTION_MAX, LOCATION_MAX, TITLE_MAX } from '@/lib/training'

type Action = (prev: FormState, form: FormData) => Promise<FormState>

/**
 * useActionState + 성공하면 알림(오른쪽 위). n 은 제출할 때마다 1씩 늘어요 —
 * 폼의 key 로 써서 서버가 돌려준 값(values)으로 입력칸을 새로 채워요.
 */
function useFormAction(action: Action) {
  return useActionState(
    async (prev: FormState & { n: number }, form: FormData) => {
      const r = await action(prev, form)
      if (r.ok && r.message) toast.success(r.message)
      return { ...r, n: prev.n + 1 }
    },
    { n: 0 },
  )
}

/** 글자 입력 칸 하나 — 서버가 돌려준 칸별 오류(fieldErrors)를 그 칸 아래에 보여줘요. */
function Field({
  label,
  name,
  state,
  initial = '',
  hint,
  isRequired,
  multiline,
  ...input
}: {
  label: string
  name: string
  state: FormState
  initial?: string
  hint?: string
  isRequired?: boolean
  multiline?: boolean
} & Omit<ComponentProps<typeof Input>, 'name'>) {
  const error = state.fieldErrors?.[name]
  return (
    // validationBehavior="aria" — 검사는 서버가 해요. 브라우저가 따로 막거나 말풍선을 띄우지 않아요.
    <TextField
      name={name}
      defaultValue={state.values?.[name] ?? initial}
      isRequired={isRequired}
      isInvalid={!!error}
      validationBehavior="aria"
      className={multiline ? 'sm:col-span-2' : undefined}
    >
      <Label>{label}</Label>
      {multiline ? <TextArea rows={4} maxLength={input.maxLength} placeholder={input.placeholder} /> : <Input {...input} />}
      {hint && !error && <Description>{hint}</Description>}
      <FieldError>{error}</FieldError>
    </TextField>
  )
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert status="danger" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
    </Alert>
  )
}

/** 누르는 동안 비활성화되고 문구가 바뀌는 제출 버튼. */
function SubmitButton({ children, pending: pendingLabel, ...rest }: { children: ReactNode; pending: string } & ComponentProps<typeof Button>) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" isPending={pending} {...rest}>
      {pending ? pendingLabel : children}
    </Button>
  )
}

/** 되돌리기 어려운 일 — 확인창으로 한 번 더 묻고 제출해요. */
function ConfirmSubmit({
  children,
  pending: pendingLabel,
  confirm: options,
  ...rest
}: {
  children: ReactNode
  pending: string
  confirm: { title: string; description: string; confirmLabel: string }
} & ComponentProps<typeof Button>) {
  const { pending } = useFormStatus()
  const confirm = useConfirm()
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      data-color="danger"
      isPending={pending}
      onPress={async () => {
        if (await confirm({ ...options, variant: 'danger' })) ref.current?.form?.requestSubmit()
      }}
      {...rest}
    >
      {pending ? pendingLabel : children}
    </Button>
  )
}

export type TrainingDefaults = { id: string; title: string; description: string; starts_at: string; location: string; capacity: string }

/** 교육 등록(training 없음) · 수정(training 있음) 폼. */
export function TrainingForm({ training }: { training?: TrainingDefaults }) {
  const [state, action] = useFormAction(saveTraining)
  const init = (k: keyof TrainingDefaults) => training?.[k] ?? ''
  return (
    <form key={state.n} action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
      {training && <input type="hidden" name="id" value={training.id} />}
      <Field label="제목" name="title" state={state} initial={init('title')} maxLength={TITLE_MAX} placeholder="예: 신입사원 보안 교육" isRequired />
      <Field label="장소" name="location" state={state} initial={init('location')} maxLength={LOCATION_MAX} placeholder="예: 본사 3층 대회의실 · 온라인(Zoom)" isRequired />
      <Field label="일시" name="starts_at" state={state} initial={init('starts_at')} type="datetime-local" hint="한국 시간 기준이에요. 이 시각부터 신청 · 취소가 닫혀요." isRequired />
      <Field label="정원" name="capacity" state={state} initial={init('capacity')} type="number" inputMode="numeric" min={1} max={CAPACITY_MAX} placeholder="예: 30" hint="정원이 차면 신청 버튼이 「마감」으로 바뀌어요." isRequired />
      <Field label="설명" name="description" state={state} initial={init('description')} maxLength={DESCRIPTION_MAX} placeholder="무엇을 배우는지, 준비물이 있는지 적어 주세요. (선택)" multiline />
      <div className="flex flex-col items-start gap-3 sm:col-span-2">
        {state.ok === false && state.message && <ErrorAlert message={state.message} />}
        {training ? (
          <SubmitButton pending="저장하는 중…">
            <FloppyDisk />
            저장
          </SubmitButton>
        ) : (
          <SubmitButton pending="등록하는 중…">
            <Plus />
            교육 등록
          </SubmitButton>
        )}
      </div>
    </form>
  )
}

/** 교육 지우기 — 신청 명단도 함께 지워져요. 성공하면 교육 관리 화면으로 돌아가요. */
export function DeleteTrainingButton({ id, title, signed }: { id: string; title: string; signed: number }) {
  const [state, action] = useFormAction(deleteTraining)
  return (
    <form action={action} className="flex flex-col items-start gap-3">
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmit
        pending="지우는 중…"
        confirm={{
          title: `"${title}" 교육을 지울까요?`,
          description: signed > 0 ? `신청한 ${signed}명의 명단도 함께 지워지고 되돌릴 수 없어요.` : '지우면 되돌릴 수 없어요.',
          confirmLabel: '지우기',
        }}
      >
        <Trash />
        교육 지우기
      </ConfirmSubmit>
      {state.ok === false && state.message && <ErrorAlert message={state.message} />}
    </form>
  )
}

/** 교육 카드의 신청 · 취소 버튼. 마감 · 지난 교육이면 누를 수 없는 버튼만 보여요. */
export function SignupButton({ id, title, state: s }: { id: string; title: string; state: 'mine' | 'open' | 'full' | 'started' }) {
  const [state, action] = useFormAction(s === 'mine' ? cancelSignup : signUp)
  if (s === 'full' || s === 'started') {
    return (
      <Button variant="secondary" isDisabled className="w-full sm:w-auto">
        {s === 'full' ? '마감' : '신청 종료'}
      </Button>
    )
  }
  return (
    <form action={action} className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <input type="hidden" name="id" value={id} />
      {s === 'mine' ? (
        <ConfirmSubmit
          pending="취소하는 중…"
          className="w-full sm:w-auto"
          confirm={{ title: `"${title}" 신청을 취소할까요?`, description: '취소한 자리는 다른 사람이 신청할 수 있어요.', confirmLabel: '신청 취소' }}
        >
          <XCircle />
          신청 취소
        </ConfirmSubmit>
      ) : (
        <SubmitButton pending="신청하는 중…" className="w-full sm:w-auto">
          <CheckCircle />
          신청하기
        </SubmitButton>
      )}
      {state.ok === false && state.message && (
        <p role="alert" className="t-small text-danger">
          {state.message}
        </p>
      )}
    </form>
  )
}
