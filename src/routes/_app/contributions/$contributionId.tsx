import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  Code2,
  ExternalLink,
  FileCode,
  GitPullRequest,
  Link2,
  Loader2,
  Pin,
  Plus,
  RefreshCw,
  Square,
  Tag as TagIcon,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { z } from 'zod'
import type { updateContributionSchema } from '#/shared/schemas'
import {
  deleteContributionFn,
  getContributionDetailFn,
  updateContributionFn,
} from '#/server/functions/contributions.fn'
import {
  createChecklistItemFn,
  createNoteFn,
  createResourceFn,
  deleteChecklistItemFn,
  deleteNoteFn,
  deleteResourceFn,
  updateChecklistItemFn,
  updateNoteFn,
} from '#/server/functions/research.fn'
import {
  linkGithubReferenceFn,
  syncGithubReferenceFn,
  unlinkGithubReferenceFn,
} from '#/server/functions/github.fn'
import { listRepositoriesFn } from '#/server/functions/repositories.fn'
import { createTagFn, listTagsFn } from '#/server/functions/tags.fn'
import {
  CONTRIBUTION_TYPES,
  CONTRIBUTION_TYPE_LABELS,
  ESTIMATED_EFFORTS,
  ESTIMATED_EFFORT_LABELS,
  PERSONAL_STATUSES,
  PERSONAL_STATUS_META,
  PRIORITIES,
  PRIORITY_META,
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
  TAG_COLORS
  
  
  
  
  
  
} from '#/shared/constants'
import type {ContributionType, EstimatedEffort, NoteContentType, PersonalStatus, Priority, ResourceType} from '#/shared/constants';
import { formatRelativeDate, formatShortDate } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { NativeSelect } from '#/components/ui/select'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
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
  GithubStatusBadge,
  PersonalStatusBadge,
  UpstreamOutcomeBadge,
} from '#/components/contributions/status-badges'
import { MarkdownSection } from '#/components/research/markdown-section'

export const Route = createFileRoute('/_app/contributions/$contributionId')({
  component: ResearchWorkspacePage,
})

function ResearchWorkspacePage() {
  const { contributionId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [titleDraft, setTitleDraft] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Note / Snippet composer
  const [noteType, setNoteType] = useState<NoteContentType>('investigation')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [codeLanguage, setCodeLanguage] = useState('typescript')

  // Checklist composer
  const [checklistTitle, setChecklistTitle] = useState('')

  // Technical resource composer
  const [resourceType, setResourceType] =
    useState<ResourceType>('documentation')
  const [resourceTitle, setResourceTitle] = useState('')
  const [resourceUrlOrPath, setResourceUrlOrPath] = useState('')
  const [resourceNotes, setResourceNotes] = useState('')

  // GitHub link composer
  const [ghUrl, setGhUrl] = useState('')
  const [syncingRefId, setSyncingRefId] = useState<string | null>(null)

  // New inline tag
  const [newTagName, setNewTagName] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['contribution', contributionId],
    queryFn: () => getContributionDetailFn({ data: { contributionId } }),
  })

  const { data: repos = [] } = useQuery({
    queryKey: ['repositories', 'all'],
    queryFn: () => listRepositoriesFn({ data: {} }),
  })

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => listTagsFn(),
  })

  useEffect(() => {
    if (data?.contribution) {
      setTitleDraft(data.contribution.title)
    }
  }, [data?.contribution])

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['contribution', contributionId] })
    queryClient.invalidateQueries({ queryKey: ['contributions'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['history'] })
  }

  const updateMutation = useMutation({
    mutationFn: (payload: z.input<typeof updateContributionSchema>) =>
      updateContributionFn({ data: payload }),
    onSuccess: () => {
      invalidateAll()
      toast.success('Saved')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteContributionFn({ data: { contributionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Contribution deleted')
      navigate({ to: '/backlog' })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    },
  })

  const addNoteMutation = useMutation({
    mutationFn: () =>
      createNoteFn({
        data: {
          contributionId,
          title: noteTitle.trim(),
          content: noteContent.trim(),
          contentType: noteType,
          codeLanguage: noteType === 'code_snippet' ? codeLanguage.trim() : null,
          isPinned: false,
        },
      }),
    onSuccess: () => {
      setNoteTitle('')
      setNoteContent('')
      invalidateAll()
      toast.success(
        noteType === 'code_snippet' ? 'Code snippet saved' : 'Note added',
      )
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not save note')
    },
  })

  const togglePinNoteMutation = useMutation({
    mutationFn: (vars: { id: string; isPinned: boolean }) =>
      updateNoteFn({ data: vars }),
    onSuccess: invalidateAll,
  })

  const deleteNoteMutation = useMutation({
    mutationFn: (id: string) => deleteNoteFn({ data: { id } }),
    onSuccess: () => {
      invalidateAll()
      toast.success('Note deleted')
    },
  })

  const addChecklistMutation = useMutation({
    mutationFn: () =>
      createChecklistItemFn({
        data: { contributionId, title: checklistTitle.trim() },
      }),
    onSuccess: () => {
      setChecklistTitle('')
      invalidateAll()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not add subtask')
    },
  })

  const toggleChecklistMutation = useMutation({
    mutationFn: (vars: { id: string; isCompleted: boolean }) =>
      updateChecklistItemFn({ data: vars }),
    onSuccess: invalidateAll,
  })

  const deleteChecklistMutation = useMutation({
    mutationFn: (id: string) => deleteChecklistItemFn({ data: { id } }),
    onSuccess: invalidateAll,
  })

  const addResourceMutation = useMutation({
    mutationFn: () =>
      createResourceFn({
        data: {
          contributionId,
          resourceType,
          title: resourceTitle.trim(),
          urlOrPath: resourceUrlOrPath.trim(),
          notes: resourceNotes.trim(),
        },
      }),
    onSuccess: () => {
      setResourceTitle('')
      setResourceUrlOrPath('')
      setResourceNotes('')
      invalidateAll()
      toast.success('Reference added')
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Could not add reference',
      )
    },
  })

  const deleteResourceMutation = useMutation({
    mutationFn: (id: string) => deleteResourceFn({ data: { id } }),
    onSuccess: invalidateAll,
  })

  const linkGithubMutation = useMutation({
    mutationFn: () =>
      linkGithubReferenceFn({
        data: {
          contributionId,
          url: ghUrl.trim(),
          fetchMetadata: true,
        },
      }),
    onSuccess: () => {
      setGhUrl('')
      invalidateAll()
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
      toast.success('GitHub reference linked')
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Could not link GitHub URL',
      )
    },
  })

  const syncRefMutation = useMutation({
    mutationFn: (id: string) => syncGithubReferenceFn({ data: { id } }),
    onMutate: (id) => setSyncingRefId(id),
    onSuccess: (res) => {
      invalidateAll()
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
      if (res.suggestPersonalCompletion) {
        toast.success(
          'Pull request is merged on GitHub! You can now mark this contribution Completed.',
        )
      } else if (res.changed) {
        toast.success('Synced latest status from GitHub')
      } else {
        toast.info('Already up to date with GitHub')
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'GitHub sync failed')
    },
    onSettled: () => setSyncingRefId(null),
  })

  const unlinkRefMutation = useMutation({
    mutationFn: (id: string) => unlinkGithubReferenceFn({ data: { id } }),
    onSuccess: () => {
      invalidateAll()
      toast.success('Reference unlinked')
    },
  })

  const createTagMutation = useMutation({
    mutationFn: () =>
      createTagFn({
        data: {
          name: newTagName.trim(),
          color: TAG_COLORS[allTags.length % TAG_COLORS.length],
        },
      }),
    onSuccess: (created) => {
      setNewTagName('')
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      const currentTagIds = (data?.tags ?? []).map((t) => t.id)
      updateMutation.mutate({
        id: contributionId,
        tagIds: [...currentTagIds, created.id],
      })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create tag')
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-80 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-96 animate-pulse rounded-lg bg-muted" />
          <div className="h-96 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Contribution not found"
        description={
          error instanceof Error
            ? error.message
            : 'This record does not exist or belongs to another account.'
        }
        action={
          <Link to="/backlog">
            <Button size="sm" variant="outline">
              Back to Backlog
            </Button>
          </Link>
        }
      />
    )
  }

  const { contribution: c, repository: repo } = data
  const completedSubtasks = data.checklists.filter((i) => i.isCompleted).length
  const totalSubtasks = data.checklists.length
  const assignedTagIds = new Set(data.tags.map((t) => t.id))

  function toggleAssignedTag(tagId: string) {
    const next = assignedTagIds.has(tagId)
      ? data!.tags.filter((t) => t.id !== tagId).map((t) => t.id)
      : [...data!.tags.map((t) => t.id), tagId]
    updateMutation.mutate({ id: contributionId, tagIds: next })
  }

  return (
    <div className="space-y-5">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/backlog"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Backlog
        </Link>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirmDelete(true)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      {/* Merged PR Suggestion Banner (Decoupled Personal vs GitHub Status!) */}
      {data.suggestCompletion && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-xs">
          <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              A linked pull request was <strong>merged on GitHub</strong>. Your
              personal status is still{' '}
              <strong>{PERSONAL_STATUS_META[c.personalStatus].label}</strong>
              —would you like to mark this contribution as Completed?
            </span>
          </div>
          <Button
            size="sm"
            onClick={() =>
              updateMutation.mutate({
                id: contributionId,
                personalStatus: 'completed',
              })
            }
          >
            Mark Completed
          </Button>
        </div>
      )}

      {/* Title Header */}
      <div className="space-y-2">
        {editingTitle ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!titleDraft.trim()) return
              updateMutation.mutate({
                id: contributionId,
                title: titleDraft.trim(),
              })
              setEditingTitle(false)
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              autoFocus
              className="text-lg font-semibold h-10"
            />
            <Button size="sm" type="submit">
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => {
                setTitleDraft(c.title)
                setEditingTitle(false)
              }}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <h1
            onClick={() => setEditingTitle(true)}
            title="Click to edit title"
            className="text-xl font-semibold tracking-tight cursor-pointer hover:text-ring transition-colors"
          >
            {c.title}
          </h1>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <PersonalStatusBadge status={c.personalStatus} />
          <UpstreamOutcomeBadge outcome={c.upstreamOutcome} />
          {repo && (
            <Link
              to="/repositories/$repoId"
              params={{ repoId: repo.id }}
              className="font-mono text-xs hover:text-ring hover:underline"
            >
              {repo.fullName}
            </Link>
          )}
          <span>·</span>
          <span>Created {formatShortDate(c.createdAt)}</span>
          <span>·</span>
          <span>Updated {formatRelativeDate(c.updatedAt)}</span>
        </div>
      </div>

      {/* Main Two-Column Research Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Left 2/3: Research Context, Notes, Snippets, Checklist, References */}
        <div className="lg:col-span-2 space-y-4">
          <MarkdownSection
            title="Problem Description"
            subtitle="What bug, gap, or opportunity did you identify?"
            value={c.description}
            placeholder="Describe the problem, context, or motivation (Markdown supported)..."
            isSaving={updateMutation.isPending}
            onSave={(description) =>
              updateMutation.mutate({ id: contributionId, description })
            }
          />

          <MarkdownSection
            title="Proposed Solution"
            subtitle="How do you plan to solve or implement this?"
            value={c.proposedSolution}
            placeholder="Outline your architectural approach, affected modules, API changes, or tradeoffs..."
            isSaving={updateMutation.isPending}
            onSave={(proposedSolution) =>
              updateMutation.mutate({ id: contributionId, proposedSolution })
            }
          />

          <MarkdownSection
            title="Reproduction Steps"
            subtitle="For bugs or regressions: exact steps, environment, and expected vs actual behavior"
            value={c.reproductionSteps}
            placeholder="1. Clone repo & run...\n2. Trigger action...\n3. Observe error..."
            isSaving={updateMutation.isPending}
            onSave={(reproductionSteps) =>
              updateMutation.mutate({ id: contributionId, reproductionSteps })
            }
          />

          {/* Checklist Subtasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
                Actionable Checklist
              </CardTitle>
              {totalSubtasks > 0 && (
                <span className="text-xs font-mono text-muted-foreground">
                  {completedSubtasks}/{totalSubtasks}
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {totalSubtasks > 0 && (
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: `${Math.round((completedSubtasks / totalSubtasks) * 100)}%`,
                    }}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                {data.checklists.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/70 px-2.5 py-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        toggleChecklistMutation.mutate({
                          id: item.id,
                          isCompleted: !item.isCompleted,
                        })
                      }
                      className="flex items-center gap-2 text-left flex-1 cursor-pointer"
                    >
                      {item.isCompleted ? (
                        <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span
                        className={
                          item.isCompleted
                            ? 'line-through text-muted-foreground'
                            : 'text-foreground'
                        }
                      >
                        {item.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteChecklistMutation.mutate(item.id)}
                      className="p-1 text-muted-foreground hover:text-destructive cursor-pointer"
                      aria-label="Delete subtask"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!checklistTitle.trim()) return
                  addChecklistMutation.mutate()
                }}
                className="flex gap-2"
              >
                <Input
                  placeholder="Add subtask (e.g. Write regression test, Check CONTRIBUTING.md)..."
                  value={checklistTitle}
                  onChange={(e) => setChecklistTitle(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  type="submit"
                  variant="outline"
                  disabled={
                    addChecklistMutation.isPending || !checklistTitle.trim()
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Investigation Notes & Code Snippets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-muted-foreground" />
                Investigation Notes &amp; Code Snippets ({data.notes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Composer */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!noteContent.trim()) return
                  addNoteMutation.mutate()
                }}
                className="rounded-md border border-border bg-muted/30 p-3 space-y-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <NativeSelect
                    value={noteType}
                    onChange={(e) =>
                      setNoteType(e.target.value as NoteContentType)
                    }
                    className="h-8 w-40 text-xs"
                    aria-label="Note type"
                  >
                    <option value="investigation">Investigation Note</option>
                    <option value="code_snippet">Code Snippet</option>
                    <option value="general">General Note</option>
                  </NativeSelect>
                  <Input
                    placeholder={
                      noteType === 'code_snippet'
                        ? 'Snippet title (e.g. Proposed fix in parser.ts)'
                        : 'Note heading (optional)'
                    }
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    className="h-8 text-xs flex-1 min-w-[160px]"
                  />
                  {noteType === 'code_snippet' && (
                    <Input
                      placeholder="Language (ts, rust, sql...)"
                      value={codeLanguage}
                      onChange={(e) => setCodeLanguage(e.target.value)}
                      className="h-8 w-32 font-mono text-xs"
                    />
                  )}
                </div>

                <Textarea
                  rows={4}
                  placeholder={
                    noteType === 'code_snippet'
                      ? 'Paste implementation snippet or diff...'
                      : 'Record findings, file paths, call stacks, or hypotheses (Markdown)...'
                  }
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className={
                    noteType === 'code_snippet' ? 'font-mono text-xs' : 'text-xs'
                  }
                />

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    type="submit"
                    disabled={addNoteMutation.isPending || !noteContent.trim()}
                  >
                    {addNoteMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    {noteType === 'code_snippet' ? 'Save Snippet' : 'Add Note'}
                  </Button>
                </div>
              </form>

              {/* Notes List */}
              {data.notes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No investigation notes or snippets yet. Document what you
                  discover so you can resume effortlessly weeks later.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-md border border-border bg-card p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="muted" className="text-[10px]">
                            {note.contentType === 'code_snippet'
                              ? note.codeLanguage || 'code'
                              : note.contentType}
                          </Badge>
                          {note.title && (
                            <span className="text-xs font-semibold truncate">
                              {note.title}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground">
                            {formatRelativeDate(note.updatedAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              togglePinNoteMutation.mutate({
                                id: note.id,
                                isPinned: !note.isPinned,
                              })
                            }
                            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                            title={note.isPinned ? 'Unpin' : 'Pin note'}
                          >
                            <Pin
                              className={`h-3.5 w-3.5 ${
                                note.isPinned ? 'text-ring fill-ring' : ''
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteNoteMutation.mutate(note.id)}
                            className="p-1 text-muted-foreground hover:text-destructive cursor-pointer"
                            title="Delete note"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {note.contentType === 'code_snippet' ? (
                        <pre className="rounded-md border border-border bg-muted p-3 overflow-x-auto text-xs font-mono leading-relaxed">
                          <code>{note.content}</code>
                        </pre>
                      ) : (
                        <div className="prose-contrib">
                          <Markdown remarkPlugins={[remarkGfm]}>
                            {note.content}
                          </Markdown>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Technical References (Docs, Source Files, Discussions, External Resources) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                Technical References ({data.resources.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.resources.length > 0 && (
                <div className="divide-y divide-border">
                  {data.resources.map((res) => {
                    const isUrl = /^https?:\/\//i.test(res.urlOrPath)
                    return (
                      <div
                        key={res.id}
                        className="flex items-start justify-between gap-2 py-2.5 text-xs"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {RESOURCE_TYPE_LABELS[res.resourceType]}
                            </Badge>
                            {isUrl ? (
                              <a
                                href={res.urlOrPath}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-ring hover:underline inline-flex items-center gap-1 truncate"
                              >
                                {res.title}
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="font-medium inline-flex items-center gap-1">
                                <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                                {res.title}
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground truncate">
                            {res.urlOrPath}
                          </div>
                          {res.notes && (
                            <p className="text-muted-foreground">{res.notes}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteResourceMutation.mutate(res.id)}
                          className="p-1 text-muted-foreground hover:text-destructive cursor-pointer shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!resourceTitle.trim() || !resourceUrlOrPath.trim()) return
                  addResourceMutation.mutate()
                }}
                className="rounded-md border border-border bg-muted/30 p-3 space-y-2"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <NativeSelect
                    value={resourceType}
                    onChange={(e) =>
                      setResourceType(e.target.value as ResourceType)
                    }
                    className="h-8 text-xs"
                  >
                    {RESOURCE_TYPES.map((rt) => (
                      <option key={rt} value={rt}>
                        {RESOURCE_TYPE_LABELS[rt]}
                      </option>
                    ))}
                  </NativeSelect>
                  <Input
                    placeholder="Title (e.g. Router middleware file)"
                    value={resourceTitle}
                    onChange={(e) => setResourceTitle(e.target.value)}
                    className="h-8 text-xs sm:col-span-2"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="URL or repo file path (e.g. packages/core/src/index.ts:L142)"
                    value={resourceUrlOrPath}
                    onChange={(e) => setResourceUrlOrPath(e.target.value)}
                    className="h-8 font-mono text-xs flex-1"
                  />
                  <Button
                    size="sm"
                    type="submit"
                    variant="outline"
                    disabled={
                      addResourceMutation.isPending ||
                      !resourceTitle.trim() ||
                      !resourceUrlOrPath.trim()
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Reference
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right 1/3: Metadata, GitHub Links & Sync, Tags, Activity Timeline */}
        <div className="space-y-4">
          {/* Properties Card */}
          <Card>
            <CardHeader>
              <CardTitle>Workflow &amp; Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Personal Status
                </label>
                <NativeSelect
                  value={c.personalStatus}
                  onChange={(e) =>
                    updateMutation.mutate({
                      id: contributionId,
                      personalStatus: e.target.value as PersonalStatus,
                    })
                  }
                  className="h-8 text-xs"
                >
                  {PERSONAL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PERSONAL_STATUS_META[s].label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Priority
                  </label>
                  <NativeSelect
                    value={c.priority}
                    onChange={(e) =>
                      updateMutation.mutate({
                        id: contributionId,
                        priority: e.target.value as Priority,
                      })
                    }
                    className="h-8 text-xs"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_META[p].label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Effort
                  </label>
                  <NativeSelect
                    value={c.estimatedEffort ?? ''}
                    onChange={(e) =>
                      updateMutation.mutate({
                        id: contributionId,
                        estimatedEffort:
                          (e.target.value as EstimatedEffort) || null,
                      })
                    }
                    className="h-8 text-xs"
                  >
                    <option value="">Unestimated</option>
                    {ESTIMATED_EFFORTS.map((ef) => (
                      <option key={ef} value={ef}>
                        {ESTIMATED_EFFORT_LABELS[ef]}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Contribution Type
                </label>
                <NativeSelect
                  value={c.contributionType}
                  onChange={(e) =>
                    updateMutation.mutate({
                      id: contributionId,
                      contributionType: e.target.value as ContributionType,
                    })
                  }
                  className="h-8 text-xs"
                >
                  {CONTRIBUTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {CONTRIBUTION_TYPE_LABELS[t]}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Repository
                </label>
                <NativeSelect
                  value={c.repositoryId ?? ''}
                  onChange={(e) =>
                    updateMutation.mutate({
                      id: contributionId,
                      repositoryId: e.target.value || null,
                    })
                  }
                  className="h-8 text-xs"
                >
                  <option value="">Unassigned</option>
                  {repos.map((r) => (
                    <option key={r.repository.id} value={r.repository.id}>
                      {r.repository.fullName}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              {c.sourceUrl && (
                <div className="pt-1">
                  <a
                    href={c.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-ring hover:underline break-all"
                  >
                    <Link2 className="h-3 w-3 shrink-0" />
                    Source link
                    <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked GitHub Issues & PRs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitPullRequest className="h-4 w-4 text-muted-foreground" />
                GitHub Issues &amp; PRs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.githubReferences.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No GitHub issue or PR linked yet. You can work independently
                  and link a PR whenever you open one.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.githubReferences.map((ref) => (
                    <div
                      key={ref.id}
                      className="rounded-md border border-border p-2.5 space-y-1.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium hover:text-ring hover:underline leading-snug"
                        >
                          <span className="font-mono text-muted-foreground mr-1">
                            {ref.referenceType === 'pull_request' ? 'PR' : 'Issue'}
                            {ref.number ? ` #${ref.number}` : ''}
                          </span>
                          {ref.title || ref.url}
                        </a>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <GithubStatusBadge
                            status={ref.externalStatus}
                            isDraft={ref.isDraft}
                          />
                          {ref.lastSyncedAt && (
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeDate(ref.lastSyncedAt)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            title="Sync from GitHub"
                            disabled={syncingRefId === ref.id}
                            onClick={() => syncRefMutation.mutate(ref.id)}
                          >
                            <RefreshCw
                              className={`h-3 w-3 ${
                                syncingRefId === ref.id ? 'animate-spin' : ''
                              }`}
                            />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            title="Unlink reference"
                            onClick={() => unlinkRefMutation.mutate(ref.id)}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!ghUrl.trim()) return
                  linkGithubMutation.mutate()
                }}
                className="flex gap-1.5"
              >
                <Input
                  placeholder="https://github.com/owner/repo/pull/42"
                  value={ghUrl}
                  onChange={(e) => setGhUrl(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  type="submit"
                  variant="outline"
                  disabled={linkGithubMutation.isPending || !ghUrl.trim()}
                >
                  {linkGithubMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Link'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Tags Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TagIcon className="h-4 w-4 text-muted-foreground" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => {
                  const active = assignedTagIds.has(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleAssignedTag(tag.id)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors cursor-pointer ${
                        active
                          ? 'border-ring bg-ring/10 text-foreground font-medium'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </button>
                  )
                })}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!newTagName.trim()) return
                  createTagMutation.mutate()
                }}
                className="flex gap-1.5"
              >
                <Input
                  placeholder="New tag..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  type="submit"
                  variant="outline"
                  disabled={createTagMutation.isPending || !newTagName.trim()}
                >
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {data.events.length === 0 ? (
                <p className="text-xs text-muted-foreground">No events yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.events.slice(0, 15).map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start justify-between gap-2 text-xs border-l-2 border-border pl-2.5"
                    >
                      <div>
                        <div className="font-medium capitalize">
                          {ev.eventType.replaceAll('_', ' ')}
                        </div>
                        {typeof ev.metadata.from === 'string' &&
                          typeof ev.metadata.to === 'string' && (
                            <div className="text-[11px] text-muted-foreground">
                              {ev.metadata.from.replaceAll('_', ' ')} →{' '}
                              {ev.metadata.to.replaceAll('_', ' ')}
                            </div>
                          )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
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

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contribution?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes &ldquo;{c.title}&rdquo; and all
              associated notes, code snippets, checklists, references, and
              timeline events.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()}>
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
