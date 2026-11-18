import { Link } from '@tanstack/react-router'
import { FolderGit2, Plus } from 'lucide-react'
import type { ContributionListItem } from '#/server/services/contribution.service'
import { formatRelativeDate } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import {
  ContributionTypeBadge,
  EffortBadge,
  PersonalStatusBadge,
  PriorityBadge,
  UpstreamOutcomeBadge,
} from './status-badges'

interface RepoGroupViewProps {
  items: ContributionListItem[]
  onQuickAddForRepo: (repoId: string | null) => void
}

export function RepoGroupView({
  items,
  onQuickAddForRepo,
}: RepoGroupViewProps) {
  const groups = new Map<
    string,
    {
      repoId: string | null
      fullName: string
      language: string | null
      items: ContributionListItem[]
    }
  >()

  for (const item of items) {
    const key = item.repository?.id ?? '__unassigned__'
    const existing = groups.get(key) ?? {
      repoId: item.repository?.id ?? null,
      fullName: item.repository?.fullName ?? 'Unassigned Repository',
      language: item.repository?.language ?? null,
      items: [],
    }
    existing.items.push(item)
    groups.set(key, existing)
  }

  const sortedGroups = [...groups.values()].sort((a, b) => {
    if (!a.repoId) return 1
    if (!b.repoId) return -1
    return b.items.length - a.items.length
  })

  return (
    <div className="space-y-4">
      {sortedGroups.map((group) => (
        <div
          key={group.repoId ?? 'unassigned'}
          className="rounded-lg border border-border bg-card overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <FolderGit2 className="h-4 w-4 text-muted-foreground shrink-0" />
              {group.repoId ? (
                <Link
                  to="/repositories/$repoId"
                  params={{ repoId: group.repoId }}
                  className="font-mono text-sm font-semibold hover:text-ring hover:underline truncate"
                >
                  {group.fullName}
                </Link>
              ) : (
                <span className="text-sm font-semibold text-muted-foreground italic">
                  {group.fullName}
                </span>
              )}
              {group.language && (
                <span className="text-[11px] text-muted-foreground">
                  · {group.language}
                </span>
              )}
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                {group.items.length}
              </span>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => onQuickAddForRepo(group.repoId)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>

          <div className="divide-y divide-border">
            {group.items.map((item) => (
              <Link
                key={item.id}
                to="/contributions/$contributionId"
                params={{ contributionId: item.id }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 hover:bg-accent/40 transition-colors"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm font-medium truncate">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Updated {formatRelativeDate(item.updatedAt)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <EffortBadge effort={item.estimatedEffort} />
                  <ContributionTypeBadge type={item.contributionType} />
                  <PriorityBadge priority={item.priority} />
                  <PersonalStatusBadge status={item.personalStatus} />
                  <UpstreamOutcomeBadge outcome={item.upstreamOutcome} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
