import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  FolderGit2,
  GitBranch,
  GitPullRequest,
  History,
  Inbox,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Wrench,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { authClient } from '#/lib/auth-client'
import { useTheme } from '#/lib/theme'
import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'

export interface AppUser {
  id: string
  name: string
  email: string
  image: string | null
}

interface AppShellProps {
  user: AppUser
  onOpenQuickCapture?: () => void
  onOpenCommandPalette?: () => void
  children: React.ReactNode
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/backlog', label: 'Backlog', icon: Kanban },
  { to: '/repositories', label: 'Repositories', icon: FolderGit2 },
  { to: '/in-progress', label: 'In Progress', icon: Wrench },
  { to: '/pull-requests', label: 'Pull Requests', icon: GitPullRequest },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

export function AppShell({
  user,
  onOpenQuickCapture,
  onOpenCommandPalette,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()

  async function handleSignOut() {
    await authClient.signOut()
    toast.success('Signed out')
    await navigate({ to: '/login' })
  }

  function toggleTheme() {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-13 items-center justify-between border-b border-sidebar-border px-3.5">
        <Link
          to="/"
          className="flex items-center gap-2 font-semibold text-sm tracking-tight text-sidebar-foreground"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GitBranch className="h-3.5 w-3.5" />
          </div>
          <span>ContribHub</span>
        </Link>
        <button
          type="button"
          className="md:hidden rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-2.5 space-y-1.5">
        {onOpenQuickCapture && (
          <Button
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => {
              setMobileMenuOpen(false)
              onOpenQuickCapture()
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            New Opportunity
            <kbd className="ml-auto rounded bg-primary-foreground/15 px-1.5 py-0.5 text-[10px] font-mono">
              C
            </kbd>
          </Button>
        )}

        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false)
              onOpenCommandPalette()
            }}
            className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search...</span>
            <kbd className="ml-auto rounded border border-border bg-muted px-1 text-[10px] font-mono">
              Ctrl K
            </kbd>
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            'exact' in item && item.exact
              ? pathname === item.to
              : pathname === item.to || pathname.startsWith(`${item.to}/`)

          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">
              {user.name}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {user.email}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-58 md:shrink-0 md:flex-col border-r border-sidebar-border bg-sidebar sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex w-64 max-w-[80vw] flex-col bg-sidebar border-r border-sidebar-border">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top header */}
        <header className="flex md:hidden h-13 items-center justify-between border-b border-border bg-card px-3 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold">ContribHub</span>
          </div>
          <div className="flex items-center gap-1">
            {onOpenCommandPalette && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onOpenCommandPalette}
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
            {onOpenQuickCapture && (
              <Button
                type="button"
                size="sm"
                onClick={onOpenQuickCapture}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            )}
          </div>
        </header>

        <main className="flex-1 min-w-0 p-4 md:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
