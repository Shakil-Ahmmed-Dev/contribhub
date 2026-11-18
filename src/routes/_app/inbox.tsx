import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Compass,
  ExternalLink,
  Inbox,
  Loader2,
  Plus,
  Trash2,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  createContributionFn,
  deleteContributionFn,
  listContributionsFn,
  moveContributionStatusFn,
} from '#/server/functions/contributions.fn'
import { listRepositoriesFn } from '#/server/functions/repositories.fn'
import {
  CONTRIBUTION_TYPES,
  CONTRIBUTION_TYPE_LABELS,
  PRIORITIES,
  PRIORITY_META
  
  
  
} from '#/shared/constants'
import type {ContributionType, PersonalStatus, Priority} from '#/shared/constants';
import { formatRelativeDate } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { NativeSelect } from '#/components/ui/select'
import { Card, CardContent } from '#/components/ui/card'
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
  EffortBadge,
  PriorityBadge,
} from '#/components/contributions/status-badges'

export const Route = createFileRoute('/_app/inbox')({
  component: InboxPage,
})

function InboxPage() {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [repositoryId, setRepositoryId] = useState('')
  const [repoInput, setRepoInput] = useState('')
  const [contributionType, setContributionType] =
    useState<ContributionType>('bug_or_improvement')
  const [priority, setPriority] = useState<Priority>('medium')
  const [githubIssueUrl, setGithubIssueUrl] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    title: string
  } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['contributions', 'inbox'],
    queryFn: () =>
      listContributionsFn({
        data: {
          statuses: ['inbox'],
          sortBy: 'createdAt',
          sortDir: 'desc',
          pageSize: 100,
        },
      }),
  })

  const { data: repos = [] } = useQuery({
    queryKey: ['repositories', 'all'],
    queryFn: () => listRepositoriesFn({ data: {} }),
  })

  const quickAddMutation = useMutation({
    mutationFn: () =>
      createContributionFn({
        data: {
          title: title.trim(),
          repositoryId: repositoryId || null,
          repositoryIdentifier:
            !repositoryId && repoInput.trim() ? repoInput.trim() : undefined,
          contributionType,
          priority,
          personalStatus: 'inbox',
          githubIssueUrl: githubIssueUrl.trim() || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
      setTitle('')
      setRepoInput('')
      setGithubIssueUrl('')
      toast.success('Captured into Inbox')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to capture item')
    },
  })

  const triageMutation = useMutation({
    mutationFn: (vars: { id: string; personalStatus: PersonalStatus }) =>
      moveContributionStatusFn({ data: vars }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(`Moved to ${vars.personalStatus.replace('_', ' ')}`)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (contributionId: string) =>
      deleteContributionFn({ data: { contributionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Contribution deleted')
      setDeleteTarget(null)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    },
  })

  const items = data?.items ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Contribution Inbox
        </h1>
        <p className="text-xs text-muted-foreground">
          Capture ideas, bugs, and issues in seconds—triage and investigate when
          you&apos;re ready.
        </p>
      </div>

      {/* Inline Rapid Capture Bar */}
      <Card>
        <CardContent className="pt-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!title.trim()) return
              quickAddMutation.mutate()
            }}
            className="space-y-3"
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Capture an opportunity... (e.g. Fix hydration mismatch in modal portal)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={quickAddMutation.isPending || !title.trim()}
                className="shrink-0"
              >
                {quickAddMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Capture
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <NativeSelect
                value={repositoryId}
                onChange={(e) => {
                  setRepositoryId(e.target.value)
                  if (e.target.value) setRepoInput('')
                }}
                aria-label="Repository"
              >
                <option value="">Repository (optional)</option>
                {repos.map((r) => (
                  <option key={r.repository.id} value={r.repository.id}>
                    {r.repository.fullName}
                  </option>
                ))}
              </NativeSelect>

              {!repositoryId ? (
                <Input
                  placeholder="Or paste owner/repo"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  aria-label="Quick repository identifier"
                />
              ) : (
                <Input
                  placeholder="Optional GitHub issue/PR URL"
                  value={githubIssueUrl}
                  onChange={(e) => setGithubIssueUrl(e.target.value)}
                  aria-label="GitHub issue URL"
                />
              )}

              <NativeSelect
                value={contributionType}
                onChange={(e) =>
                  setContributionType(e.target.value as ContributionType)
                }
                aria-label="Contribution Type"
              >
                {CONTRIBUTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CONTRIBUTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </NativeSelect>

              <NativeSelect
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                aria-label="Priority"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    Priority: {PRIORITY_META[p].label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {!repositoryId && (
              <Input
                placeholder="Optional GitHub issue or PR URL (never mandatory)"
                value={githubIssueUrl}
                onChange={(e) => setGithubIssueUrl(e.target.value)}
                aria-label="GitHub issue URL"
              />
            )}
          </form>
        </CardContent>
      </Card>

      {/* Inbox Queue */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Untriaged Queue ({items.length})
          </h2>
          <Link
            to="/backlog"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            Open full backlog
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-18 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-4 w-4" />}
            title="Inbox zero"
            description="Every captured opportunity has been triaged. Use the rapid capture bar above or press 'C' anywhere to log a new idea."
          />
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-lg border border-border bg-card p-3.5 hover:border-ring/50 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Link
                      to="/contributions/$contributionId"
                      params={{ contributionId: item.id }}
                      className="text-sm font-medium text-foreground hover:underline truncate"
                    >
                      {item.title}
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {item.repository ? (
                      <Link
                        to="/repositories/$repoId"
                        params={{ repoId: item.repository.id }}
                        className="font-mono text-[11px] hover:text-foreground"
                      >
                        {item.repository.fullName}
                      </Link>
                    ) : (
                      <span className="italic text-[11px]">
                        No repository assigned
                      </span>
                    )}
                    <span>·</span>
                    <ContributionTypeBadge type={item.contributionType} />
                    <PriorityBadge priority={item.priority} />
                    <EffortBadge effort={item.estimatedEffort} />
                    {item.githubReferences.map((ref) => (
                      <a
                        key={ref.id}
                        href={ref.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 font-mono text-[11px] hover:text-foreground"
                      >
                        #{ref.number ?? 'ref'}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ))}
                    <span>·</span>
                    <span className="text-[11px]">
                      Captured {formatRelativeDate(item.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Quick Triage Actions */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={triageMutation.isPending}
                    onClick={() =>
                      triageMutation.mutate({
                        id: item.id,
                        personalStatus: 'researching',
                      })
                    }
                  >
                    <Compass className="h-3.5 w-3.5" />
                    Research
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={triageMutation.isPending}
                    onClick={() =>
                      triageMutation.mutate({
                        id: item.id,
                        personalStatus: 'ready',
                      })
                    }
                  >
                    Ready
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={triageMutation.isPending}
                    onClick={() =>
                      triageMutation.mutate({
                        id: item.id,
                        personalStatus: 'in_progress',
                      })
                    }
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    Start
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Delete opportunity"
                    onClick={() =>
                      setDeleteTarget({ id: item.id, title: item.title })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete opportunity?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes &ldquo;{deleteTarget?.title}&rdquo; along
              with its research notes, checklist, and references.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
