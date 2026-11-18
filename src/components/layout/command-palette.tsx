import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Command } from 'cmdk'
import {
  FileText,
  FolderGit2,
  GitPullRequest,
  History,
  Inbox,
  Kanban,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Tag,
  Wrench,
} from 'lucide-react'
import { globalSearchFn } from '#/server/functions/search.fn'
import { PERSONAL_STATUS_META } from '#/shared/constants'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenQuickCapture: () => void
  onOpenAddRepo: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  onOpenQuickCapture,
  onOpenAddRepo,
}: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 180)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setDebouncedQuery('')
    }
  }, [open])

  const { data: results, isFetching } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => globalSearchFn({ data: { query: debouncedQuery } }),
    enabled: open && debouncedQuery.length > 0,
  })

  if (!open) return null

  function runAndClose(fn: () => void) {
    onOpenChange(false)
    fn()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl">
        <Command shouldFilter={false} className="flex flex-col">
          <div className="flex items-center border-b border-border px-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search contributions, repositories, notes, tags, or GitHub refs..."
              className="flex h-11 w-full bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            {isFetching && (
              <span className="text-[11px] text-muted-foreground">
                Searching...
              </span>
            )}
          </div>

          <Command.List className="max-h-[380px] overflow-y-auto p-1.5 text-sm">
            {debouncedQuery ? (
              <>
                {results &&
                  results.contributions.length === 0 &&
                  results.repositories.length === 0 &&
                  results.notes.length === 0 &&
                  results.githubReferences.length === 0 &&
                  results.tags.length === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No results found for &ldquo;{debouncedQuery}&rdquo;
                    </div>
                  )}

                {results && results.contributions.length > 0 && (
                  <Command.Group
                    heading="Contributions"
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {results.contributions.map((c) => (
                      <Command.Item
                        key={c.id}
                        value={`contrib-${c.id}`}
                        onSelect={() =>
                          runAndClose(() =>
                            navigate({
                              to: '/contributions/$contributionId',
                              params: { contributionId: c.id },
                            }),
                          )
                        }
                        className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-xs cursor-pointer aria-selected:bg-accent"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{c.title}</div>
                          {c.repositoryFullName && (
                            <div className="truncate text-[11px] text-muted-foreground font-mono">
                              {c.repositoryFullName}
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {PERSONAL_STATUS_META[c.personalStatus]?.label}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {results && results.repositories.length > 0 && (
                  <Command.Group
                    heading="Repositories"
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {results.repositories.map((r) => (
                      <Command.Item
                        key={r.id}
                        value={`repo-${r.id}`}
                        onSelect={() =>
                          runAndClose(() =>
                            navigate({
                              to: '/repositories/$repoId',
                              params: { repoId: r.id },
                            }),
                          )
                        }
                        className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs cursor-pointer aria-selected:bg-accent"
                      >
                        <FolderGit2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono font-medium">
                            {r.fullName}
                          </div>
                          {r.description && (
                            <div className="truncate text-[11px] text-muted-foreground">
                              {r.description}
                            </div>
                          )}
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {results && results.notes.length > 0 && (
                  <Command.Group
                    heading="Research Notes"
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {results.notes.map((n) => (
                      <Command.Item
                        key={n.id}
                        value={`note-${n.id}`}
                        onSelect={() =>
                          runAndClose(() =>
                            navigate({
                              to: '/contributions/$contributionId',
                              params: { contributionId: n.contributionId },
                            }),
                          )
                        }
                        className="flex items-start gap-2 rounded-md px-2.5 py-2 text-xs cursor-pointer aria-selected:bg-accent"
                      >
                        <FileText className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {n.title || n.contributionTitle}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {n.snippet}
                          </div>
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {results && results.githubReferences.length > 0 && (
                  <Command.Group
                    heading="GitHub Issues & PRs"
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {results.githubReferences.map((ref) => (
                      <Command.Item
                        key={ref.id}
                        value={`ref-${ref.id}`}
                        onSelect={() =>
                          runAndClose(() =>
                            navigate({
                              to: '/contributions/$contributionId',
                              params: { contributionId: ref.contributionId },
                            }),
                          )
                        }
                        className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-xs cursor-pointer aria-selected:bg-accent"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <GitPullRequest className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            {ref.number ? `#${ref.number} ` : ''}
                            {ref.title || ref.url}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground capitalize">
                          {ref.externalStatus}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {results && results.tags.length > 0 && (
                  <Command.Group
                    heading="Tags"
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {results.tags.map((t) => (
                      <Command.Item
                        key={t.id}
                        value={`tag-${t.id}`}
                        onSelect={() =>
                          runAndClose(() =>
                            navigate({
                              to: '/backlog',
                              search: { tagId: t.id },
                            }),
                          )
                        }
                        className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs cursor-pointer aria-selected:bg-accent"
                      >
                        <Tag className="h-3.5 w-3.5" style={{ color: t.color }} />
                        <span>{t.name}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </>
            ) : (
              <>
                <Command.Group
                  heading="Quick Actions"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  <Command.Item
                    value="action-new-contribution"
                    onSelect={() => runAndClose(onOpenQuickCapture)}
                    className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs cursor-pointer aria-selected:bg-accent"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Capture New Contribution Opportunity
                  </Command.Item>
                  <Command.Item
                    value="action-add-repo"
                    onSelect={() => runAndClose(onOpenAddRepo)}
                    className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs cursor-pointer aria-selected:bg-accent"
                  >
                    <FolderGit2 className="h-3.5 w-3.5" />
                    Add Public GitHub Repository
                  </Command.Item>
                </Command.Group>

                <Command.Group
                  heading="Navigation"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {[
                    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
                    { to: '/inbox', label: 'Inbox', icon: Inbox },
                    { to: '/backlog', label: 'Backlog', icon: Kanban },
                    { to: '/repositories', label: 'Repositories', icon: FolderGit2 },
                    { to: '/in-progress', label: 'In Progress', icon: Wrench },
                    { to: '/pull-requests', label: 'Pull Requests', icon: GitPullRequest },
                    { to: '/history', label: 'History', icon: History },
                    { to: '/settings', label: 'Settings', icon: Settings },
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <Command.Item
                        key={item.to}
                        value={`nav-${item.to}`}
                        onSelect={() =>
                          runAndClose(() => navigate({ to: item.to }))
                        }
                        className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs cursor-pointer aria-selected:bg-accent"
                      >
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {item.label}
                      </Command.Item>
                    )
                  })}
                </Command.Group>
              </>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
