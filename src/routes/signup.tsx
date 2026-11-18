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

export const Route = createFileRoute('/signup')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (session.authenticated) {
      throw redirect({ to: '/' })
    }
    return { githubOAuthEnabled: session.githubOAuthEnabled }
  },
  component: SignupPage,
})

function SignupPage() {
  const { githubOAuthEnabled } = Route.useRouteContext()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGithubLoading, setIsGithubLoading] = useState(false)

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setIsLoading(true)
    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      })
      if (result.error) {
        toast.error(result.error.message ?? 'Could not create account')
        return
      }
      toast.success('Account created')
      await navigate({ to: '/' })
    } catch {
      toast.error('Unable to create account right now. Please try again.')
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
            Create your isolated open-source contribution workspace.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create account</CardTitle>
            <CardDescription>
              Start capturing and organizing open-source opportunities
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

            <form onSubmit={handleSignUp} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Alex Developer"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

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
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create account
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-foreground underline underline-offset-4 hover:text-ring"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
