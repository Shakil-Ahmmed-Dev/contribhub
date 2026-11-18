import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSession } from '#/server/middleware/auth'
import { createTag, deleteTag, listUserTags } from '#/server/services/tag.service'
import { createTagSchema } from '#/shared/schemas'

export const listTagsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId } = await requireSession()
  return listUserTags(userId)
})

export const createTagFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => createTagSchema.parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return createTag(userId, data)
  })

export const deleteTagFn = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { userId } = await requireSession()
    return deleteTag(userId, data.id)
  })
