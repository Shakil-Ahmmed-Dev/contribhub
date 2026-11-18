import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Tag as TagIcon,
  Trash2,
  Unlink,
} from 'lucide-react'
import { toast } from 'sonner'
import { authClient } from '#/lib/auth-client'
import { useTheme  } from '#/lib/theme'
import type {ThemeMode} from '#/lib/theme';
import {
  disconnectGithubFn,
  getGithubConnectionStatusFn,
  syncAllOpenReferencesFn,
} from '#/server/functions/github.fn'
import {
  createApiTokenFn,
  listApiTokensFn,
  revokeApiTokenFn,
} from '#/server/functions/preferences.fn'
import { createTagFn, deleteTagFn, listTagsFn } from '#/server/functions/tags.fn'
import { TAG_COLORS } from '#/shared/constants'
import { formatRelativeDate, formatShortDate } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { GithubIcon } from '#/components/ui/github-icon'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()

  // Tags state
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState<string>(TAG_COLORS[0])

  // API token state (for future Browser Extension)
  const [tokenName, setTokenName] = useState('')
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: ghStatus, isLoading: ghLoading } = useQuery({
    queryKey: ['github-status'],
    queryFn: () => getGithubConnectionStatusFn(),
  })

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => listTagsFn(),
  })

  const { data: apiTokens = [] } = useQuery({
    queryKey: ['api-tokens'],
    queryFn: () => listApiTokensFn(),
  })

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectGithubFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-status'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('GitHub account disconnected')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Disconnect failed')
    },
  })

  const bulkSyncMutation = useMutation({
    mutationFn: () => syncAllOpenReferencesFn(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['github-status'] })
      queryClient.invalidateQueries({ queryKey: ['contributions'] })
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
      toast.success(
        `Synced ${res.synced}/${res.totalChecked} open GitHub references (${res.updated} changed)`,
      )
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    },
  })

  const createTagMutation = useMutation({
    mutationFn: () => createTagFn({ data: { name: tagName.trim(), color: tagColor } }),
    onSuccess: () => {
      setTagName('')
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      toast.success('Tag created')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not create tag')
    },
  })

  const deleteTagMutation = useMutation({
    mutationFn: (id: string) => deleteTagFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      toast.success('Tag deleted')
    },
  })

  const createTokenMutation = useMutation({
    mutationFn: () => createApiTokenFn({ data: { name: tokenName.trim() } }),
    onSuccess: (res) => {
      setTokenName('')
      setNewlyCreatedToken(res.rawToken)
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] })
      toast.success('API token created — copy it now')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create token')
    },
  })

  const revokeTokenMutation = useMutation({
    mutationFn: (id: string) => revokeApiTokenFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] })
      toast.success('API token revoked')
    },
  })

  async function handleConnectGithub() {
    try {
      await authClient.linkSocial({
        provider: 'github',
        callbackURL: '/settings',
      })
    } catch {
      await authClient.signIn.social({
        provider: 'github',
        callbackURL: '/settings',
      })
    }
  }

  async function handleCopyToken() {
    if (!newlyCreatedToken) return
    await navigator.clipboard.writeText(newlyCreatedToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">
          Manage your GitHub integration, tags, appearance, and extension API
          tokens.
        </p>
      </div>

      {/* GitHub Integration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GithubIcon className="h-4 w-4" />
            GitHub Integration
          </CardTitle>
          <CardDescription>
            Connect GitHub with least-privilege scopes (<code>read:user</code>,{' '}
            <code>user:email</code>) for 5,000 API requests/hour across all
            public repositories—zero write permissions requested. Tokens are
            encrypted at rest with AES-256-GCM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ghLoading ? (
            <div className="h-16 animate-pulse rounded bg-muted" />
          ) : ghStatus?.connected && ghStatus.account ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3.5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-medium">
                      Connected as{' '}
                      <span className="font-mono">
                        @{ghStatus.account.username}
                      </span>
                    </span>
                    <Badge variant="outline" className="text-[11px]">
                      {ghStatus.account.scopes || 'read:user user:email'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {ghStatus.account.rateLimitRemaining !== null ? (
                      <>
                        API Quota Remaining:{' '}
                        <strong className="font-mono text-foreground">
                          {ghStatus.account.rateLimitRemaining}
                        </strong>
                        {ghStatus.account.rateLimitResetAt && (
                          <>
                            {' '}
                            · Resets{' '}
                            {new Date(
                              ghStatus.account.rateLimitResetAt,
                            ).toLocaleTimeString()}
                          </>
                        )}
                      </>
                    ) : (
                      'Authenticated (5,000 requests/hour quota for public GitHub API)'
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkSyncMutation.isPending}
                    onClick={() => bulkSyncMutation.mutate()}
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${bulkSyncMutation.isPending ? 'animate-spin' : ''}`}
                    />
                    Sync Open Refs
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    Disconnect
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-dashed border-border p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Not connected to GitHub</p>
                <p className="text-xs text-muted-foreground">
                  {ghStatus?.oauthConfigured
                    ? 'Public repository lookups currently use unauthenticated GitHub requests (60 req/hr). Connect your account for 5,000 req/hr.'
                    : 'Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in your environment to enable GitHub OAuth. Public lookups still work unauthenticated (60 req/hr).'}
                </p>
              </div>
              {ghStatus?.oauthConfigured && (
                <Button size="sm" onClick={handleConnectGithub}>
                  <GithubIcon className="h-4 w-4" />
                  Connect GitHub
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose how ContribHub looks across desktop and mobile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="inline-flex rounded-md border border-border bg-muted/30 p-1 gap-1">
            {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTheme(mode)}
                className={`rounded px-3 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer ${
                  theme === mode
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tag Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TagIcon className="h-4 w-4" />
            Tags ({tags.length})
          </CardTitle>
          <CardDescription>
            Organize opportunities with reusable personal labels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!tagName.trim()) return
              createTagMutation.mutate()
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <Input
              placeholder="New tag name (e.g. good-first-issue, typescript, docs)"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              className="flex-1 min-w-[200px] h-8 text-xs"
            />
            <div className="flex items-center gap-1">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setTagColor(color)}
                  className={`h-5 w-5 rounded-full cursor-pointer transition-transform ${
                    tagColor === color ? 'ring-2 ring-offset-2 ring-ring scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
            <Button
              size="sm"
              type="submit"
              disabled={createTagMutation.isPending || !tagName.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Tag
            </Button>
          </form>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span>{tag.name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    ({tag.usageCount})
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteTagMutation.mutate(tag.id)}
                    className="ml-1 text-muted-foreground hover:text-destructive cursor-pointer"
                    aria-label={`Delete tag ${tag.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Tokens for Browser Extension / Automation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            API Tokens (Browser Extension &amp; CLI Ready)
          </CardTitle>
          <CardDescription>
            Authenticate external clients against{' '}
            <code>/api/v1/contributions</code> and{' '}
            <code>/api/v1/repositories</code> using{' '}
            <code>Authorization: Bearer &lt;token&gt;</code>. Tokens are stored
            as SHA-256 hashes only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!tokenName.trim()) return
              createTokenMutation.mutate()
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Token label (e.g. Chrome Extension)"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              className="max-w-xs h-8 text-xs"
            />
            <Button
              size="sm"
              type="submit"
              disabled={createTokenMutation.isPending || !tokenName.trim()}
            >
              {createTokenMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Generate Token
            </Button>
          </form>

          {newlyCreatedToken && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2 text-xs">
              <p className="font-medium text-emerald-800 dark:text-emerald-300">
                Copy your new token now — it will not be displayed again:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-2.5 py-1.5 font-mono text-xs border border-border break-all">
                  {newlyCreatedToken}
                </code>
                <Button size="sm" variant="outline" onClick={handleCopyToken}>
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          )}

          {apiTokens.length > 0 && (
            <div className="divide-y divide-border rounded-md border border-border">
              {apiTokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <div>
                    <div className="font-medium">{token.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {token.tokenPrefix}•••••••• · Created{' '}
                      {formatShortDate(token.createdAt)} · Last used{' '}
                      {formatRelativeDate(token.lastUsedAt)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => revokeTokenMutation.mutate(token.id)}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
