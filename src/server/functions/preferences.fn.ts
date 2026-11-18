import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSession } from '#/server/middleware/auth'
import {
  createApiToken,
  getUserPreferences,
  listApiTokens,
  revokeApiToken,
  updateUserPreferences,
} from '#/server/services/preferences.service'
import { updatePreferencesSchema } from '#/shared/schemas'

export const getUserPreferencesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { userId } = await requireSession()
    return getUserPreferences(userId)
  },
)

export const updateUserPreferencesFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => updatePreferencesSchema.parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return updateUserPreferences(userId, data)
  })

export const listApiTokensFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { userId } = await requireSession()
    return listApiTokens(userId)
  },
)

export const createApiTokenFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) =>
    z.object({ name: z.string().trim().min(1).max(80) }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return createApiToken(userId, data.name)
  })

export const revokeApiTokenFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return revokeApiToken(userId, data.id)
  })
