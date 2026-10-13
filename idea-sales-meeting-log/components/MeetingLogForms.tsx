'use client'

// 입력 폼 (브라우저 쪽). 저장은 app/actions.ts 의 Server Action 이 하고,
// 여기서는 칸별 오류 안내 · 저장 중 표시 · 삭제 확인만 맡아요.

import { startTransition, useActionState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Button, Description, FieldError, Input, Label, TextArea, TextField } from '@heroui/react'
import { Trash } from '@phosphor-icons/react'
import { StatusDot, useConfirm } from '@/components/ax'
import { createCompany, createMeeting, deleteCompany, deleteMeeting, updateCompany, type FormState } from '@/app/actions'

const EMPTY: FormState = {}

/** 저장 중에는 눌리지 않게 — 두 번 저장되는 걸 막아요. */
function SubmitButton({ children, variant = 'primary' }: { children: ReactNode; variant?: 'primary' | 'outline' }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} isDisabled={pending}>
      {pending ? '저장하는 중…' : children}
    </Button>
  )
}

/**
 * 이름표 + 입력 칸 + 오류 안내. 오류는 서버(app/actions.ts)가 돌려준 것만 보여요.
 * validationBehavior="aria" — 브라우저가 먼저 막지 않고 서버 검사 결과를 그대로 보여 줘요 (예전 noValidate 와 같아요).
 * 오류가 없을 때만 hint 를 보여 줘요.
 */
function Field({
  name,
  label,
  state,
  hint,
  className,
  children,
  ...field
}: {
  name: string
  label: string
  state: FormState
  hint?: string
  className?: string
  children: ReactNode
  defaultValue?: string
  maxLength?: number
  type?: string
  isRequired?: boolean
  autoComplete?: string
}) {
  const error = state.errors?.[name]
  return (
    <TextField name={name} className={className} isInvalid={Boolean(error)} validationBehavior="aria" {...field}>
      <Label>{label}</Label>
      {children}
      {error ? <FieldError>{error}</FieldError> : hint && <Description>{hint}</Description>}
    </TextField>
  )
}

/** 폼 아래 결과 한 줄 — 성공은 초록 점, 실패는 빨간 글씨. */
function Result({ state }: { state: FormState }) {
  if (!state.message) return null
  return state.ok ? (
    <p className="t-small" role="status">
      <StatusDot tone="active">{state.message}</StatusDot>
    </p>
  ) : (
    <p className="t-small text-danger" role="alert">
      {state.message}
    </p>
  )
}

type CompanyValues = { id?: string; name: string; contact_name: string; contact_info: string }

/** 고객사 등록(id 없음) · 수정(id 있음) 폼. */
export function CompanyForm({ initial }: { initial?: CompanyValues }) {
  const editing = Boolean(initial?.id)
  const [state, action] = useActionState(editing ? updateCompany : createCompany, EMPTY)
  const v = state.values ?? initial ?? { name: '', contact_name: '', contact_info: '' }

  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-3" noValidate>
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <Field name="name" label="회사명" state={state} defaultValue={v.name} maxLength={100} isRequired autoComplete="organization">
        <Input />
      </Field>
      <Field name="contact_name" label="담당자" hint="고객사에서 만나는 분" state={state} defaultValue={v.contact_name} maxLength={50}>
        <Input placeholder="예: 김민수 팀장" />
      </Field>
      <Field name="contact_info" label="연락처" hint="전화번호나 이메일" state={state} defaultValue={v.contact_info} maxLength={100}>
        <Input placeholder="예: 010-1234-5678" />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <SubmitButton variant={editing ? 'outline' : 'primary'}>{editing ? '정보 저장' : '등록하기'}</SubmitButton>
        <Result state={state} />
      </div>
    </form>
  )
}

/** 미팅 기록 남기기 폼. 미팅 날짜는 오늘(한국 시간)로 채워 둬요. */
export function MeetingForm({ companyId, today }: { companyId: string; today: string }) {
  const [state, action] = useActionState(createMeeting, EMPTY)
  const v = state.values ?? {}

  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="company_id" value={companyId} />
      {/* 날짜는 브라우저 기본 날짜 칸 — 'YYYY-MM-DD' 문자열로 그대로 저장돼요. */}
      <Field name="met_on" label="미팅 날짜" state={state} type="date" defaultValue={v.met_on ?? today} isRequired>
        <Input />
      </Field>
      <Field name="attendees" label="참석자" state={state} defaultValue={v.attendees ?? ''} maxLength={200}>
        <Input placeholder="예: 김민수 팀장, 이지은 대리" />
      </Field>
      <Field name="notes" label="내용" state={state} defaultValue={v.notes ?? ''} maxLength={5000} isRequired className="sm:col-span-2">
        <TextArea rows={5} placeholder="무슨 이야기를 나눴는지 적어 주세요." />
      </Field>
      <Field name="next_action" label="다음 할 일" state={state} defaultValue={v.next_action ?? ''} maxLength={500}>
        <Input placeholder="예: 견적서 보내기" />
      </Field>
      <Field name="next_contact_on" label="다음 연락일" hint="이 날이 되면 홈 맨 위에 보여요." state={state} type="date" defaultValue={v.next_contact_on ?? ''}>
        <Input />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton>기록 남기기</SubmitButton>
        <Result state={state} />
      </div>
    </form>
  )
}

/** 지우기 전에 확인창으로 한 번 더 물어요. 취소하면 아무 일도 일어나지 않아요. */
function DeleteAction({
  action,
  fields,
  title,
  description,
  children,
  small,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>
  fields: Record<string, string>
  title: string
  description: string
  children: ReactNode
  small?: boolean
}) {
  const [state, run, pending] = useActionState(action, EMPTY)
  const confirm = useConfirm()

  const onPress = async () => {
    if (!(await confirm({ title, description, confirmLabel: '지우기', cancelLabel: '취소', variant: 'danger' }))) return
    const form = new FormData()
    for (const [k, val] of Object.entries(fields)) form.set(k, val)
    startTransition(() => run(form))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant={small ? 'ghost' : 'outline'} data-color="danger" size={small ? 'sm' : 'md'} isDisabled={pending} onPress={onPress}>
        <Trash aria-hidden />
        {pending ? '지우는 중…' : children}
      </Button>
      <Result state={state} />
    </div>
  )
}

export function DeleteCompanyButton({ id, name }: { id: string; name: string }) {
  return (
    <DeleteAction
      action={deleteCompany}
      fields={{ id }}
      title={`'${name}' 고객사를 지울까요?`}
      description="미팅 기록도 모두 함께 지워지고 되돌릴 수 없어요."
    >
      고객사 지우기
    </DeleteAction>
  )
}

export function DeleteMeetingButton({ id, companyId, label }: { id: string; companyId: string; label: string }) {
  return (
    <DeleteAction action={deleteMeeting} fields={{ id, company_id: companyId }} title={`${label} 미팅 기록을 지울까요?`} description="되돌릴 수 없어요." small>
      지우기
    </DeleteAction>
  )
}
