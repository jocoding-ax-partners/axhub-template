'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Alert, Button, Card, Description, FieldError, Label, Radio, RadioGroup, TextArea, TextField, toast } from '@heroui/react'
import { PaperPlaneTilt } from '@phosphor-icons/react'
import { submitResponse, type FormState } from '@/app/actions'
import { ANSWER_MAX, type QuestionKind } from '@/lib/survey'

type Question = { id: string; kind: QuestionKind; prompt: string; options: string[] }

/**
 * 응답 폼. 객관식은 꼭 골라야 하고, 주관식은 비워 둘 수 있어요.
 * 검사는 서버(app/actions.ts)에서 다시 해요. 보내고 나면 화면이 "응답해 주셔서 고마워요" 로 바뀌어요.
 */
export function ResponseForm({ surveyId, questions }: { surveyId: string; questions: Question[] }) {
  const [error, setError] = useState<FormState | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await submitResponse(null, data)
      if (r.ok) toast.success(r.message)
      else setError(r)
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="survey_id" value={surveyId} />
      {questions.map((q, i) => (
        <Card key={q.id}>
          <Card.Content>
            {q.kind === 'choice' ? (
              <RadioGroup name={`q_${q.id}`} isRequired>
                <Label className="t-card-title">
                  {i + 1}. {q.prompt}
                </Label>
                <div className="mt-2 flex flex-col gap-3">
                  {q.options.map((o, j) => (
                    <Radio key={j} value={String(j)}>
                      <Radio.Content>
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <span className="t-small break-words">{o}</span>
                      </Radio.Content>
                    </Radio>
                  ))}
                </div>
                <FieldError>하나를 골라 주세요.</FieldError>
              </RadioGroup>
            ) : (
              <TextField name={`q_${q.id}`} maxLength={ANSWER_MAX}>
                <Label className="t-card-title">
                  {i + 1}. {q.prompt}
                </Label>
                <TextArea rows={4} className="mt-2" placeholder="자유롭게 적어 주세요." />
                <Description>선택 문항이에요. {ANSWER_MAX}자까지 적을 수 있어요.</Description>
              </TextField>
            )}
          </Card.Content>
        </Card>
      ))}

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
          <PaperPlaneTilt />
          {pending ? '보내는 중…' : '응답 보내기'}
        </Button>
      </div>
    </form>
  )
}
