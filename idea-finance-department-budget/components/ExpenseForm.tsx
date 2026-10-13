'use client'

import { FieldError, Input, Label, ListBox, Select, TextField } from '@heroui/react'
import { Plus } from '@phosphor-icons/react'
import { addExpense } from '@/app/actions'
import { ActionForm } from '@/components/ActionForm'
import { DESC_MAX } from '@/lib/budget'
import type { Department } from '@/lib/budget-store'

/** 집행 건 입력 폼 — 부서 · 날짜 · 내용 · 금액. 부서는 내가 담당하는 곳만 보여요 (관리자는 전부). */
export function ExpenseForm({ departments, today }: { departments: Department[]; today: string }) {
  return (
    <ActionForm
      action={addExpense}
      submitLabel="집행 건 넣기"
      pendingLabel="넣는 중…"
      icon={<Plus />}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-start"
    >
      <Select name="department_id" isRequired defaultSelectedKey={departments.length === 1 ? departments[0].id : undefined} placeholder="부서 고르기">
        <Label>부서</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {departments.map((d) => (
              <ListBox.Item key={d.id} id={d.id} textValue={d.name}>
                {d.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <TextField name="spent_on" type="date" isRequired defaultValue={today}>
        <Label>집행 날짜</Label>
        <Input max={today} />
        <FieldError />
      </TextField>

      <TextField name="amount" isRequired inputMode="numeric">
        <Label>금액 (원)</Label>
        <Input placeholder="예: 1,200,000" />
        <FieldError />
      </TextField>

      <TextField name="description" isRequired maxLength={DESC_MAX}>
        <Label>내용</Label>
        <Input placeholder="예: 사무용품 구입" />
        <FieldError />
      </TextField>
    </ActionForm>
  )
}
