import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { ContributionListItem } from '#/server/services/contribution.service'
import { PRIORITIES, PRIORITY_META } from '#/shared/constants'
import { formatRelativeDate } from '#/lib/utils'
import {
  ContributionTypeBadge,
  EffortBadge,
  PersonalStatusBadge,
  PriorityBadge,
} from './status-badges'

interface PriorityViewProps {
  items: ContributionListItem[]
}

const STATUS_ACTIONABILITY_RANK: Record<string, number> = {
  in_progress: 1,
  ready: 2,
  researching: 3,
  inbox: 4,
  pr_submitted: 5,
  completed: 6,
  abandoned: 7,
}

export function PriorityView({ items }: PriorityViewProps) {
  const actionable = items.filter(
    (i) => i.personalStatus !== 'completed' && i.personalStatus !== 'abandoned',
  )

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Showing open opportunities ordered by priority and readiness so you can
        immediately pick what to tackle next.
      </p>

      {PRIORITIES.map((priority) => {
        const groupItems = actionable
          .filter((i) => i.priority === priority)
          .sort(
            (a, b) =>
              (STATUS_ACTIONABILITY_RANK[a.personalStatus] ?? 99) -
              (STATUS_ACTIONABILITY_RANK[b.personalStatus] ?? 99),
          )

        if (groupItems.length === 0) return null

        return (
          <div
            key={priority}
            className="rounded-lg border border-border bg-card overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
              <div className="flex items-center gap-2">
                <PriorityBadge priority={priority} />
                <span className="text-xs text-muted-foreground">
                  {PRIORITY_META[priority].label} Priority ({groupItems.length})
                </span>
              </div>
            </div>

            <div className="divide-y divide-border">
              {groupItems.map((item) => (
                <Link
                  key={item.id}
                  to="/contributions/$contributionId"
                  params={{ contributionId: item.id }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 hover:bg-accent/40 transition-colors"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-sm font-medium truncate">
                      {item.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono text-[11px]">
                        {item.repository?.fullName ?? 'Unassigned'}
                      </span>
                      <span>·</span>
                      <span>{formatRelativeDate(item.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <EffortBadge effort={item.estimatedEffort} />
                    <ContributionTypeBadge type={item.contributionType} />
                    <PersonalStatusBadge status={item.personalStatus} />
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
