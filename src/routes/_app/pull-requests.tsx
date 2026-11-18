import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  CheckCircle2,
  ExternalLink,
  GitPullRequest,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  listUserPullRequestsFn,
  syncAllOpenReferencesFn,
  syncGithubReferenceFn,
} from '#/server/functions/github.fn'
import { moveContributionStatusFn } from '#/server/functions/contributions.fn'
import { formatRelativeDate, formatShortDate } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { EmptyState } from '#/components/ui/empty-state'
import {
  GithubStatusBadge,
  PersonalStatusBadge,
} from '#/components/contributions/status-badges'

export const Route = createFileRoute('/_app/pull-requests')({
  component: PullRequestsPage,
})

function PullRequestsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'open' | 'merged' | 'closed'>('all')
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const { data: prs = [], isLoading } = useQuery({
    queryKey: ['pull-requests'],
    queryFn: () => listUserPullRequestsFn(),
  })

  const syncOneMutation = useMutation({
    mutationFn: (id: string) => syncGithubReferenceFn({ data: { id } }),
    onMutate: (id) => setSyncingId(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
      queryClient.invalidateQueries({ queryKey: ['contributions'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
      if (res.suggestPersonalCompletion) {
        toast.success('PR merged on GitHub! You can mark this contribution Completed.')
      } else {
        toast.success(res.changed ? 'PR status updated' : 'PR is up to date')
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    },
    onSettled: () => setSyncingId(null),
  })

  const syncAllMutation = useMutation({
    mutationFn: () => syncAllOpenReferencesFn(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
      queryClient.invalidateQueries({ queryKey: ['contributions'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
      toast.success(
        `Checked ${res.totalChecked} open references (${res.updated} updated)`,
      )
      if (res.errors.length > 0) {
        toast.warning(res.errors[0])
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Bulk sync failed')
    },
  })

  const markCompleteMutation = useMutation({
    mutationFn: (contributionId: string) =>
      moveContributionStatusFn({
        data: { id: contributionId, personalStatus: 'completed' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
      queryClient.invalidateQueries({ queryKey: ['contributions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Contribution marked Completed')
    },
  })

  const visible =
    filter === 'all'
      ? prs
      : prs.filter((p) => p.reference.externalStatus === filter)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Pull Requests
          </h1>
          <p className="text-xs text-muted-foreground">
            Track upstream PR status independently from your personal workflow
            status.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={syncAllMutation.isPending}
          onClick={() => syncAllMutation.mutate()}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${syncAllMutation.isPending ? 'animate-spin' : ''}`}
          />
          Sync Open PRs
        </Button>
      </div>

      {/* Status Filter Pills */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { key: 'all', label: `All (${prs.length})` },
            {
              key: 'open',
              label: `Open (${prs.filter((p) => p.reference.externalStatus === 'open').length})`,
            },
            {
              key: 'merged',
              label: `Merged (${prs.filter((p) => p.reference.externalStatus === 'merged').length})`,
            },
            {
              key: 'closed',
              label: `Closed Unmerged (${prs.filter((p) => p.reference.externalStatus === 'closed').length})`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              filter === tab.key
                ? 'border-ring bg-ring/10 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<GitPullRequest className="h-4 w-4" />}
          title="No pull requests in this view"
          description="Link a GitHub PR URL inside any contribution's Research Workspace to track its upstream open, merged, or closed status."
        />
      ) : (
        <div className="space-y-2.5">
          {visible.map(({ reference: pr, contribution, repository }) => {
            const canSuggestComplete =
              pr.externalStatus === 'merged' &&
              contribution.personalStatus !== 'completed'

            return (
              <div
                key={pr.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium hover:text-ring hover:underline inline-flex items-center gap-1"
                    >
                      <span className="font-mono text-muted-foreground">
                        #{pr.number ?? 'PR'}
                      </span>
                      <span>{pr.title || pr.url}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {repository?.fullName && (
                      <span className="font-mono text-[11px]">
                        {repository.fullName}
                      </span>
                    )}
                    <span>·</span>
                    <Link
                      to="/contributions/$contributionId"
                      params={{ contributionId: contribution.id }}
                      className="hover:text-foreground underline underline-offset-2"
                    >
                      {contribution.title}
                    </Link>
                    {pr.mergedAt && (
                      <>
                        <span>·</span>
                        <span>Merged {formatShortDate(pr.mergedAt)}</span>
                      </>
                    )}
                    {pr.lastSyncedAt && (
                      <>
                        <span>·</span>
                        <span>Synced {formatRelativeDate(pr.lastSyncedAt)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-muted-foreground">GitHub:</span>
                    <GithubStatusBadge
                      status={pr.externalStatus}
                      isDraft={pr.isDraft}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-muted-foreground">Personal:</span>
                    <PersonalStatusBadge status={contribution.personalStatus} />
                  </div>

                  {canSuggestComplete && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => markCompleteMutation.mutate(contribution.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mark Done
                    </Button>
                  )}

                  <Button
                    size="icon"
                    variant="ghost"
                    title="Sync PR from GitHub"
                    disabled={syncingId === pr.id}
                    onClick={() => syncOneMutation.mutate(pr.id)}
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        syncingId === pr.id ? 'animate-spin' : ''
                      }`}
                    />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
