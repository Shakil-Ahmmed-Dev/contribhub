import { useEffect, useState } from 'react'
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionFn } from '#/server/functions/auth.fn'
import { AppShell } from '#/components/layout/app-shell'
import { QuickCaptureDialog } from '#/components/contributions/quick-capture-dialog'
import { AddRepositoryDialog } from '#/components/repositories/add-repository-dialog'
import { CommandPalette } from '#/components/layout/command-palette'
import {
  WorkspaceModalsContext
  
} from '#/components/layout/workspace-modals-context'
import type {WorkspaceModalsContextValue} from '#/components/layout/workspace-modals-context';
import type { PersonalStatus } from '#/shared/constants'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session.authenticated || !session.user) {
      throw redirect({ to: '/login' })
    }
    return {
      user: session.user,
      githubOAuthEnabled: session.githubOAuthEnabled,
    }
  },
  component: AppLayout,
})

function AppLayout() {
  const { user } = Route.useRouteContext()
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false)
  const [captureDefaults, setCaptureDefaults] = useState<{
    repositoryId?: string | null
    status?: PersonalStatus
  }>({})
  const [addRepoOpen, setAddRepoOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen((v) => !v)
        return
      }

      if (!isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key.toLowerCase() === 'c') {
          e.preventDefault()
          setCaptureDefaults({})
          setQuickCaptureOpen(true)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const modalApi: WorkspaceModalsContextValue = {
    openQuickCapture: (opts) => {
      setCaptureDefaults(opts ?? {})
      setQuickCaptureOpen(true)
    },
    openAddRepository: () => setAddRepoOpen(true),
    openCommandPalette: () => setCommandOpen(true),
  }

  return (
    <WorkspaceModalsContext.Provider value={modalApi}>
      <AppShell
        user={user}
        onOpenQuickCapture={() => modalApi.openQuickCapture()}
        onOpenCommandPalette={() => setCommandOpen(true)}
      >
        <Outlet />
      </AppShell>

      <QuickCaptureDialog
        open={quickCaptureOpen}
        onOpenChange={setQuickCaptureOpen}
        defaultRepositoryId={captureDefaults.repositoryId}
        defaultStatus={captureDefaults.status}
      />

      <AddRepositoryDialog
        open={addRepoOpen}
        onOpenChange={setAddRepoOpen}
      />

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onOpenQuickCapture={() => modalApi.openQuickCapture()}
        onOpenAddRepo={() => setAddRepoOpen(true)}
      />
    </WorkspaceModalsContext.Provider>
  )
}
