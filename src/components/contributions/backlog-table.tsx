import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
  
  
  
} from '@tanstack/react-table'
import type {ColumnDef, SortingState, VisibilityState} from '@tanstack/react-table';
import { Link } from '@tanstack/react-router'
import { ArrowUpDown, Columns3, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ContributionListItem } from '#/server/services/contribution.service'
import {
  PERSONAL_STATUS_META,
  PRIORITY_META
  
} from '#/shared/constants'
import type {PersonalStatus} from '#/shared/constants';
import { formatRelativeDate, formatShortDate } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { NativeSelect } from '#/components/ui/select'
import {
  ContributionTypeBadge,
  EffortBadge,
  PersonalStatusBadge,
  PriorityBadge,
  UpstreamOutcomeBadge,
} from './status-badges'

interface BacklogTableProps {
  items: ContributionListItem[]
  initialColumnVisibility?: Record<string, boolean>
  onColumnVisibilityChange?: (next: Record<string, boolean>) => void
  onMoveStatus: (id: string, nextStatus: PersonalStatus) => void
}

type GroupByOption = 'none' | 'status' | 'repository' | 'priority'

export function BacklogTable({
  items,
  initialColumnVisibility = {},
  onColumnVisibilityChange,
  onMoveStatus,
}: BacklogTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'updatedAt', desc: true },
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    createdAt: false,
    upstreamOutcome: true,
    ...initialColumnVisibility,
  })
  const [groupBy, setGroupBy] = useState<GroupByOption>('none')
  const [showColPicker, setShowColPicker] = useState(false)

  const columns = useMemo<ColumnDef<ContributionListItem>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Contribution',
        cell: ({ row }) => {
          const item = row.original
          return (
            <div className="min-w-[220px] max-w-[380px]">
              <Link
                to="/contributions/$contributionId"
                params={{ contributionId: item.id }}
                className="font-medium text-foreground hover:text-ring hover:underline line-clamp-1"
              >
                {item.title}
              </Link>
              {item.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: 'repository',
        accessorFn: (row) => row.repository?.fullName ?? '',
        header: 'Repository',
        cell: ({ row }) => {
          const repo = row.original.repository
          if (!repo) {
            return <span className="text-muted-foreground italic">Unassigned</span>
          }
          return (
            <Link
              to="/repositories/$repoId"
              params={{ repoId: repo.id }}
              className="font-mono text-xs hover:text-ring hover:underline whitespace-nowrap"
            >
              {repo.fullName}
            </Link>
          )
        },
      },
      {
        accessorKey: 'personalStatus',
        header: 'Status',
        cell: ({ row }) => (
          <select
            aria-label={`Change status for ${row.original.title}`}
            value={row.original.personalStatus}
            onChange={(e) =>
              onMoveStatus(row.original.id, e.target.value as PersonalStatus)
            }
            className="rounded-md border border-border bg-card px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {(Object.keys(PERSONAL_STATUS_META) as PersonalStatus[]).map((s) => (
              <option key={s} value={s}>
                {PERSONAL_STATUS_META[s].label}
              </option>
            ))}
          </select>
        ),
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        sortingFn: (a, b) =>
          PRIORITY_META[a.original.priority].weight -
          PRIORITY_META[b.original.priority].weight,
        cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
      },
      {
        accessorKey: 'contributionType',
        header: 'Type',
        cell: ({ row }) => (
          <ContributionTypeBadge type={row.original.contributionType} />
        ),
      },
      {
        accessorKey: 'estimatedEffort',
        header: 'Effort',
        cell: ({ row }) => (
          <EffortBadge effort={row.original.estimatedEffort} />
        ),
      },
      {
        accessorKey: 'upstreamOutcome',
        header: 'Upstream',
        cell: ({ row }) =>
          row.original.upstreamOutcome === 'none' ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <UpstreamOutcomeBadge outcome={row.original.upstreamOutcome} />
          ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatShortDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: 'Updated',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatRelativeDate(row.original.updatedAt)}
          </span>
        ),
      },
    ],
    [onMoveStatus],
  )

  const table = useReactTable({
    data: items,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(columnVisibility) : updater
      setColumnVisibility(next)
      onColumnVisibilityChange?.(next)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 20 },
    },
  })

  const groupedRows = useMemo(() => {
    if (groupBy === 'none') return null
    const map = new Map<string, typeof items>()
    for (const row of table.getSortedRowModel().rows) {
      const item = row.original
      const key =
        groupBy === 'status'
          ? PERSONAL_STATUS_META[item.personalStatus].label
          : groupBy === 'priority'
            ? PRIORITY_META[item.priority].label
            : (item.repository?.fullName ?? 'Unassigned Repository')
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    return [...map.entries()]
  }, [groupBy, table.getSortedRowModel().rows])

  return (
    <div className="space-y-3">
      {/* Table Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Group by:</span>
          <NativeSelect
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
            className="h-8 w-36 text-xs"
            aria-label="Group rows by"
          >
            <option value="none">None</option>
            <option value="status">Status</option>
            <option value="repository">Repository</option>
            <option value="priority">Priority</option>
          </NativeSelect>
        </div>

        <div className="relative">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowColPicker((v) => !v)}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Columns
          </Button>
          {showColPicker && (
            <div className="absolute right-0 top-9 z-20 w-44 rounded-md border border-border bg-popover p-2 shadow-lg space-y-1">
              {table
                .getAllLeafColumns()
                .filter((col) => col.id !== 'title')
                .map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={col.getIsVisible()}
                      onChange={col.getToggleVisibilityHandler()}
                    />
                    <span className="capitalize">
                      {typeof col.columnDef.header === 'string'
                        ? col.columnDef.header
                        : col.id}
                    </span>
                  </label>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Grouped View or Standard Paginated Table */}
      {groupedRows ? (
        <div className="space-y-4">
          {groupedRows.map(([groupLabel, groupItems]) => (
            <div
              key={groupLabel}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              <div className="flex items-center justify-between bg-muted/50 px-3.5 py-2 border-b border-border">
                <span className="text-xs font-semibold">{groupLabel}</span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {groupItems.length}
                </span>
              </div>
              <div className="divide-y divide-border">
                {groupItems.map((item) => (
                  <Link
                    key={item.id}
                    to="/contributions/$contributionId"
                    params={{ contributionId: item.id }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-accent/40 transition-colors text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {item.title}
                      </div>
                      {item.repository && (
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {item.repository.fullName}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <ContributionTypeBadge type={item.contributionType} />
                      <PriorityBadge priority={item.priority} />
                      <PersonalStatusBadge status={item.personalStatus} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-3 py-2.5 font-medium whitespace-nowrap"
                      >
                        {header.isPlaceholder ? null : (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 hover:text-foreground cursor-pointer"
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            <ArrowUpDown className="h-3 w-3 opacity-60" />
                          </button>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-accent/30 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5 align-middle">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {table.getState().pagination.pageIndex + 1} of{' '}
                {table.getPageCount()} ({items.length} total)
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
