import { createContext, useContext } from 'react'
import type { PersonalStatus } from '#/shared/constants'

export interface WorkspaceModalsContextValue {
  openQuickCapture: (opts?: {
    repositoryId?: string | null
    status?: PersonalStatus
  }) => void
  openAddRepository: () => void
  openCommandPalette: () => void
}

export const WorkspaceModalsContext =
  createContext<WorkspaceModalsContextValue | null>(null)

export function useWorkspaceModals() {
  const ctx = useContext(WorkspaceModalsContext)
  if (!ctx) {
    throw new Error('useWorkspaceModals must be used inside WorkspaceModalsContext')
  }
  return ctx
}
