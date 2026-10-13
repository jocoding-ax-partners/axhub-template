'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Card, Description, FieldError, Input, Label, ListBox, Select, TextArea, TextField, toast } from '@heroui/react'
import { ArrowDown, ArrowUp, Check, Plus, Trash, X } from '@phosphor-icons/react'
import { useConfirm } from '@/components/ax'
import { createSurvey, type FormState } from '@/app/actions'
import {
  DESCRIPTION_MAX,
  KIND_LABEL,
  OPTIONS_MAX,
  OPTIONS_MIN,
  OPTION_MAX,
  PROMPT_MAX,
  QUESTIONS_MAX,
  TITLE_MAX,
  type QuestionKind,
} from '@/lib/survey'

type Draft = { key: number; kind: QuestionKind; prompt: string; options: string[] }

let nextKey = 0
const blank = (kind: QuestionKind = 'choice'): Draft => ({ key: nextKey++, kind, prompt: '', options: kind === 'choice' ? ['', ''] : [] })

/** 새 설문 폼 — 문항을 더하고 빼고 순서를 바꿔요. 검사는 서버(app/actions.ts)에서 다시 해요. */
export function SurveyBuilder() {
  const router = useRouter()
  const confirm = useConfirm()
  const [questions, setQuestions] = useState<Draft[]>(() => [blank()])
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()

  const update = (key: number, patch: Partial<Draft>) => setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)))
  const move = (i: number, to: number) =>
    setQuestions((qs) => {
      const next = [...qs]
      ;[next[i], next[to]] = [next[to], next[i]]
      return next
    })

  async function remove(q: Draft, n: number) {
    const filled = q.prompt.trim() || q.options.some((o) => o.trim())
    if (filled) {
      const ok = await confirm({ title: `${n}번 문항을 뺄까요?`, description: '적어 둔 질문과 보기가 사라져요.', confirmLabel: '빼기', variant: 'danger' })
      if (!ok) return
    }
    setQuestions((qs) => qs.filter((x) => x.key !== q.key))
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    data.set('questions', JSON.stringify(questions.map(({ kind, prompt, options }) => ({ kind, prompt, options }))))
    startTransition(async () => {
      const r = await createSurvey(null, data)
      if (r.ok && r.id) {
        toast.success(r.message)
        router.push(`/admin/surveys/${r.id}`)
      } else {
        setError(r)
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Card>
        <Card.Header>
          <Card.Title>설문 정보</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <TextField name="title" isRequired maxLength={TITLE_MAX}>
            <Label>설문 제목</Label>
            <Input placeholder="예: 10월 고객 만족도 설문" />
            <FieldError />
          </TextField>
          <TextField name="description" maxLength={DESCRIPTION_MAX}>
            <Label>안내 문구 (선택)</Label>
            <TextArea rows={3} placeholder="예: 3분이면 끝나요. 응답은 이름 없이 모아서 봐요." />
            <Description>응답 화면 맨 위에 보여요.</Description>
          </TextField>
        </Card.Content>
      </Card>

      {questions.map((q, i) => (
        <Card key={q.key}>
          <Card.Header>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Card.Title>{i + 1}번 문항</Card.Title>
              <div className="flex items-center gap-1">
                <Button isIconOnly size="sm" variant="ghost" aria-label={`${i + 1}번 문항을 위로`} isDisabled={i === 0} onPress={() => move(i, i - 1)}>
                  <ArrowUp />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label={`${i + 1}번 문항을 아래로`}
                  isDisabled={i === questions.length - 1}
                  onPress={() => move(i, i + 1)}
                >
                  <ArrowDown />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  data-color="danger"
                  aria-label={`${i + 1}번 문항 빼기`}
                  isDisabled={questions.length === 1}
                  onPress={() => remove(q, i + 1)}
                >
                  <Trash />
                </Button>
              </div>
            </div>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_1fr]">
              <Select
                selectedKey={q.kind}
                onSelectionChange={(k) => {
                  const kind = k === 'text' ? 'text' : 'choice'
                  update(q.key, { kind, options: kind === 'choice' && q.options.length < OPTIONS_MIN ? ['', ''] : q.options })
                }}
              >
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
              <TextField isRequired maxLength={PROMPT_MAX} value={q.prompt} onChange={(v) => update(q.key, { prompt: v })}>
                <Label>질문</Label>
                <Input placeholder={q.kind === 'choice' ? '예: 상담 서비스에 얼마나 만족하셨나요?' : '예: 더 나아졌으면 하는 점을 알려 주세요.'} />
                <FieldError />
              </TextField>
            </div>

            {q.kind === 'choice' ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="t-small mb-2 font-semibold">
                  보기 <span className="font-normal text-muted">({OPTIONS_MIN}~{OPTIONS_MAX}개)</span>
                </legend>
                {q.options.map((o, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <TextField
                      aria-label={`${i + 1}번 문항 ${j + 1}번 보기`}
                      isRequired={j < OPTIONS_MIN}
                      maxLength={OPTION_MAX}
                      value={o}
                      onChange={(v) => update(q.key, { options: q.options.map((x, k) => (k === j ? v : x)) })}
                      className="flex-1"
                    >
                      <Input placeholder={`보기 ${j + 1}`} />
                      <FieldError />
                    </TextField>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      className="mt-1"
                      aria-label={`${j + 1}번 보기 빼기`}
                      isDisabled={q.options.length <= OPTIONS_MIN}
                      onPress={() => update(q.key, { options: q.options.filter((_, k) => k !== j) })}
                    >
                      <X />
                    </Button>
                  </div>
                ))}
                <div>
                  <Button size="sm" variant="ghost" isDisabled={q.options.length >= OPTIONS_MAX} onPress={() => update(q.key, { options: [...q.options, ''] })}>
                    <Plus />
                    보기 추가
                  </Button>
                </div>
              </fieldset>
            ) : (
              <p className="t-small text-muted">응답자가 글로 자유롭게 적어요. 비워 둬도 응답할 수 있어요.</p>
            )}
          </Card.Content>
        </Card>
      ))}

      <div>
        <Button variant="outline" isDisabled={questions.length >= QUESTIONS_MAX} onPress={() => setQuestions((qs) => [...qs, blank()])}>
          <Plus />
          문항 추가
        </Button>
      </div>

      {error && !pending && (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error.message}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      <div>
        <Button type="submit" isPending={pending}>
          <Check />
          {pending ? '만드는 중…' : '설문 만들기'}
        </Button>
      </div>
    </form>
  )
}
