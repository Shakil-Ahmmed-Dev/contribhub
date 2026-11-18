import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  FolderGit2,
  GitPullRequest,
  Inbox,
  Kanban,
  Layers,
  Plus,
  Search,
  Star,
  Wrench,
} from 'lucide-react'
import { getDashboardSummaryFn } from '#/server/functions/dashboard.fn'
import { useWorkspaceModals } from '#/components/layout/workspace-modals-context'
import { formatNumberCompact, formatRelativeDate } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { EmptyState } from '#/components/ui/empty-state'
import { GithubIcon } from '#/components/ui/github-icon'
import {
  ContributionTypeBadge,
  EffortBadge,
  PersonalStatusBadge,
  PriorityBadge,
  UpstreamOutcomeBadge,
} from '#/components/contributions/status-badges'

export const Route = createFileRoute('/_app/')({
  component: DashboardPage,
})

function DashboardPage() {
  const { openQuickCapture, openAddRepository, openCommandPalette } =
    useWorkspaceModals()

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => getDashboardSummaryFn(),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Unable to load dashboard"
        description={
          error instanceof Error ? error.message : 'Please refresh the page.'
        }
      />
    )
  }

  const statTiles = [
    {
      label: 'Total',
      value: data.counts.total,
      to: '/backlog' as const,
      icon: Layers,
    },
    {
      label: 'Inbox',
      value: data.counts.inbox,
      to: '/inbox' as const,
      icon: Inbox,
    },
    {
      label: 'Researching',
      value: data.counts.researching,
      to: '/backlog' as const,
      icon: Compass,
    },
    {
      label: 'Ready',
      value: data.counts.ready,
      to: '/backlog' as const,
      icon: Kanban,
    },
    {
      label: 'In Progress',
      value: data.counts.in_progress,
      to: '/in-progress' as const,
      icon: Wrench,
    },
    {
      label: 'PRs Submitted',
      value: data.counts.submittedPrs,
      to: '/pull-requests' as const,
      icon: GitPullRequest,
    },
    {
      label: 'Completed',
      value: data.counts.completed,
      to: '/history' as const,
      icon: CheckCircle2,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header + Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            Your open-source contribution pipeline at a glance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => openQuickCapture()}>
            <Plus className="h-3.5 w-3.5" />
            Add Contribution
          </Button>
          <Button size="sm" variant="outline" onClick={openAddRepository}>
            <FolderGit2 className="h-3.5 w-3.5" />
            Add Repository
          </Button>
          <Button size="sm" variant="outline" onClick={openCommandPalette}>
            <Search className="h-3.5 w-3.5" />
            Search
          </Button>
          <Link to="/backlog">
            <Button size="sm" variant="outline">
              <Kanban className="h-3.5 w-3.5" />
              Backlog
            </Button>
          </Link>
          {!data.githubConnected && (
            <Link to="/settings">
              <Button size="sm" variant="secondary">
                <GithubIcon className="h-3.5 w-3.5" />
                Connect GitHub
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Actionable Pipeline Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {statTiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link key={tile.label} to={tile.to} className="group block">
              <div className="rounded-lg border border-border bg-card p-3 transition-colors group-hover:border-ring/60">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[11px] font-medium">{tile.label}</span>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">
                  {tile.value}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recently Updated Contributions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Recently Updated Contributions</CardTitle>
            <Link
              to="/backlog"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View backlog
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {data.recentContributions.length === 0 ? (
              <EmptyState
                icon={<Inbox className="h-4 w-4" />}
                title="No contributions yet"
                description="Capture your first bug fix, feature idea, or documentation improvement—no existing GitHub issue required."
                action={
                  <Button size="sm" onClick={() => openQuickCapture()}>
                    <Plus className="h-3.5 w-3.5" />
                    Capture Opportunity
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-border">
                {data.recentContributions.map((c) => (
                  <Link
                    key={c.id}
                    to="/contributions/$contributionId"
                    params={{ contributionId: c.id }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5 hover:bg-accent/40 -mx-2 px-2 rounded-md transition-colors"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="truncate text-sm font-medium text-foreground">
                        {c.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {c.repository?.fullName ? (
                          <span className="font-mono text-[11px]">
                            {c.repository.fullName}
                          </span>
                        ) : (
                          <span className="text-[11px] italic">No repo linked</span>
                        )}
                        <span>·</span>
                        <span>{formatRelativeDate(c.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <ContributionTypeBadge type={c.contributionType} />
                      <PriorityBadge priority={c.priority} />
                      <PersonalStatusBadge status={c.personalStatus} />
                      <UpstreamOutcomeBadge outcome={c.upstreamOutcome} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Ready Queue + Recent Repositories */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Ready to Work Next</CardTitle>
              <Link
                to="/backlog"
                search={{ view: 'priority' }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Priority view
              </Link>
            </CardHeader>
            <CardContent>
              {data.readyQueue.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">
                  No opportunities marked <strong>Ready</strong> yet. Triage items
                  from your Inbox or Researching column to build a focused queue.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.readyQueue.map((item) => (
                    <Link
                      key={item.id}
                      to="/contributions/$contributionId"
                      params={{ contributionId: item.id }}
                      className="block rounded-md border border-border p-2.5 hover:border-ring/60 transition-colors"
                    >
                      <div className="text-xs font-medium line-clamp-2">
                        {item.title}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-[11px] font-mono text-muted-foreground truncate">
                          {item.repository?.fullName ?? 'Unassigned'}
                        </span>
                        <div className="flex items-center gap-1">
                          <EffortBadge effort={item.estimatedEffort} />
                          <PriorityBadge priority={item.priority} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Recently Added Repositories</CardTitle>
              <Link
                to="/repositories"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                All repos
              </Link>
            </CardHeader>
            <CardContent>
              {data.recentRepositories.length === 0 ? (
                <div className="space-y-2 py-2">
                  <p className="text-xs text-muted-foreground">
                    Add any public GitHub repository to track opportunities
                    without needing ownership or forks.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openAddRepository}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Repository
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {data.recentRepositories.map((repo) => (
                    <Link
                      key={repo.id}
                      to="/repositories/$repoId"
                      params={{ repoId: repo.id }}
                      className="flex items-center justify-between gap-2 py-2 hover:bg-accent/40 -mx-2 px-2 rounded-md transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs font-medium">
                          {repo.fullName}
                        </div>
                        {repo.language && (
                          <div className="text-[11px] text-muted-foreground">
                            {repo.language}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Star className="h-3 w-3" />
                        <span className="tabular-nums">
                          {formatNumberCompact(repo.stars)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
