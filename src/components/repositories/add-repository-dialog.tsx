import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderGit2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { addRepositoryFn } from '#/server/functions/repositories.fn'
import {
  TRACKING_STATUSES,
  TRACKING_STATUS_LABELS
  
} from '#/shared/constants'
import type {TrackingStatus} from '#/shared/constants';
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

interface AddRepositoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded?: (repositoryId: string) => void
}

export function AddRepositoryDialog({
  open,
  onOpenChange,
  onAdded,
}: AddRepositoryDialogProps) {
  const queryClient = useQueryClient()
  const [identifier, setIdentifier] = useState('')
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('active')
  const [personalNotes, setPersonalNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      addRepositoryFn({
        data: {
          identifier: identifier.trim(),
          trackingStatus,
          personalNotes: personalNotes.trim(),
          skipGithubLookup: false,
        },
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })

      if (res.alreadyTracked) {
        toast.info(`${res.repository.fullName} is already in your library`)
      } else {
        toast.success(`Added ${res.repository.fullName}`)
      }
      if (res.syncWarning) {
        toast.warning(res.syncWarning)
      }

      setIdentifier('')
      setPersonalNotes('')
      setTrackingStatus('active')
      onOpenChange(false)
      onAdded?.(res.repository.id)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to add repository')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!identifier.trim()) return
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderGit2 className="h-4 w-4" />
            Add Public Repository
          </DialogTitle>
          <DialogDescription>
            Track any public GitHub repository—even ones you don&apos;t own or fork.
            Metadata will be fetched directly from GitHub.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="repo-identifier">
              GitHub URL or owner/repository *
            </Label>
            <Input
              id="repo-identifier"
              placeholder="e.g. TanStack/router or https://github.com/facebook/react"
              required
              autoFocus
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="repo-tracking">Tracking Status</Label>
            <NativeSelect
              id="repo-tracking"
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
            <Label htmlFor="repo-notes">Personal Notes (optional)</Label>
            <Textarea
              id="repo-notes"
              placeholder="Setup notes, contribution guidelines, maintainer preferences..."
              rows={3}
              value={personalNotes}
              onChange={(e) => setPersonalNotes(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Add Repository
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
