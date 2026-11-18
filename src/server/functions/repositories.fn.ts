import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSession } from '#/server/middleware/auth'
import {
  addRepositoryForUser,
  getRepositoryDetail,
  listUserRepositories,
  removeUserRepository,
  syncRepositoryMetadata,
  updateUserRepository,
} from '#/server/services/repository.service'
import {
  addRepositorySchema,
  trackingStatusSchema,
  updateUserRepositorySchema,
} from '#/shared/schemas'

const listReposInputSchema = z
  .object({
    search: z.string().optional(),
    trackingStatus: trackingStatusSchema.optional(),
    language: z.string().optional(),
  })
  .optional()

export const listRepositoriesFn = createServerFn({ method: 'GET' })
  .validator((raw: unknown) => listReposInputSchema.parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return listUserRepositories(userId, data ?? {})
  })

export const getRepositoryDetailFn = createServerFn({ method: 'GET' })
  .validator((raw: unknown) => z.object({ repositoryId: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return getRepositoryDetail(userId, data.repositoryId)
  })

export const addRepositoryFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => addRepositorySchema.parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return addRepositoryForUser(userId, data)
  })

export const updateUserRepositoryFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => updateUserRepositorySchema.parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return updateUserRepository(userId, data)
  })

export const removeUserRepositoryFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({ repositoryId: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return removeUserRepository(userId, data.repositoryId)
  })

export const syncRepositoryMetadataFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({ repositoryId: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return syncRepositoryMetadata(userId, data.repositoryId)
  })
