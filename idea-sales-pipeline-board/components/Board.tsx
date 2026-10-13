'use client'

import { useOptimistic, useState, useTransition, type DragEvent } from 'react'
import Link from 'next/link'
import { Button, Dropdown, buttonVariants, toast } from '@heroui/react'
import { ArrowsLeftRight, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { moveDeal } from '@/app/actions'
import { STAGES, STAGE_LABEL, formatShortDate, formatWon, isOverdue, isStage, neighborStage, type Stage } from '@/lib/pipeline'
import type { DealRow, StageSummary } from '@/lib/pipeline-store'

type BoardState = { cards: DealRow[]; summary: StageSummary }
type Move = { id: string; to: Stage }

/** 카드 하나를 다른 단계로 — 열 위 건수·합계도 같이 옮겨요. */
function applyMove(state: BoardState, { id, to }: Move): BoardState {
  const card = state.cards.find((c) => c.id === id)
  if (!card || card.stage === to) return state
  const from = state.summary[card.stage]
  const dest = state.summary[to]
  return {
    cards: state.cards.map((c) => (c.id === id ? { ...c, stage: to } : c)),
    summary: {
      ...state.summary,
      [card.stage]: { count: from.count - 1, total: (BigInt(from.total) - BigInt(card.amount)).toString() },
      [to]: { count: dest.count + 1, total: (BigInt(dest.total) + BigInt(card.amount)).toString() },
    },
  }
}

/**
 * 단계 열 보드. 카드는 끌어다 놓거나(넓은 화면) 카드의 ◀ ▶ · 「옮기기」 로 옮겨요.
 * 화면이 먼저 바뀌고 저장은 뒤에서 돼요. 저장이 안 되면 알림을 띄우고 원래 자리로 돌아가요.
 */
export function Board({ cards, summary, today, q }: BoardState & { today: string; q: string }) {
  const [state, setOptimistic] = useOptimistic<BoardState, Move>({ cards, summary }, applyMove)
  const [, startTransition] = useTransition()
  const [dropTarget, setDropTarget] = useState<Stage | null>(null)

  function move(card: DealRow, to: Stage) {
    if (card.stage === to) return
    startTransition(async () => {
      setOptimistic({ id: card.id, to })
      const r = await moveDeal(card.id, card.stage, to)
      if (!r.ok) toast.danger(r.message)
    })
  }

  function onDrop(e: DragEvent, to: Stage) {
    e.preventDefault()
    setDropTarget(null)
    const card = state.cards.find((c) => c.id === e.dataTransfer.getData('text/plain'))
    if (card) move(card, to)
  }

  // 좁은 화면은 열을 옆으로 넘겨 봐요(보드 안에서만 가로 스크롤). 넓은 화면(1280px~)은 다섯 열이 한 줄에 다 보여요.
  return (
    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 xl:grid xl:grid-cols-5 xl:overflow-visible xl:pb-0">
      {STAGES.map((stage) => {
        const items = state.cards.filter((c) => c.stage === stage)
        const { count, total } = state.summary[stage]
        const hidden = count - items.length
        const moreHref = `/deals?${new URLSearchParams(q ? { stage, q } : { stage })}`
        return (
          <section
            key={stage}
            aria-labelledby={`stage-${stage}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDropTarget(stage)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null)
            }}
            onDrop={(e) => onDrop(e, stage)}
            className={`flex w-72 shrink-0 snap-start flex-col gap-3 rounded-card xl:w-auto xl:min-w-0 border bg-muted p-3 transition-colors ${
              dropTarget === stage ? 'border-primary bg-primary-soft' : 'border-default'
            }`}
          >
            <header className="flex flex-col gap-0.5 px-1">
              <div className="flex items-center justify-between gap-2">
                <h2 id={`stage-${stage}`} className="t-card-title">
                  {STAGE_LABEL[stage]}
                </h2>
                <span className="t-small font-semibold">{count}건</span>
              </div>
              <p className="t-caption tabular-nums">합계 {formatWon(total)}</p>
            </header>

            {items.length === 0 ? (
              <p className="t-caption rounded-lg border border-dashed border-default px-3 py-6 text-center">
                {q ? '찾는 거래가 없어요' : '여기로 카드를 끌어 놓을 수 있어요'}
              </p>
            ) : (
              <ul className="flex list-none flex-col gap-2 p-0">
                {items.map((card) => (
                  <DealCard key={card.id} card={card} today={today} onMove={(to) => move(card, to)} />
                ))}
              </ul>
            )}

            {hidden > 0 && (
              <Link href={moreHref} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                {hidden}건 더 보기
              </Link>
            )}
          </section>
        )
      })}
    </div>
  )
}

function DealCard({ card, today, onMove }: { card: DealRow; today: string; onMove: (to: Stage) => void }) {
  const prev = neighborStage(card.stage, -1)
  const next = neighborStage(card.stage, 1)
  const overdue = isOverdue(card.stage, card.expected_close, today)

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', card.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className="flex cursor-grab flex-col gap-1 rounded-lg border border-default bg-content p-3 active:cursor-grabbing"
    >
      <Link href={`/deals/${card.id}`} className="t-small break-words font-semibold text-default hover:underline">
        {card.company}
      </Link>
      <p className="t-small tabular-nums">{formatWon(card.amount)}</p>
      <p className="t-caption break-words">
        담당 {card.owner}
        {card.expected_close && (
          <>
            {' · '}
            <span className={overdue ? 'font-semibold text-danger' : undefined}>
              {formatShortDate(card.expected_close, today)} {overdue ? '지남' : '예정'}
            </span>
          </>
        )}
      </p>
      <div className="mt-1 flex items-center justify-between gap-1">
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          isDisabled={!prev}
          aria-label={prev ? `${card.company}: ${STAGE_LABEL[prev]} 단계로` : '첫 단계예요'}
          onPress={() => prev && onMove(prev)}
        >
          <CaretLeft weight="bold" />
        </Button>
        <Dropdown>
          <Dropdown.Trigger aria-label={`${card.company} 단계 옮기기`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <span className="flex items-center gap-1">
              <ArrowsLeftRight />
              옮기기
            </span>
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom">
            <Dropdown.Menu
              aria-label="옮길 단계"
              disabledKeys={[card.stage]}
              onAction={(k) => {
                const to = String(k)
                if (isStage(to)) onMove(to)
              }}
            >
              {STAGES.map((s) => (
                <Dropdown.Item key={s} id={s} textValue={STAGE_LABEL[s]}>
                  {s === card.stage ? `${STAGE_LABEL[s]} (지금)` : STAGE_LABEL[s]}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          isDisabled={!next}
          aria-label={next ? `${card.company}: ${STAGE_LABEL[next]} 단계로` : '마지막 단계예요'}
          onPress={() => next && onMove(next)}
        >
          <CaretRight weight="bold" />
        </Button>
      </div>
    </li>
  )
}
