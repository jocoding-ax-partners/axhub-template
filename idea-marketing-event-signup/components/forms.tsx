'use client'

// 입력 폼과 버튼 (브라우저 쪽). 저장은 app/actions.ts 의 Server Action 이 해요.
import { useActionState, useRef, type ComponentProps, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Alert, Button, Description, FieldError, Input, Label, TextField } from '@heroui/react'
import { addApplicant, createEvent, type FormState } from '@/app/actions'
import { useConfirm } from '@/components/ax'

/** 글자 입력 칸 하나 — 서버가 돌려준 오류(state.fieldErrors)와 입력값(state.values)을 그대로 보여줘요. */
function Field({
  label,
  name,
  state,
  hint,
  isRequired,
  ...input
}: { label: string; name: string; state: FormState; hint?: string; isRequired?: boolean } & Omit<ComponentProps<typeof Input>, 'name'>) {
  const error = state.fieldErrors?.[name]
  return (
    // validationBehavior="aria" — 검사는 서버가 해요. 브라우저가 따로 막거나 말풍선을 띄우지 않아요.
    <TextField name={name} defaultValue={state.values?.[name] ?? ''} isRequired={isRequired} isInvalid={!!error} validationBehavior="aria">
      <Label>{label}</Label>
      <Input {...input} />
      {hint && !error && <Description>{hint}</Description>}
      <FieldError>{error}</FieldError>
    </TextField>
  )
}

function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null
  return (
    <Alert status={state.ok ? 'success' : 'danger'} role={state.ok ? 'status' : 'alert'}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{state.message}</Alert.Title>
      </Alert.Content>
    </Alert>
  )
}

/** 누르는 동안 비활성화되고 문구가 바뀌는 제출 버튼. */
export function SubmitButton({
  children,
  pending: pendingLabel,
  variant = 'primary',
  size,
}: {
  children: ReactNode
  pending: string
  variant?: ComponentProps<typeof Button>['variant']
  size?: ComponentProps<typeof Button>['size']
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} size={size} isPending={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </Button>
  )
}

/** 지우기처럼 되돌릴 수 없는 일 — 확인창으로 한 번 더 묻고 제출해요. */
export function ConfirmSubmit({
  children,
  title,
  description,
  size,
}: {
  children: ReactNode
  title: string
  description: string
  size?: ComponentProps<typeof Button>['size']
}) {
  const { pending } = useFormStatus()
  const confirm = useConfirm()
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      data-color="danger"
      size={size}
      isPending={pending}
      onPress={async () => {
        const ok = await confirm({ title, description, confirmLabel: '지우기', variant: 'danger' })
        if (ok) ref.current?.form?.requestSubmit()
      }}
    >
      {children}
    </Button>
  )
}

export function EventForm() {
  const [state, action] = useActionState(createEvent, {})
  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
      <Field label="이벤트 이름" name="name" state={state} maxLength={200} placeholder="예: 2026 마케팅 세미나" isRequired />
      <Field label="일시" name="starts_at" state={state} hint="한국 시간 기준이에요." type="datetime-local" isRequired />
      <Field label="장소" name="venue" state={state} maxLength={200} placeholder="예: 코엑스 컨퍼런스룸 301" isRequired />
      <Field label="정원" name="capacity" state={state} type="number" inputMode="numeric" min={1} max={100000} placeholder="예: 100" isRequired />
      <div className="flex flex-col items-start gap-3 sm:col-span-2">
        <SubmitButton pending="만드는 중…">이벤트 만들기</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  )
}

export function ApplicantForm({ eventId }: { eventId: string }) {
  const [state, action] = useActionState(addApplicant, {})
  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-3" noValidate>
      <input type="hidden" name="event_id" value={eventId} />
      <Field label="이름" name="name" state={state} maxLength={100} placeholder="홍길동" autoComplete="off" isRequired />
      <Field label="회사" name="company" state={state} hint="없으면 비워 둬도 돼요." maxLength={100} placeholder="axhub" autoComplete="off" />
      <Field label="이메일" name="email" state={state} type="email" maxLength={254} placeholder="name@company.com" autoComplete="off" isRequired />
      <div className="flex flex-col items-start gap-3 sm:col-span-3">
        <SubmitButton pending="등록하는 중…">신청자 등록</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  )
}

/** 목록의 버튼 하나짜리 폼(출석 · 지우기). 실패하면 버튼 아래에 이유를 보여줘요. */
export function ActionForm({
  action,
  fields,
  children,
  className = 'shrink-0 items-end',
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>
  fields: Record<string, string>
  children: ReactNode
  className?: string
}) {
  const [state, formAction] = useActionState(action, {})
  return (
    <form action={formAction} className={`flex flex-col gap-1 ${className}`}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      {!state.ok && state.message && (
        <span className="text-caption-01 text-danger" role="alert">
          {state.message}
        </span>
      )}
    </form>
  )
}
