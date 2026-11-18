import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Archive,
  ExternalLink,
  FolderGit2,
  GitFork,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Star,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  listRepositoriesFn,
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
import { Input } from '#/components/ui/input'
import { NativeSelect } from '#/components/ui/select'
import { Badge } from '#/components/ui/badge'
import { EmptyState } from '#/components/ui/empty-state'

export const Route = createFileRoute('/_app/repositories/')({
  component: RepositoriesPage,
})

function RepositoriesPage() {
  const queryClient = useQueryClient()
  const { openAddRepository } = useWorkspaceModals()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TrackingStatus | ''>('')
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const { data: repos = [], isLoading } = useQuery({
    queryKey: ['repositories', search, statusFilter],
    queryFn: () =>
      listRepositoriesFn({
        data: {
          search: search.trim() || undefined,
          trackingStatus: statusFilter || undefined,
        },
      }),
  })

  const syncMutation = useMutation({
    mutationFn: (repositoryId: string) =>
      syncRepositoryMetadataFn({ data: { repositoryId } }),
    onMutate: (id) => setSyncingId(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
      toast.success(
        res.changed
          ? `Synced ${res.repository.fullName}`
          : `${res.repository.fullName} is up to date`,
      )
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    },
    onSettled: () => setSyncingId(null),
  })

  const pinMutation = useMutation({
    mutationFn: (vars: { repositoryId: string; isPinned: boolean }) =>
      updateUserRepositoryFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
    },
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Repository Library
          </h1>
          <p className="text-xs text-muted-foreground">
            Track any public GitHub repository—no ownership, fork, or existing
            issue required.
          </p>
        </div>
        <Button size="sm" onClick={openAddRepository}>
          <Plus className="h-3.5 w-3.5" />
          Add Repository
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1 max-w-md">
          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Filter repositories by owner, name, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <NativeSelect
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as TrackingStatus | '')
          }
          className="sm:w-44"
          aria-label="Tracking status filter"
        >
          <option value="">All statuses</option>
          {TRACKING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TRACKING_STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* Repository Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : repos.length === 0 ? (
        <EmptyState
          icon={<FolderGit2 className="h-4 w-4" />}
          title="No repositories tracked yet"
          description="Add public open-source repositories by URL or owner/name (e.g. TanStack/router) to organize your contribution ideas."
          action={
            <Button size="sm" onClick={openAddRepository}>
              <Plus className="h-3.5 w-3.5" />
              Add Your First Repository
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {repos.map((row) => {
            const { repository: repo, userRepository: ur } = row
            return (
              <div
                key={repo.id}
                className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 hover:border-ring/50 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to="/repositories/$repoId"
                        params={{ repoId: repo.id }}
                        className="font-mono text-sm font-semibold hover:text-ring hover:underline break-all"
                      >
                        {repo.fullName}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="muted" className="text-[11px]">
                          {TRACKING_STATUS_LABELS[ur.trackingStatus]}
                        </Badge>
                        {repo.language && (
                          <Badge variant="outline" className="text-[11px]">
                            {repo.language}
                          </Badge>
                        )}
                        {repo.isArchived && (
                          <Badge variant="destructive" className="text-[11px]">
                            <Archive className="h-2.5 w-2.5" />
                            Archived
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        title={ur.isPinned ? 'Unpin' : 'Pin repository'}
                        onClick={() =>
                          pinMutation.mutate({
                            repositoryId: repo.id,
                            isPinned: !ur.isPinned,
                          })
                        }
                      >
                        <Pin
                          className={`h-3.5 w-3.5 ${
                            ur.isPinned
                              ? 'text-ring fill-ring'
                              : 'text-muted-foreground'
                          }`}
                        />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Sync metadata from GitHub"
                        disabled={syncingId === repo.id}
                        onClick={() => syncMutation.mutate(repo.id)}
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 text-muted-foreground ${
                            syncingId === repo.id ? 'animate-spin' : ''
                          }`}
                        />
                      </Button>
                      <a
                        href={repo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Open on GitHub"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>

                  {repo.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {repo.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {formatNumberCompact(repo.stars)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <GitFork className="h-3 w-3" />
                      {formatNumberCompact(repo.forks)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-medium text-foreground">
                      {row.activeContributions} active
                    </span>
                    <span>·</span>
                    <span>{row.completedContributions} done</span>
                  </div>
                </div>
                {repo.lastSyncedAt && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Synced {formatRelativeDate(repo.lastSyncedAt)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
