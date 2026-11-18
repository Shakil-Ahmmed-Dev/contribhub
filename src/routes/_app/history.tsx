import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  CheckCircle2,
  ExternalLink,
  FolderGit2,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  History,
  XCircle,
} from 'lucide-react'
import { getContributionHistoryFn } from '#/server/functions/history.fn'
import { formatRelativeDate, formatShortDate } from '#/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { EmptyState } from '#/components/ui/empty-state'
import {
  GithubStatusBadge,
  PersonalStatusBadge,
} from '#/components/contributions/status-badges'

export const Route = createFileRoute('/_app/history')({
  component: HistoryPage,
})

function HistoryPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['history'],
    queryFn: () => getContributionHistoryFn(),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Unable to load contribution history"
        description={error instanceof Error ? error.message : 'Try refreshing.'}
      />
    )
  }

  const { summary } = data
  const maxEvents = Math.max(
    1,
    ...data.activityByMonth.map((m) => m.totalEvents),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Contribution History
        </h1>
        <p className="text-xs text-muted-foreground">
          Tracks both <strong>personal completion</strong> (your finished work)
          and <strong>upstream acceptance</strong> (merged PRs)—never
          misclassifying closed-unmerged PRs as accepted.
        </p>
      </div>

      {/* Clear Personal vs Upstream Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Submitted PRs</span>
            <GitPullRequest className="h-3.5 w-3.5" />
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {summary.submittedPrs}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between text-[11px] text-purple-600 dark:text-purple-400">
            <span>Merged Upstream</span>
            <GitMerge className="h-3.5 w-3.5" />
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {summary.mergedPrs}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between text-[11px] text-rose-600 dark:text-rose-400">
            <span>Closed (Unmerged)</span>
            <GitPullRequestClosed className="h-3.5 w-3.5" />
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {summary.closedUnmergedPrs}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400">
            <span>Independent Done</span>
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {summary.completedIndependent}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Abandoned</span>
            <XCircle className="h-3.5 w-3.5" />
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {summary.abandoned}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Repos Contributed</span>
            <FolderGit2 className="h-3.5 w-3.5" />
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {summary.repositoriesContributed}
          </div>
        </div>
      </div>

      {/* Activity Over Time */}
      {data.activityByMonth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Contribution Activity Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {data.activityByMonth.map((m) => (
                <div
                  key={m.month}
                  className="rounded-md border border-border p-2.5 space-y-1.5"
                >
                  <div className="font-mono text-xs font-medium">{m.month}</div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-ring"
                      style={{
                        width: `${Math.max(8, Math.round((m.totalEvents / maxEvents) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground flex justify-between">
                    <span>{m.totalEvents} events</span>
                    <span>
                      {m.mergedCount} merged · {m.completedCount} done
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Merged Upstream PRs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitMerge className="h-4 w-4 text-purple-500" />
              Merged Pull Requests ({data.mergedPrs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.mergedPrs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No merged pull requests recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {data.mergedPrs.map(({ reference: pr, contribution, repository }) => (
                  <div
                    key={pr.id}
                    className="flex items-center justify-between gap-2 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium hover:text-ring hover:underline inline-flex items-center gap-1 truncate"
                      >
                        #{pr.number} {pr.title || contribution.title}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {repository?.fullName} · Merged{' '}
                        {formatShortDate(pr.mergedAt)}
                      </div>
                    </div>
                    <GithubStatusBadge status="merged" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Closed Without Merging */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitPullRequestClosed className="h-4 w-4 text-rose-500" />
              Closed PRs (Not Merged) ({data.closedUnmergedPrs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.closedUnmergedPrs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No closed-unmerged pull requests recorded.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {data.closedUnmergedPrs.map(
                  ({ reference: pr, contribution, repository }) => (
                    <div
                      key={pr.id}
                      className="flex items-center justify-between gap-2 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <Link
                          to="/contributions/$contributionId"
                          params={{ contributionId: contribution.id }}
                          className="font-medium hover:text-ring hover:underline truncate block"
                        >
                          #{pr.number} {pr.title || contribution.title}
                        </Link>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {repository?.fullName} · Closed{' '}
                          {formatShortDate(pr.closedAt)}
                        </div>
                      </div>
                      <Badge variant="destructive">Closed (Unmerged)</Badge>
                    </div>
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Independent Work */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Completed Independent Work ({data.completedIndependent.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.completedIndependent.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No completed non-PR contributions yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {data.completedIndependent.map(({ contribution, repository }) => (
                  <Link
                    key={contribution.id}
                    to="/contributions/$contributionId"
                    params={{ contributionId: contribution.id }}
                    className="flex items-center justify-between gap-2 py-2.5 text-xs hover:bg-accent/40 -mx-2 px-2 rounded"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {contribution.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {repository?.fullName ?? 'Unassigned'} · Completed{' '}
                        {formatShortDate(contribution.personalCompletedAt)}
                      </div>
                    </div>
                    <PersonalStatusBadge status="completed" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Abandoned Opportunities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-muted-foreground" />
              Abandoned Opportunities ({data.abandoned.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.abandoned.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No abandoned opportunities.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {data.abandoned.map(({ contribution, repository }) => (
                  <Link
                    key={contribution.id}
                    to="/contributions/$contributionId"
                    params={{ contributionId: contribution.id }}
                    className="flex items-center justify-between gap-2 py-2.5 text-xs hover:bg-accent/40 -mx-2 px-2 rounded"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {contribution.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {repository?.fullName ?? 'Unassigned'}
                        {contribution.abandonedReason
                          ? ` · ${contribution.abandonedReason}`
                          : ''}
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatShortDate(contribution.abandonedAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contributed Repositories & Recent Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Repositories Contributed To</CardTitle>
          </CardHeader>
          <CardContent>
            {data.contributedRepositories.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Complete a contribution or submit a PR to populate this list.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {data.contributedRepositories.map((repo) => (
                  <Link
                    key={repo.id}
                    to="/repositories/$repoId"
                    params={{ repoId: repo.id }}
                    className="flex items-center justify-between gap-2 py-2.5 text-xs hover:bg-accent/40 -mx-2 px-2 rounded"
                  >
                    <div>
                      <div className="font-mono font-medium">
                        {repo.fullName}
                      </div>
                      {repo.language && (
                        <div className="text-[11px] text-muted-foreground">
                          {repo.language}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <Badge variant="outline">
                        {repo.mergedCount} merged
                      </Badge>
                      <Badge variant="muted">
                        {repo.completedCount} done
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Recent Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No events yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {data.recentEvents.slice(0, 20).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start justify-between gap-2 text-xs border-b border-border/60 pb-2 last:border-0"
                  >
                    <div className="min-w-0">
                      <Link
                        to="/contributions/$contributionId"
                        params={{ contributionId: ev.contributionId }}
                        className="font-medium hover:text-ring hover:underline truncate block"
                      >
                        {ev.contributionTitle}
                      </Link>
                      <span className="text-[11px] text-muted-foreground capitalize">
                        {ev.eventType.replaceAll('_', ' ')} ({ev.actorType})
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatRelativeDate(ev.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
