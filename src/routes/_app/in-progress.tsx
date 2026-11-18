import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  GitPullRequest,
  Plus,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  listContributionsFn,
  moveContributionStatusFn,
} from '#/server/functions/contributions.fn'
import { useWorkspaceModals } from '#/components/layout/workspace-modals-context'
import type { PersonalStatus } from '#/shared/constants'
import { formatRelativeDate } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { EmptyState } from '#/components/ui/empty-state'
import {
  ContributionTypeBadge,
  EffortBadge,
  PriorityBadge,
  UpstreamOutcomeBadge,
} from '#/components/contributions/status-badges'

export const Route = createFileRoute('/_app/in-progress')({
  component: InProgressPage,
})

function InProgressPage() {
  const queryClient = useQueryClient()
  const { openQuickCapture } = useWorkspaceModals()

  const { data, isLoading } = useQuery({
    queryKey: ['contributions', 'in_progress'],
    queryFn: () =>
      listContributionsFn({
        data: {
          statuses: ['in_progress'],
          sortBy: 'priority',
          sortDir: 'desc',
          pageSize: 100,
        },
      }),
  })

  const moveMutation = useMutation({
    mutationFn: (vars: { id: string; personalStatus: PersonalStatus }) =>
      moveContributionStatusFn({ data: vars }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(`Moved to ${vars.personalStatus.replaceAll('_', ' ')}`)
    },
  })

  const items = data?.items ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">In Progress</h1>
          <p className="text-xs text-muted-foreground">
            Focused view of contributions you are actively implementing.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => openQuickCapture({ status: 'in_progress' })}
        >
          <Plus className="h-3.5 w-3.5" />
          New Active Contribution
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-4 w-4" />}
          title="Nothing currently in progress"
          description="Pick an opportunity from your Ready backlog to focus on implementing it."
          action={
            <Link to="/backlog" search={{ view: 'priority' }}>
              <Button size="sm" variant="outline">
                Browse Priority Queue
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="min-w-0 space-y-1.5">
                <Link
                  to="/contributions/$contributionId"
                  params={{ contributionId: item.id }}
                  className="text-sm font-semibold hover:text-ring hover:underline block truncate"
                >
                  {item.title}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {item.repository && (
                    <Link
                      to="/repositories/$repoId"
                      params={{ repoId: item.repository.id }}
                      className="font-mono text-[11px] hover:text-foreground"
                    >
                      {item.repository.fullName}
                    </Link>
                  )}
                  <PriorityBadge priority={item.priority} />
                  <ContributionTypeBadge type={item.contributionType} />
                  <EffortBadge effort={item.estimatedEffort} />
                  <UpstreamOutcomeBadge outcome={item.upstreamOutcome} />
                  {item.checklistSummary.total > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px]">
                      <CheckSquare className="h-3 w-3" />
                      {item.checklistSummary.completed}/
                      {item.checklistSummary.total} subtasks
                    </span>
                  )}
                  <span className="text-[11px]">
                    · Updated {formatRelativeDate(item.updatedAt)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Link
                  to="/contributions/$contributionId"
                  params={{ contributionId: item.id }}
                >
                  <Button size="sm" variant="outline">
                    Open Workspace
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={moveMutation.isPending}
                  onClick={() =>
                    moveMutation.mutate({
                      id: item.id,
                      personalStatus: 'pr_submitted',
                    })
                  }
                >
                  <GitPullRequest className="h-3.5 w-3.5" />
                  PR Submitted
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={moveMutation.isPending}
                  onClick={() =>
                    moveMutation.mutate({
                      id: item.id,
                      personalStatus: 'completed',
                    })
                  }
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Done
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
