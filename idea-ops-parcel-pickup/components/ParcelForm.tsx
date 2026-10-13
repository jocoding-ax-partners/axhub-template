'use client'

import { startTransition, useActionState, useRef, useState, type FormEvent } from 'react'
import { Alert, Button, Description, FieldError, Input, Label, ListBox, Select, TextField, toast } from '@heroui/react'
import { Package } from '@phosphor-icons/react'
import { registerParcel, type FormState } from '@/app/actions'
import { EMAIL_MAX, KIND_LABEL, LOCATION_MAX, MEMO_MAX, NAME_MAX, SENDER_MAX } from '@/lib/parcel'

/**
 * 택배 등록 폼 (안내데스크 담당자). 검사는 서버(app/actions.ts)에서 다시 해요.
 * 실패하면 입력한 값이 그대로 남고, 성공하면 폼을 비워요.
 */
export function ParcelForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [kind, setKind] = useState('parcel')
  const [state, action, pending] = useActionState(async (prev: FormState | null, data: FormData) => {
    const r = await registerParcel(prev, data)
    if (r.ok) {
      toast.success(r.message)
      formRef.current?.reset()
      setKind('parcel')
    }
    return r
  }, null)

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // 브라우저 기본 제출(React 의 자동 폼 비우기 포함)을 막아요 — 실패했을 때 입력이 남아 있게요.
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(() => action(data))
  }

  const error = !pending && state && !state.ok ? state.message : ''

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <TextField name="recipient_name" maxLength={NAME_MAX}>
        <Label>받는 사람 이름</Label>
        <Input placeholder="예: 홍길동" />
        <Description>선택 · 목록에서 알아보기 쉬워요</Description>
      </TextField>

      <TextField name="recipient_email" type="email" isRequired maxLength={EMAIL_MAX}>
        <Label>받는 사람 이메일</Label>
        <Input placeholder="예: hong@company.com" autoComplete="off" />
        <Description>axhub 로그인 이메일이어야 그 사람 화면에 보여요</Description>
        <FieldError />
      </TextField>

      <Select name="kind" isRequired selectedKey={kind} onSelectionChange={(k) => setKind(String(k ?? 'parcel'))}>
        <Label>종류</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <ListBox.Item key={k} id={k} textValue={v}>
                {v}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <TextField name="sender" isRequired maxLength={SENDER_MAX}>
        <Label>보낸 곳</Label>
        <Input placeholder="예: 쿠팡, 국세청" />
        <FieldError />
      </TextField>

      <TextField name="location" isRequired maxLength={LOCATION_MAX}>
        <Label>보관 위치</Label>
        <Input placeholder="예: 안내데스크 선반 A-3" />
        <FieldError />
      </TextField>

      <TextField name="memo" maxLength={MEMO_MAX}>
        <Label>메모</Label>
        <Input placeholder="예: 냉장 보관 · 큰 상자 2개" />
        <Description>선택</Description>
      </TextField>

      <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-3">
        {error && (
          <Alert status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        <div>
          <Button type="submit" isPending={pending}>
            <Package />
            {pending ? '등록하는 중…' : '등록하기'}
          </Button>
        </div>
      </div>
    </form>
  )
}
