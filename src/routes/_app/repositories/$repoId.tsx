import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  Archive,
  ArrowLeft,
  ExternalLink,
  GitFork,
  GitPullRequest,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Star,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getRepositoryDetailFn,
  removeUserRepositoryFn,
  syncRepositoryMetadataFn,
  updateUserRepositoryFn,
} from '#/server/functions/repositories.fn'
import { useWorkspaceModals } from '#/components/layout/workspace-modals-context'
import {
  TRACKING_STATUSES,
  TRACKING_STATUS_LABELS
  
} from '#/shared/constants'
import type {TrackingStatus} from '#/shared/constants';
import { formatNumberCompact, formatRelativeDate } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Textarea } from '#/components/ui/textarea'
import { NativeSelect } from '#/components/ui/select'
import { EmptyState } from '#/components/ui/empty-state'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import {
  ContributionTypeBadge,
  GithubStatusBadge,
  PersonalStatusBadge,
  PriorityBadge,
} from '#/components/contributions/status-badges'

export const Route = createFileRoute('/_app/repositories/$repoId')({
  component: RepositoryDetailPage,
})

function RepositoryDetailPage() {
  const { repoId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { openQuickCapture } = useWorkspaceModals()

  const [notes, setNotes] = useState('')
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('active')
  const [tab, setTab] = useState<'all' | 'active' | 'completed' | 'refs' | 'history'>('all')
  const [confirmRemove, setConfirmRemove] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['repository', repoId],
    queryFn: () => getRepositoryDetailFn({ data: { repositoryId: repoId } }),
  })

  useEffect(() => {
    if (data) {
      setNotes(data.userRepository.personalNotes)
      setTrackingStatus(data.userRepository.trackingStatus)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateUserRepositoryFn({
        data: {
          repositoryId: repoId,
          personalNotes: notes,
          trackingStatus,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repository', repoId] })
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
      toast.success('Repository settings saved')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    },
  })

  const syncMutation = useMutation({
    mutationFn: () => syncRepositoryMetadataFn({ data: { repositoryId: repoId } }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['repository', repoId] })
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
      toast.success(
        res.changed ? 'Metadata refreshed from GitHub' : 'Metadata is up to date',
      )
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'GitHub sync failed')
    },
  })

  const removeMutation = useMutation({
    mutationFn: () => removeUserRepositoryFn({ data: { repositoryId: repoId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
      toast.success('Repository removed from your library')
      navigate({ to: '/repositories' })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to remove')
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Repository not found"
        description={
          error instanceof Error
            ? error.message
            : 'This repository is not in your library.'
        }
        action={
          <Link to="/repositories">
            <Button size="sm" variant="outline">
              Back to Repositories
            </Button>
          </Link>
        }
      />
    )
  }

  const { repository: repo } = data
  const visibleContribs =
    tab === 'active'
      ? data.activeContributions
      : tab === 'completed'
        ? data.completedContributions
        : data.contributions

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div className="space-y-3">
        <Link
          to="/repositories"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Repository Library
        </Link>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-semibold tracking-tight">
                {repo.fullName}
              </h1>
              {repo.language && <Badge variant="outline">{repo.language}</Badge>}
              {repo.isArchived && (
                <Badge variant="destructive">
                  <Archive className="h-3 w-3" />
                  Archived
                </Badge>
              )}
            </div>
            {repo.description && (
              <p className="text-sm text-muted-foreground max-w-2xl">
                {repo.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-0.5">
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5" />
                {formatNumberCompact(repo.stars)} stars
              </span>
              <span className="inline-flex items-center gap-1">
                <GitFork className="h-3.5 w-3.5" />
                {formatNumberCompact(repo.forks)} forks
              </span>
              <span>Visibility: {repo.visibility}</span>
              <span>Synced: {formatRelativeDate(repo.lastSyncedAt)}</span>
              <a
                href={repo.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-ring hover:underline"
              >
                Open on GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => openQuickCapture({ repositoryId: repo.id })}
            >
              <Plus className="h-3.5 w-3.5" />
              New Opportunity
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`}
              />
              Sync GitHub
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmRemove(true)}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2">
            {(
              [
                { key: 'all', label: `All (${data.contributions.length})` },
                {
                  key: 'active',
                  label: `Active (${data.activeContributions.length})`,
                },
                {
                  key: 'completed',
                  label: `Completed (${data.completedContributions.length})`,
                },
                {
                  key: 'refs',
                  label: `Issues & PRs (${data.linkedIssues.length + data.linkedPullRequests.length})`,
                },
                {
                  key: 'history',
                  label: `History (${data.historyEvents.length})`,
                },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  tab === t.key
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'refs' ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Linked Pull Requests ({data.linkedPullRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.linkedPullRequests.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No pull requests linked to opportunities in this repository yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {data.linkedPullRequests.map((pr) => (
                        <div
                          key={pr.id}
                          className="flex items-center justify-between gap-2 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <GitPullRequest className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <a
                              href={pr.url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate font-medium hover:underline"
                            >
                              {pr.number ? `#${pr.number} ` : ''}
                              {pr.title || pr.url}
                            </a>
                          </div>
                          <GithubStatusBadge
                            status={pr.externalStatus}
                            isDraft={pr.isDraft}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    Linked Issues ({data.linkedIssues.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.linkedIssues.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No GitHub issues linked yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {data.linkedIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="flex items-center justify-between gap-2 py-2 text-xs"
                        >
                          <a
                            href={issue.url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate font-medium hover:underline"
                          >
                            {issue.number ? `#${issue.number} ` : ''}
                            {issue.title || issue.url}
                          </a>
                          <GithubStatusBadge status={issue.externalStatus} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : tab === 'history' ? (
            <Card>
              <CardHeader>
                <CardTitle>Contribution History</CardTitle>
              </CardHeader>
              <CardContent>
                {data.historyEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No activity recorded for this repository yet.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {data.historyEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between gap-2 text-xs border-b border-border/60 pb-2 last:border-0"
                      >
                        <div>
                          <span className="font-medium capitalize">
                            {ev.eventType.replaceAll('_', ' ')}
                          </span>
                          <span className="ml-2 text-muted-foreground">
                            ({ev.actorType})
                          </span>
                        </div>
                        <span className="text-muted-foreground">
                          {formatRelativeDate(ev.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : visibleContribs.length === 0 ? (
            <EmptyState
              title="No contributions in this view"
              description="Capture an idea, bug, or docs improvement for this repository—no existing GitHub issue required."
              action={
                <Button
                  size="sm"
                  onClick={() => openQuickCapture({ repositoryId: repo.id })}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Opportunity
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {visibleContribs.map((c) => (
                <Link
                  key={c.id}
                  to="/contributions/$contributionId"
                  params={{ contributionId: c.id }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border bg-card p-3.5 hover:border-ring/50 transition-colors"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm font-medium truncate">{c.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Updated {formatRelativeDate(c.updatedAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <ContributionTypeBadge type={c.contributionType} />
                    <PriorityBadge priority={c.priority} />
                    <PersonalStatusBadge status={c.personalStatus} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar: Personal Notes & Tracking Status */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Personal Repository Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Tracking Status
              </label>
              <NativeSelect
                value={trackingStatus}
                onChange={(e) =>
                  setTrackingStatus(e.target.value as TrackingStatus)
                }
              >
                {TRACKING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TRACKING_STATUS_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Notes (dev setup, test commands, architecture pointers)
              </label>
              <Textarea
                rows={8}
                placeholder="Document build commands, local test setup, style rules, or maintainer guidelines..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Button
              size="sm"
              className="w-full"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Notes
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Repository Library?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <strong>{repo.fullName}</strong> from your tracked
              repositories list and deletes your repository-level notes. Your
              existing contributions will remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeMutation.mutate()}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
