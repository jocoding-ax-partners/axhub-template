'use client'

import { Label, ListBox, Select } from '@heroui/react'

/**
 * 고르기 칸 (HeroUI Select). name 을 주면 폼 제출 때 고른 id 가 함께 가요.
 * value/onChange 를 주면 화면이 값을 쥐고, 없으면 defaultValue 로 시작해요 (검색 폼처럼 GET 으로 보낼 때).
 */
export function ChoiceSelect({
  name,
  label,
  options,
  value,
  defaultValue,
  onChange,
  isRequired = false,
}: {
  name: string
  label: string
  options: { id: string; label: string }[]
  value?: string
  defaultValue?: string
  onChange?: (v: string) => void
  isRequired?: boolean
}) {
  return (
    <Select
      name={name}
      isRequired={isRequired}
      {...(value !== undefined ? { selectedKey: value } : { defaultSelectedKey: defaultValue })}
      onSelectionChange={(k) => onChange?.(String(k ?? ''))}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
