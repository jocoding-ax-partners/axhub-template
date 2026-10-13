'use client'

// 브라우저 쪽 폼 모음. 검사·권한은 서버(app/actions.ts)에서 다시 해요 — 여기선 입력을 돕기만 해요.
// 폼은 onSubmit 에서 직접 보내요: React 19 의 <form action> 은 결과와 상관없이 입력칸을 비워서,
// 오류가 났을 때 적은 내용이 사라지거든요.
import { startTransition, useActionState, useEffect, useOptimistic, useState, type FormEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Alert, Button, Checkbox, FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { FloppyDisk, Plus, Trash, UserPlus } from '@phosphor-icons/react'
import { useConfirm } from '@/components/ax'
import {
  addHire,
  addTemplate,
  deleteHire,
  deleteTemplate,
  saveItemMemo,
  setItemDone,
  updateHire,
  type FormState,
} from '@/app/actions'
import { DEPARTMENT_MAX, MEMO_MAX, NAME_MAX, TITLE_MAX } from '@/lib/onboarding'

function ErrorAlert({ state }: { state: FormState | null }) {
  if (!state || state.ok) return null
  return (
    <Alert status="danger" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{state.message}</Alert.Description>
      </Alert.Content>
    </Alert>
  )
}

type Action = (prev: FormState | null, form: FormData) => Promise<FormState>

/** useActionState 에 「성공하면 알림(오른쪽 위) + onOk」 를 더한 것. */
function useToastAction(action: Action, onOk?: () => void) {
  return useActionState<FormState | null, FormData>(async (prev, form) => {
    const r = await action(prev, form)
    if (r.ok) {
      toast.success(r.message)
      onOk?.()
    }
    return r
  }, null)
}

const submitWith = (dispatch: (fd: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  const data = new FormData(e.currentTarget)
  startTransition(() => dispatch(data))
}

type HireValues = { id: string; name: string; department: string; startDate: string }

/** 입사자 등록(hire 없음) · 정보 고치기(hire 있음). 등록하면 그 사람의 체크리스트 화면으로 넘어가요. */
export function HireForm({ hire }: { hire?: HireValues }) {
  const [state, dispatch, pending] = useToastAction(hire ? updateHire : addHire)

  return (
    <form onSubmit={submitWith(dispatch)} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {hire && <input type="hidden" name="id" value={hire.id} />}
      <TextField name="name" isRequired maxLength={NAME_MAX} defaultValue={hire?.name}>
        <Label>이름</Label>
        <Input placeholder="예: 김하나" />
        <FieldError />
      </TextField>
      <TextField name="department" isRequired maxLength={DEPARTMENT_MAX} defaultValue={hire?.department}>
        <Label>부서</Label>
        <Input placeholder="예: 개발팀" />
        <FieldError />
      </TextField>
      <TextField name="start_date" type="date" isRequired defaultValue={hire?.startDate}>
        <Label>입사일</Label>
        <Input />
        <FieldError />
      </TextField>
      <div className="flex flex-col gap-3 sm:col-span-3">
        <ErrorAlert state={state} />
        <div>
          <Button type="submit" isPending={pending} variant={hire ? 'outline' : 'primary'}>
            {hire ? <FloppyDisk /> : <UserPlus />}
            {hire ? (pending ? '저장하는 중…' : '정보 저장') : pending ? '등록하는 중…' : '등록하기'}
          </Button>
        </div>
      </div>
    </form>
  )
}

type ItemValues = { id: string; title: string; done: boolean; memo: string; updatedLabel: string | null }

/** 체크리스트 한 줄 — 체크는 누르는 즉시 저장, 메모는 「저장」을 눌러 저장해요. */
export function ChecklistItem({ item }: { item: ItemValues }) {
  const [doneState, dispatchDone] = useActionState(setItemDone, null)
  const [memoState, dispatchMemo, memoPending] = useToastAction(saveItemMemo)
  const [done, setOptimisticDone] = useOptimistic(item.done)
  const [memo, setMemo] = useState(item.memo)
  const error = doneState && !doneState.ok ? doneState : memoState

  function toggle(next: boolean) {
    const data = new FormData()
    data.set('id', item.id)
    data.set('done', String(next))
    startTransition(() => {
      setOptimisticDone(next)
      dispatchDone(data)
    })
  }

  return (
    <li className="flex flex-col gap-3 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0">
      <Checkbox isSelected={done} onChange={toggle} aria-label={`${item.title} 완료`}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Label className={done ? 'text-muted line-through' : undefined}>{item.title}</Label>
        </Checkbox.Content>
      </Checkbox>
      <form onSubmit={submitWith(dispatchMemo)} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <input type="hidden" name="id" value={item.id} />
        <TextField name="memo" maxLength={MEMO_MAX} value={memo} onChange={setMemo} aria-label={`${item.title} 메모`} className="flex-1">
          <Input placeholder="메모" />
        </TextField>
        <Button type="submit" variant="outline" size="sm" className="sm:mt-1" isPending={memoPending} isDisabled={memo.trim() === item.memo}>
          <FloppyDisk />
          메모 저장
        </Button>
      </form>
      {item.updatedLabel && <p className="t-caption">마지막 수정 · {item.updatedLabel}</p>}
      <ErrorAlert state={error} />
    </li>
  )
}

/** 입사자 삭제 (관리자만 보여요). 한 번 더 묻고, 지우면 목록으로 돌아가요. */
export function DeleteHireButton({ id, name }: { id: string; name: string }) {
  const confirm = useConfirm()
  const [state, dispatch, pending] = useActionState(deleteHire, null)

  async function onPress() {
    const ok = await confirm({
      title: `${name}님을 지울까요?`,
      description: '체크리스트와 메모도 함께 지워지고, 되돌릴 수 없어요.',
      confirmLabel: '삭제',
      variant: 'danger',
    })
    if (!ok) return
    const data = new FormData()
    data.set('id', id)
    startTransition(() => dispatch(data))
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button variant="outline" data-color="danger" isPending={pending} onPress={onPress}>
          <Trash />
          입사자 삭제
        </Button>
      </div>
      <ErrorAlert state={state} />
    </div>
  )
}

/** 기본 체크리스트 관리 (관리자만 보여요) — 항목 추가 · 삭제. */
export function TemplateManager({ templates, max }: { templates: { id: string; title: string }[]; max: number }) {
  const confirm = useConfirm()
  const [formKey, setFormKey] = useState(0)
  // 추가에 성공하면 key 를 바꿔 입력칸을 비워요.
  const [addState, dispatchAdd, adding] = useToastAction(addTemplate, () => setFormKey((k) => k + 1))
  const [delState, dispatchDel, deleting] = useToastAction(deleteTemplate)
  const full = templates.length >= max

  async function remove(t: { id: string; title: string }) {
    const ok = await confirm({
      title: `"${t.title}" 항목을 지울까요?`,
      description: '앞으로 등록하는 입사자에게 이 항목이 붙지 않아요. 이미 등록한 입사자의 체크리스트는 그대로예요.',
      confirmLabel: '삭제',
      variant: 'danger',
    })
    if (!ok) return
    const data = new FormData()
    data.set('id', t.id)
    startTransition(() => dispatchDel(data))
  }

  return (
    <div className="flex flex-col gap-6">
      {templates.length === 0 ? (
        <p className="t-small text-muted">항목이 없어요. 지금 입사자를 등록하면 빈 체크리스트가 붙어요.</p>
      ) : (
        <ol className="list-none p-0">
          {templates.map((t, i) => (
            <li key={t.id} className="flex items-center justify-between gap-3 border-b border-default py-3 first:pt-0 last:border-0 last:pb-0">
              <span className="t-small min-w-0 break-words">
                <span className="text-muted">{i + 1}.</span> {t.title}
              </span>
              <Button variant="ghost" size="sm" isIconOnly aria-label={`${t.title} 삭제`} isDisabled={deleting} onPress={() => remove(t)}>
                <Trash />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <ErrorAlert state={delState} />
      <form key={formKey} onSubmit={submitWith(dispatchAdd)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <TextField name="title" isRequired maxLength={TITLE_MAX} isDisabled={full} className="flex-1">
            <Label>새 항목</Label>
            <Input placeholder="예: 복지 제도 안내" />
          </TextField>
          <Button type="submit" isPending={adding} isDisabled={full}>
            <Plus />
            추가
          </Button>
        </div>
        {full && <p className="t-caption">기본 항목은 {max}개까지 둘 수 있어요. 하나를 지운 뒤 추가해 주세요.</p>}
        <ErrorAlert state={addState} />
      </form>
    </div>
  )
}

/** 다른 화면에서 넘어오며 남긴 결과(?created=1 등)를 알림으로 한 번 보여 주고 주소에서 지워요. */
export function FlashToast({ message }: { message: string }) {
  const router = useRouter()
  const path = usePathname()
  useEffect(() => {
    toast.success(message)
    router.replace(path, { scroll: false })
  }, [message, path, router])
  return null
}
