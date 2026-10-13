import type { ReactNode } from 'react'
import { Chip } from '@heroui/react'
import { WarningCircle } from '@phosphor-icons/react/ssr'
import { formatCount } from '@/lib/supply'
import type { SupplyRow } from '@/lib/supply-store'

/**
 * 비품 목록의 한 줄 — 이름, 재고 / 최소 재고, 지급 대기 수량.
 * 재고가 최소 재고 아래면 「부족」 표시가 붙어요. 오른쪽 칸(신청 · 입고)은 화면마다 달라서 actions 로 받아요.
 */
export function SupplyItem({ item, actions, below }: { item: SupplyRow; actions?: ReactNode; below?: ReactNode }) {
  return (
    <li className="flex flex-col gap-3 border-b border-default py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="t-small flex flex-wrap items-center gap-2 font-semibold">
            <span className="break-words">{item.name}</span>
            {item.short && (
              <Chip size="sm" color="danger">
                <WarningCircle size={16} weight="fill" />
                부족
              </Chip>
            )}
          </p>
          <p className="t-small flex flex-wrap gap-x-3">
            <span className={item.short ? 'font-semibold text-danger' : 'font-semibold'}>재고 {formatCount(item.stock)}</span>
            <span className="text-muted">최소 {formatCount(item.min_stock)}</span>
            {item.pending_qty > 0 && <span className="text-muted">지급 대기 {formatCount(item.pending_qty)}</span>}
          </p>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {below}
    </li>
  )
}
