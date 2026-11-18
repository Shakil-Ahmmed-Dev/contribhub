import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  Flame,
  FolderGit2,
  Kanban,
  Plus,
  RotateCcw,
  Search,
  Table2,
} from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  listContributionsFn,
  moveContributionStatusFn,
} from '#/server/functions/contributions.fn'
import { listRepositoriesFn } from '#/server/functions/repositories.fn'
import { listTagsFn } from '#/server/functions/tags.fn'
import {
  getUserPreferencesFn,
  updateUserPreferencesFn,
} from '#/server/functions/preferences.fn'
import { useWorkspaceModals } from '#/components/layout/workspace-modals-context'
import {
  CONTRIBUTION_TYPES,
  CONTRIBUTION_TYPE_LABELS,
  PERSONAL_STATUSES,
  PERSONAL_STATUS_META,
  PRIORITIES,
  PRIORITY_META
  
  
  
} from '#/shared/constants'
import type {ContributionType, PersonalStatus, Priority} from '#/shared/constants';
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { NativeSelect } from '#/components/ui/select'
import { EmptyState } from '#/components/ui/empty-state'
import { KanbanBoard } from '#/components/contributions/kanban-board'
import { BacklogTable } from '#/components/contributions/backlog-table'
import { RepoGroupView } from '#/components/contributions/repo-group-view'
import { PriorityView } from '#/components/contributions/priority-view'

const backlogSearchSchema = z.object({
  view: z.enum(['kanban', 'table', 'repos', 'priority']).optional(),
  repoId: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  type: z.string().optional(),
  tagId: z.string().optional(),
  q: z.string().optional(),
})

export const Route = createFileRoute('/_app/backlog')({
  validateSearch: (search) => backlogSearchSchema.parse(search),
  component: BacklogPage,
})

type BacklogView = 'kanban' | 'table' | 'repos' | 'priority'

function BacklogPage() {
  const searchParams = Route.useSearch()
  const navigate = useNavigate({ from: '/backlog' })
  const queryClient = useQueryClient()
  const { openQuickCapture } = useWorkspaceModals()

  const { data: prefs } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => getUserPreferencesFn(),
  })

  const activeView: BacklogView =
    searchParams.view ??
    (prefs?.defaultBacklogView as BacklogView | undefined) ??
    'kanban'

  const [searchInput, setSearchInput] = useState(searchParams.q ?? '')

  useEffect(() => {
    setSearchInput(searchParams.q ?? '')
  }, [searchParams.q])

  useEffect(() => {
    const t = setTimeout(() => {
      if ((searchParams.q ?? '') !== searchInput.trim()) {
        navigate({
          search: (prev) => ({
            ...prev,
            q: searchInput.trim() || undefined,
          }),
          replace: true,
        })
      }
    }, 200)
    return () => clearTimeout(t)
  }, [searchInput, searchParams.q, navigate])

  const { data: repos = [] } = useQuery({
    queryKey: ['repositories', 'all'],
    queryFn: () => listRepositoriesFn({ data: {} }),
  })

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => listTagsFn(),
  })

  const filterPayload = {
    repositoryId: searchParams.repoId || undefined,
    statuses: searchParams.status
      ? [searchParams.status as PersonalStatus]
      : undefined,
    priorities: searchParams.priority
      ? [searchParams.priority as Priority]
      : undefined,
    types: searchParams.type
      ? [searchParams.type as ContributionType]
      : undefined,
    tagIds: searchParams.tagId ? [searchParams.tagId] : undefined,
    search: searchParams.q || undefined,
    sortBy: 'updatedAt' as const,
    sortDir: 'desc' as const,
    pageSize: 200,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['contributions', 'backlog', filterPayload],
    queryFn: () => listContributionsFn({ data: filterPayload }),
  })

  const savePrefsMutation = useMutation({
    mutationFn: (payload: {
      defaultBacklogView?: BacklogView
      tableColumns?: Record<string, boolean>
    }) => updateUserPreferencesFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
    },
  })

  const moveMutation = useMutation({
    mutationFn: (vars: { id: string; personalStatus: PersonalStatus }) =>
      moveContributionStatusFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to move item')
    },
  })

  function switchView(view: BacklogView) {
    navigate({
      search: (prev) => ({ ...prev, view }),
      replace: true,
    })
    savePrefsMutation.mutate({ defaultBacklogView: view })
  }

  const hasFilters = Boolean(
    searchParams.repoId ||
      searchParams.status ||
      searchParams.priority ||
      searchParams.type ||
      searchParams.tagId ||
      searchParams.q,
  )

  function resetFilters() {
    setSearchInput('')
    navigate({
      search: { view: activeView },
      replace: true,
    })
  }

  const items = data?.items ?? []

  return (
    <div className="space-y-4">
      {/* Header + View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Contribution Backlog
          </h1>
          <p className="text-xs text-muted-foreground">
            {data?.total ?? 0} opportunities across your tracked repositories.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-card p-0.5">
            {(
              [
                { id: 'kanban', label: 'Kanban', icon: Kanban },
                { id: 'table', label: 'Table', icon: Table2 },
                { id: 'repos', label: 'Repos', icon: FolderGit2 },
                { id: 'priority', label: 'Priority', icon: Flame },
              ] as const
            ).map((v) => {
              const Icon = v.icon
              const active = activeView === v.id
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => switchView(v.id)}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {v.label}
                </button>
              )
            })}
          </div>

          <Button size="sm" onClick={() => openQuickCapture()}>
            <Plus className="h-3.5 w-3.5" />
            Add Opportunity
          </Button>
        </div>
      </div>

      {/* Multi-Facet Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2.5">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search titles, descriptions, repos, notes..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <NativeSelect
          value={searchParams.repoId ?? ''}
          onChange={(e) =>
            navigate({
              search: (prev) => ({
                ...prev,
                repoId: e.target.value || undefined,
              }),
              replace: true,
            })
          }
          className="h-8 w-44 text-xs"
          aria-label="Filter by repository"
        >
          <option value="">All repositories</option>
          {repos.map((r) => (
            <option key={r.repository.id} value={r.repository.id}>
              {r.repository.fullName}
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          value={searchParams.status ?? ''}
          onChange={(e) =>
            navigate({
              search: (prev) => ({
                ...prev,
                status: e.target.value || undefined,
              }),
              replace: true,
            })
          }
          className="h-8 w-36 text-xs"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {PERSONAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PERSONAL_STATUS_META[s].label}
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          value={searchParams.priority ?? ''}
          onChange={(e) =>
            navigate({
              search: (prev) => ({
                ...prev,
                priority: e.target.value || undefined,
              }),
              replace: true,
            })
          }
          className="h-8 w-32 text-xs"
          aria-label="Filter by priority"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_META[p].label}
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          value={searchParams.type ?? ''}
          onChange={(e) =>
            navigate({
              search: (prev) => ({
                ...prev,
                type: e.target.value || undefined,
              }),
              replace: true,
            })
          }
          className="h-8 w-36 text-xs"
          aria-label="Filter by contribution type"
        >
          <option value="">All types</option>
          {CONTRIBUTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {CONTRIBUTION_TYPE_LABELS[t]}
            </option>
          ))}
        </NativeSelect>

        {allTags.length > 0 && (
          <NativeSelect
            value={searchParams.tagId ?? ''}
            onChange={(e) =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  tagId: e.target.value || undefined,
                }),
                replace: true,
              })
            }
            className="h-8 w-32 text-xs"
            aria-label="Filter by tag"
          >
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        )}

        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={resetFilters}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>

      {/* View Renderer */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={
            hasFilters
              ? 'No matching opportunities'
              : 'Your contribution backlog is empty'
          }
          description={
            hasFilters
              ? 'Try clearing or adjusting your active filters.'
              : 'Capture your first open-source idea, bug fix, or documentation improvement.'
          }
          action={
            hasFilters ? (
              <Button size="sm" variant="outline" onClick={resetFilters}>
                Clear Filters
              </Button>
            ) : (
              <Button size="sm" onClick={() => openQuickCapture()}>
                <Plus className="h-3.5 w-3.5" />
                Capture Opportunity
              </Button>
            )
          }
        />
      ) : activeView === 'kanban' ? (
        <KanbanBoard
          items={items}
          onMoveStatus={(id, personalStatus) =>
            moveMutation.mutate({ id, personalStatus })
          }
          onQuickAddInColumn={(status) => openQuickCapture({ status })}
        />
      ) : activeView === 'table' ? (
        <BacklogTable
          items={items}
          initialColumnVisibility={prefs?.tableColumns}
          onColumnVisibilityChange={(next) =>
            savePrefsMutation.mutate({ tableColumns: next })
          }
          onMoveStatus={(id, personalStatus) =>
            moveMutation.mutate({ id, personalStatus })
          }
        />
      ) : activeView === 'repos' ? (
        <RepoGroupView
          items={items}
          onQuickAddForRepo={(repoId) =>
            openQuickCapture({ repositoryId: repoId })
          }
        />
      ) : (
        <PriorityView items={items} />
      )}
    </div>
  )
}
