import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
  
  
} from '@dnd-kit/core'
import type {DragEndEvent, DragStartEvent} from '@dnd-kit/core';
import { Link } from '@tanstack/react-router'
import { CheckSquare, GitPullRequest, GripVertical, Plus } from 'lucide-react'
import type { ContributionListItem } from '#/server/services/contribution.service'
import {
  PERSONAL_STATUSES,
  PERSONAL_STATUS_META
  
} from '#/shared/constants'
import type {PersonalStatus} from '#/shared/constants';
import { cn, formatRelativeDate } from '#/lib/utils'
import {
  ContributionTypeBadge,
  EffortBadge,
  PriorityBadge,
  UpstreamOutcomeBadge,
} from './status-badges'

interface KanbanBoardProps {
  items: ContributionListItem[]
  onMoveStatus: (id: string, nextStatus: PersonalStatus) => void
  onQuickAddInColumn: (status: PersonalStatus) => void
}

function KanbanCardContent({
  item,
  dragging = false,
}: {
  item: ContributionListItem
  dragging?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-card p-3 space-y-2 shadow-2xs transition-shadow',
        dragging && 'shadow-lg ring-2 ring-ring rotate-[0.5deg]',
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <Link
          to="/contributions/$contributionId"
          params={{ contributionId: item.id }}
          className="text-xs font-medium text-foreground hover:text-ring hover:underline leading-snug line-clamp-2 flex-1"
          onClick={(e) => e.stopPropagation()}
        >
          {item.title}
        </Link>
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
      </div>

      {item.repository && (
        <div className="font-mono text-[11px] text-muted-foreground truncate">
          {item.repository.fullName}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1">
        <PriorityBadge priority={item.priority} className="text-[10px] px-1.5" />
        <ContributionTypeBadge
          type={item.contributionType}
          className="text-[10px] px-1.5"
        />
        <EffortBadge effort={item.estimatedEffort} className="text-[10px] px-1.5" />
        <UpstreamOutcomeBadge
          outcome={item.upstreamOutcome}
          className="text-[10px] px-1.5"
        />
      </div>

      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/60">
        <div className="flex items-center gap-2">
          {item.checklistSummary.total > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckSquare className="h-3 w-3" />
              {item.checklistSummary.completed}/{item.checklistSummary.total}
            </span>
          )}
          {item.githubReferences.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <GitPullRequest className="h-3 w-3" />
              {item.githubReferences.length}
            </span>
          )}
        </div>
        <span>{formatRelativeDate(item.updatedAt)}</span>
      </div>
    </div>
  )
}

function DraggableKanbanCard({ item }: { item: ContributionListItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { status: item.personalStatus },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'cursor-grab active:cursor-grabbing touch-none',
        isDragging && 'opacity-35',
      )}
    >
      <KanbanCardContent item={item} />
    </div>
  )
}

function KanbanColumn({
  status,
  items,
  onQuickAdd,
}: {
  status: PersonalStatus
  items: ContributionListItem[]
  onQuickAdd: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const meta = PERSONAL_STATUS_META[status]

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-[280px] shrink-0 flex-col rounded-lg border border-border bg-muted/40 transition-colors',
        isOver && 'border-ring bg-ring/5',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('h-2 w-2 rounded-full shrink-0', meta.dotClass)} />
          <h3 className="text-xs font-semibold truncate">{meta.label}</h3>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {items.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onQuickAdd}
          title={`Add to ${meta.label}`}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 space-y-2 p-2 min-h-[220px] max-h-[calc(100vh-280px)] overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-border/70 text-[11px] text-muted-foreground">
            Drop here
          </div>
        ) : (
          items.map((item) => <DraggableKanbanCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  )
}

export function KanbanBoard({
  items,
  onMoveStatus,
  onQuickAddInColumn,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const itemId = String(active.id)
    const targetStatus = String(over.id) as PersonalStatus
    const currentItem = items.find((i) => i.id === itemId)
    if (!currentItem || currentItem.personalStatus === targetStatus) return

    if (PERSONAL_STATUSES.includes(targetStatus)) {
      onMoveStatus(itemId, targetStatus)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PERSONAL_STATUSES.map((status) => {
          const columnItems = items
            .filter((item) => item.personalStatus === status)
            .sort((a, b) => a.kanbanPosition - b.kanbanPosition)

          return (
            <KanbanColumn
              key={status}
              status={status}
              items={columnItems}
              onQuickAdd={() => onQuickAddInColumn(status)}
            />
          )
        })}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="w-[264px]">
            <KanbanCardContent item={activeItem} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
