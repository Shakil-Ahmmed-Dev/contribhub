import { useState } from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { GitBranch, Loader2 } from 'lucide-react'
import { GithubIcon } from '#/components/ui/github-icon'
import { toast } from 'sonner'
import { authClient } from '#/lib/auth-client'
import { getSessionFn } from '#/server/functions/auth.fn'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (session.authenticated) {
      throw redirect({ to: '/' })
    }
    return { githubOAuthEnabled: session.githubOAuthEnabled }
  },
  component: LoginPage,
})

function LoginPage() {
  const { githubOAuthEnabled } = Route.useRouteContext()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGithubLoading, setIsGithubLoading] = useState(false)

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
      })
      if (result.error) {
        toast.error(result.error.message ?? 'Invalid email or password')
        return
      }
      toast.success('Signed in')
      await navigate({ to: '/' })
    } catch {
      toast.error('Unable to sign in right now. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGithubSignIn() {
    setIsGithubLoading(true)
    try {
      await authClient.signIn.social({
        provider: 'github',
        callbackURL: '/',
      })
    } catch {
      toast.error('GitHub sign-in failed')
      setIsGithubLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card shadow-xs">
            <GitBranch className="h-5 w-5 text-foreground" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">ContribHub</h1>
          <p className="text-xs text-muted-foreground max-w-xs">
            Your personal open-source contribution backlog and research workspace.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Access your personal contribution workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {githubOAuthEnabled && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isGithubLoading || isLoading}
                  onClick={handleGithubSignIn}
                >
                  {isGithubLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GithubIcon className="h-4 w-4" />
                  )}
                  Continue with GitHub
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      or email
                    </span>
                  </div>
                </div>
              </>
            )}

            <form onSubmit={handleEmailSignIn} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link
            to="/signup"
            className="font-medium text-foreground underline underline-offset-4 hover:text-ring"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
