'use client'

// 입력 폼·버튼 (브라우저 쪽). 저장은 app/actions.ts 의 Server Action 이 하고,
// 여기서는 칸별 오류 안내 · 저장 중 표시 · 삭제 확인만 맡아요.
import { startTransition, useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { Alert, Button, Checkbox, Description, FieldError, Input, Label, TextArea, TextField, toast } from '@heroui/react'
import { CheckCircle, Megaphone, Trash } from '@phosphor-icons/react'
import { useConfirm } from '@/components/ax'
import { confirmRead, createNotice, deleteNotice, type FormState } from '@/app/actions'
import { BODY_MAX, TITLE_MAX } from '@/lib/notice'

const EMPTY: FormState = {}

/** 서버가 돌려준 실패 문구. */
function ErrorAlert({ state }: { state: FormState }) {
  if (state.ok !== false || !state.message) return null
  return (
    <Alert status="danger" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{state.message}</Alert.Description>
      </Alert.Content>
    </Alert>
  )
}

/** 성공하면 오른쪽 위에 알림을 띄워요. */
function useSuccessToast(state: FormState) {
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message)
  }, [state])
}

function PostButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" isPending={pending}>
      <Megaphone />
      {pending ? '올리는 중…' : '공지 올리기'}
    </Button>
  )
}

/** 새 공지 폼 (관리자). 성공하면 칸이 비워지고, 실패하면 적은 내용이 남아요. */
export function NoticeForm() {
  const [state, action] = useActionState(createNotice, EMPTY)
  useSuccessToast(state)
  const v = state.ok ? {} : (state.values ?? {})

  return (
    // key — 결과가 바뀌면 폼을 새로 그려 성공 땐 비우고 실패 땐 적은 값을 다시 채워요.
    <form key={JSON.stringify(state)} action={action} className="flex flex-col gap-4" noValidate>
      <TextField name="title" defaultValue={v.title ?? ''} maxLength={TITLE_MAX} isRequired isInvalid={Boolean(state.errors?.title)} validationBehavior="aria">
        <Label>제목</Label>
        <Input placeholder="예: 10월 정기 보안 점검 안내" />
        {state.errors?.title && <FieldError>{state.errors.title}</FieldError>}
      </TextField>
      <TextField name="body" defaultValue={v.body ?? ''} maxLength={BODY_MAX} isRequired isInvalid={Boolean(state.errors?.body)} validationBehavior="aria">
        <Label>본문</Label>
        <TextArea rows={8} placeholder="직원에게 알릴 내용을 적어 주세요. 줄바꿈은 그대로 보여요." />
        {state.errors?.body ? <FieldError>{state.errors.body}</FieldError> : <Description>{BODY_MAX.toLocaleString('ko-KR')}자까지 적을 수 있어요.</Description>}
      </TextField>
      <Checkbox name="important" defaultSelected={v.important === 'on'}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Label>중요 공지로 표시 — 직원 목록에서 안 읽은 공지 중 맨 위에 보여요</Label>
        </Checkbox.Content>
      </Checkbox>
      <ErrorAlert state={state} />
      <div>
        <PostButton />
      </div>
    </form>
  )
}

function ConfirmButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" isPending={pending} className="w-full sm:w-auto">
      <CheckCircle />
      {pending ? '저장하는 중…' : '확인했어요'}
    </Button>
  )
}

/** 직원의 "확인했어요" 버튼. 누르면 화면이 확인 시각으로 바뀌어요. */
export function ConfirmReadForm({ id }: { id: string }) {
  const [state, action] = useActionState(confirmRead, EMPTY)
  useSuccessToast(state)
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div>
        <ConfirmButton />
      </div>
      <ErrorAlert state={state} />
    </form>
  )
}

/** 공지 삭제 (관리자). 한 번 더 묻고, 지우면 공지 관리로 돌아가요. */
export function DeleteNoticeButton({ id, title }: { id: string; title: string }) {
  const [state, run, pending] = useActionState(deleteNotice, EMPTY)
  const confirm = useConfirm()

  const onPress = async () => {
    const ok = await confirm({
      title: `'${title}' 공지를 지울까요?`,
      description: '직원들의 확인 기록도 함께 지워지고 되돌릴 수 없어요.',
      confirmLabel: '지우기',
      cancelLabel: '취소',
      variant: 'danger',
    })
    if (!ok) return
    const form = new FormData()
    form.set('id', id)
    startTransition(() => run(form))
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="outline" data-color="danger" isPending={pending} onPress={onPress}>
        <Trash />
        {pending ? '지우는 중…' : '공지 지우기'}
      </Button>
      <ErrorAlert state={state} />
    </div>
  )
}
