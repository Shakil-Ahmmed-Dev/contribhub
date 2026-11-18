import {
  CONTRIBUTION_TYPE_LABELS,
  ESTIMATED_EFFORT_LABELS,
  PERSONAL_STATUS_META,
  PRIORITY_META,
  UPSTREAM_OUTCOME_META
  
  
  
  
  
  
} from '#/shared/constants'
import type {ContributionType, EstimatedEffort, GithubExternalStatus, PersonalStatus, Priority, UpstreamOutcome} from '#/shared/constants';
import { Badge } from '#/components/ui/badge'
import { cn } from '#/lib/utils'

export function PersonalStatusBadge({
  status,
  className,
}: {
  status: PersonalStatus
  className?: string
}) {
  const meta = PERSONAL_STATUS_META[status]
  return (
    <Badge className={cn(meta.badgeClass, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dotClass)} />
      {meta.label}
    </Badge>
  )
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority
  className?: string
}) {
  const meta = PRIORITY_META[priority]
  return <Badge className={cn(meta.badgeClass, className)}>{meta.label}</Badge>
}

export function ContributionTypeBadge({
  type,
  className,
}: {
  type: ContributionType
  className?: string
}) {
  return (
    <Badge variant="muted" className={className}>
      {CONTRIBUTION_TYPE_LABELS[type]}
    </Badge>
  )
}

export function EffortBadge({
  effort,
  className,
}: {
  effort: EstimatedEffort | null
  className?: string
}) {
  if (!effort) return null
  return (
    <Badge variant="outline" className={cn('font-mono text-[11px]', className)}>
      {ESTIMATED_EFFORT_LABELS[effort]}
    </Badge>
  )
}

export function UpstreamOutcomeBadge({
  outcome,
  className,
}: {
  outcome: UpstreamOutcome
  className?: string
}) {
  if (outcome === 'none') return null
  const meta = UPSTREAM_OUTCOME_META[outcome]
  return <Badge className={cn(meta.badgeClass, className)}>{meta.label}</Badge>
}

export function GithubStatusBadge({
  status,
  isDraft,
  className,
}: {
  status: GithubExternalStatus | string
  isDraft?: boolean
  className?: string
}) {
  if (status === 'merged') {
    return (
      <Badge
        className={cn(
          'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
          className,
        )}
      >
        Merged
      </Badge>
    )
  }
  if (status === 'open') {
    return (
      <Badge
        className={cn(
          isDraft
            ? 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30'
            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
          className,
        )}
      >
        {isDraft ? 'Draft' : 'Open'}
      </Badge>
    )
  }
  if (status === 'closed') {
    return (
      <Badge
        className={cn(
          'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25',
          className,
        )}
      >
        Closed
      </Badge>
    )
  }
  return (
    <Badge variant="muted" className={className}>
      Unknown
    </Badge>
  )
}
