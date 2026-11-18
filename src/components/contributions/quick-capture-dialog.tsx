import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
  checkDuplicateGithubUrlFn,
  createContributionFn,
} from '#/server/functions/contributions.fn'
import { lookupGithubUrlFn } from '#/server/functions/github.fn'
import { listRepositoriesFn } from '#/server/functions/repositories.fn'
import { listTagsFn } from '#/server/functions/tags.fn'
import {
  CONTRIBUTION_TYPES,
  CONTRIBUTION_TYPE_LABELS,
  ESTIMATED_EFFORTS,
  ESTIMATED_EFFORT_LABELS,
  PERSONAL_STATUSES,
  PERSONAL_STATUS_META,
  PRIORITIES,
  PRIORITY_META
  
  
  
  
} from '#/shared/constants'
import type {ContributionType, EstimatedEffort, PersonalStatus, Priority} from '#/shared/constants';
import { parseGithubUrl } from '#/shared/github-url'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { NativeSelect } from '#/components/ui/select'

interface QuickCaptureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultRepositoryId?: string | null
  defaultStatus?: PersonalStatus
}

export function QuickCaptureDialog({
  open,
  onOpenChange,
  defaultRepositoryId = null,
  defaultStatus = 'inbox',
}: QuickCaptureDialogProps) {
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [repositoryId, setRepositoryId] = useState<string>(
    defaultRepositoryId ?? '',
  )
  const [repositoryIdentifier, setRepositoryIdentifier] = useState('')
  const [contributionType, setContributionType] =
    useState<ContributionType>('bug_or_improvement')
  const [personalStatus, setPersonalStatus] =
    useState<PersonalStatus>(defaultStatus)
  const [priority, setPriority] = useState<Priority>('medium')
  const [estimatedEffort, setEstimatedEffort] = useState<EstimatedEffort | ''>('')
  const [githubIssueUrl, setGithubIssueUrl] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [duplicates, setDuplicates] = useState<
    Array<{ contributionId: string; title: string; personalStatus: string }>
  >([])
  const [isLookingUp, setIsLookingUp] = useState(false)

  useEffect(() => {
    if (open) {
      setRepositoryId(defaultRepositoryId ?? '')
      setPersonalStatus(defaultStatus)
      setDuplicates([])
    }
  }, [open, defaultRepositoryId, defaultStatus])

  const { data: repos = [] } = useQuery({
    queryKey: ['repositories', 'all'],
    queryFn: () => listRepositoriesFn({ data: {} }),
    enabled: open,
  })

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => listTagsFn(),
    enabled: open,
  })

  async function handleGithubUrlBlur() {
    const raw = githubIssueUrl.trim()
    if (!raw) {
      setDuplicates([])
      return
    }

    const parsed = parseGithubUrl(raw)
    if (!parsed) return

    // Check duplicates
    try {
      const found = await checkDuplicateGithubUrlFn({ data: { url: raw } })
      setDuplicates(found)
    } catch {
      // ignore
    }

    // Auto-match existing repo or populate repositoryIdentifier
    const matchingRepo = repos.find(
      (r) => r.repository.normalizedFullName === parsed.normalizedFullName,
    )
    if (matchingRepo) {
      setRepositoryId(matchingRepo.repository.id)
      setRepositoryIdentifier('')
    } else if (!repositoryId) {
      setRepositoryIdentifier(parsed.fullName)
    }

    if (parsed.entityType === 'issue') {
      setContributionType('existing_issue')
    }
  }

  async function handleFetchFromGithub() {
    const raw = githubIssueUrl.trim()
    if (!raw) return
    setIsLookingUp(true)
    try {
      const res = await lookupGithubUrlFn({ data: { url: raw } })
      if (res.entity?.title && !title.trim()) {
        setTitle(res.entity.title)
      }
      if (res.parsed.entityType === 'issue') {
        setContributionType('existing_issue')
      }
      const matchingRepo = repos.find(
        (r) =>
          r.repository.normalizedFullName === res.parsed.normalizedFullName,
      )
      if (matchingRepo) {
        setRepositoryId(matchingRepo.repository.id)
      } else {
        setRepositoryIdentifier(res.parsed.fullName)
      }
      toast.success('Fetched details from GitHub')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not fetch GitHub URL',
      )
    } finally {
      setIsLookingUp(false)
    }
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createContributionFn({
        data: {
          title: title.trim(),
          description: description.trim(),
          repositoryId: repositoryId || null,
          repositoryIdentifier:
            !repositoryId && repositoryIdentifier.trim()
              ? repositoryIdentifier.trim()
              : undefined,
          contributionType,
          personalStatus,
          priority,
          estimatedEffort: estimatedEffort || null,
          githubIssueUrl: githubIssueUrl.trim() || null,
          sourceUrl: sourceUrl.trim() || null,
          tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
      toast.success('Contribution opportunity captured')
      setTitle('')
      setDescription('')
      setRepositoryIdentifier('')
      setGithubIssueUrl('')
      setSourceUrl('')
      setEstimatedEffort('')
      setSelectedTagIds([])
      setDuplicates([])
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create contribution',
      )
    },
  })

  function toggleTag(id: string) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Capture Contribution Opportunity</DialogTitle>
          <DialogDescription>
            Capture first, investigate later. No existing GitHub issue is
            required—add independent ideas, bugs, or docs improvements freely.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            createMutation.mutate()
          }}
          className="space-y-3.5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="capture-title">Title *</Label>
            <Input
              id="capture-title"
              placeholder="e.g. Fix memory leak in useEffect cleanup or Add PostgreSQL index docs"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="capture-gh-url">
              GitHub Issue / PR URL (optional)
            </Label>
            <div className="flex gap-2">
              <Input
                id="capture-gh-url"
                placeholder="https://github.com/owner/repo/issues/123"
                value={githubIssueUrl}
                onChange={(e) => setGithubIssueUrl(e.target.value)}
                onBlur={handleGithubUrlBlur}
              />
              {githubIssueUrl.trim() && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLookingUp}
                  onClick={handleFetchFromGithub}
                  className="shrink-0"
                >
                  {isLookingUp ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Fetch
                </Button>
              )}
            </div>
            {duplicates.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Possible duplicate already tracked:
                </div>
                {duplicates.map((d) => (
                  <div key={d.contributionId}>
                    <Link
                      to="/contributions/$contributionId"
                      params={{ contributionId: d.contributionId }}
                      onClick={() => onOpenChange(false)}
                      className="underline hover:text-foreground"
                    >
                      {d.title} ({d.personalStatus})
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="capture-repo">Repository (optional in Inbox)</Label>
              <NativeSelect
                id="capture-repo"
                value={repositoryId}
                onChange={(e) => {
                  setRepositoryId(e.target.value)
                  if (e.target.value) setRepositoryIdentifier('')
                }}
              >
                <option value="">— Select tracked repository —</option>
                {repos.map((r) => (
                  <option key={r.repository.id} value={r.repository.id}>
                    {r.repository.fullName}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {!repositoryId && (
              <div className="space-y-1.5">
                <Label htmlFor="capture-new-repo">
                  Or quick-add repo (owner/repo)
                </Label>
                <Input
                  id="capture-new-repo"
                  placeholder="owner/repo or GitHub URL"
                  value={repositoryIdentifier}
                  onChange={(e) => setRepositoryIdentifier(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="capture-type">Type</Label>
              <NativeSelect
                id="capture-type"
                value={contributionType}
                onChange={(e) =>
                  setContributionType(e.target.value as ContributionType)
                }
              >
                {CONTRIBUTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CONTRIBUTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="capture-status">Status</Label>
              <NativeSelect
                id="capture-status"
                value={personalStatus}
                onChange={(e) =>
                  setPersonalStatus(e.target.value as PersonalStatus)
                }
              >
                {PERSONAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PERSONAL_STATUS_META[s].label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="capture-priority">Priority</Label>
              <NativeSelect
                id="capture-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="capture-effort">Effort</Label>
              <NativeSelect
                id="capture-effort"
                value={estimatedEffort}
                onChange={(e) =>
                  setEstimatedEffort(e.target.value as EstimatedEffort | '')
                }
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

          <div className="space-y-1.5">
            <Label htmlFor="capture-desc">Context / Initial Notes</Label>
            <Textarea
              id="capture-desc"
              placeholder="Why does this matter? Where did you spot it? (Markdown supported)"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="capture-source">Source URL (optional)</Label>
            <Input
              id="capture-source"
              placeholder="Blog post, docs page, Discord thread, etc."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>

          {allTags.length > 0 && (
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors cursor-pointer ${
                        selected
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
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Save Opportunity
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
